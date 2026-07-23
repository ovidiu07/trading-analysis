package com.tradevault.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.*;
import com.tradevault.domain.enums.*;
import com.tradevault.dto.tradeimport.Mt5ImportCommitRequest;
import com.tradevault.dto.tradeimport.Mt5ImportCommitResponse;
import com.tradevault.dto.tradeimport.Mt5ImportPreviewResponse;
import com.tradevault.repository.*;
import com.tradevault.service.mt5.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigDecimal;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class Mt5TradeImportService {
    private static final long MAX_FILE_SIZE = 10L * 1024L * 1024L;
    private static final TradeSource SOURCE = TradeSource.MT5_HTML;

    private final CurrentUserService currentUserService;
    private final Mt5HtmlParser parser;
    private final Mt5TradeReconstructor reconstructor;
    private final ObjectMapper objectMapper;
    private final TradeImportBatchRepository batchRepository;
    private final InstrumentAliasRepository aliasRepository;
    private final AccountRepository accountRepository;
    private final TradeRepository tradeRepository;
    private final ImportedTradeExecutionRepository executionRepository;
    private final ImportedTradeOrderRepository orderRepository;

    @Transactional
    public Mt5ImportPreviewResponse preview(MultipartFile file, UUID targetAccountId, String requestedTimezone) throws IOException {
        validateFile(file);
        User user = currentUserService.getCurrentUser();
        Account target = targetAccountId == null ? null : ownedAccount(targetAccountId, user.getId());
        byte[] bytes = file.getBytes();
        Mt5ParsedReport report;
        try {
            report = parser.parse(bytes);
        } catch (RuntimeException ex) {
            log.warn("MT5 preview parse failed userId={} filename={} size={} reason={}",
                    user.getId(), safeFilename(file.getOriginalFilename()), bytes.length, ex.getMessage());
            throw ex;
        }
        if (target == null && report.metadata().externalAccountId() != null) {
            target = accountRepository.findFirstByUserIdAndExternalAccountIdAndBrokerServerIgnoreCase(
                    user.getId(), report.metadata().externalAccountId(), safeServer(report.metadata().brokerServer())).orElse(null);
        }
        String sourceTimezone = firstNonBlank(requestedTimezone, target == null ? null : target.getBrokerTimezone());
        ZoneId sourceZone = sourceTimezone == null ? ZoneId.of("UTC") : validZone(sourceTimezone);
        List<Mt5TradeCandidate> candidates = reconstructor.reconstruct(report, sourceZone);
        List<String> warnings = new ArrayList<>(report.warnings());
        if (sourceTimezone == null) warnings.add("Select the broker-server timezone before committing; preview timestamps are provisionally shown as UTC");
        if (target == null) warnings.add("Select the target TradeJAudit account before committing");

        TradeImportBatch batch = TradeImportBatch.builder()
                .user(user).source(SOURCE).originalFilename(safeFilename(file.getOriginalFilename()))
                .fileHash(sha256(bytes)).fileSize(bytes.length).parserVersion(Mt5HtmlParser.PARSER_VERSION)
                .externalAccountId(report.metadata().externalAccountId()).accountName(report.metadata().accountName())
                .accountCurrency(report.metadata().currency()).broker(report.metadata().company())
                .brokerServer(report.metadata().brokerServer()).accountType(report.metadata().accountType())
                .accountingMode(report.metadata().accountingMode()).reportGeneratedAtOriginal(report.metadata().reportGeneratedAt())
                .sourceTimezone(sourceTimezone).targetAccount(target).status(TradeImportStatus.PREVIEW)
                .positionsFound(report.positions().size()).ordersFound(report.orders().size()).dealsFound(report.deals().size())
                .parsedPayload(objectMapper.valueToTree(report)).build();

        PreviewParts parts = buildPreviewParts(user, report, candidates, sourceTimezone, target);
        warnings.addAll(parts.warnings());
        batch.setTradesReady(parts.ready());
        batch.setDuplicates(parts.duplicates());
        batch.setWarningCount(warnings.size() + candidates.stream().mapToInt(c -> c.warnings().size()).sum());
        batch = batchRepository.save(batch);
        return toPreview(batch, report, candidates, parts, warnings);
    }

    @Transactional(readOnly = true)
    public Object details(UUID batchId) {
        User user = currentUserService.getCurrentUser();
        TradeImportBatch batch = ownedBatch(batchId, user.getId());
        if (batch.getStatus() != TradeImportStatus.PREVIEW) {
            return batch.getResultPayload();
        }
        Mt5ParsedReport report = objectMapper.convertValue(batch.getParsedPayload(), Mt5ParsedReport.class);
        ZoneId zone = batch.getSourceTimezone() == null ? ZoneId.of("UTC") : validZone(batch.getSourceTimezone());
        List<Mt5TradeCandidate> candidates = reconstructor.reconstruct(report, zone);
        PreviewParts parts = buildPreviewParts(user, report, candidates, batch.getSourceTimezone(), batch.getTargetAccount());
        return toPreview(batch, report, candidates, parts, parts.warnings());
    }

    @Transactional
    public Mt5ImportCommitResponse commit(UUID batchId, Mt5ImportCommitRequest request) {
        User user = currentUserService.getCurrentUser();
        TradeImportBatch batch = ownedBatch(batchId, user.getId());
        if (batch.getStatus() != TradeImportStatus.PREVIEW && batch.getStatus() != TradeImportStatus.WARNING) {
            throw conflict("This import batch has already been committed");
        }
        Account account = ownedAccount(request.targetAccountId(), user.getId());
        ZoneId sourceZone = validZone(request.sourceTimezone());
        Mt5ParsedReport report = objectMapper.convertValue(batch.getParsedPayload(), Mt5ParsedReport.class);
        List<Mt5TradeCandidate> candidates = reconstructor.reconstruct(report, sourceZone);
        Map<String, InstrumentAlias> mappings = resolveMappings(user, report, candidates, request.symbolMappings());
        Set<String> selected = request.selectedPositionIds() == null || request.selectedPositionIds().isEmpty()
                ? candidates.stream().map(Mt5TradeCandidate::externalPositionId).collect(Collectors.toSet())
                : new HashSet<>(request.selectedPositionIds());
        Map<String, UUID> links = request.linkToExistingTradeIds() == null ? Map.of() : request.linkToExistingTradeIds();
        int created = 0, updated = 0, duplicates = 0;
        List<UUID> tradeIds = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        BigDecimal gross = BigDecimal.ZERO, costs = BigDecimal.ZERO, net = BigDecimal.ZERO;

        for (Mt5TradeCandidate candidate : candidates) {
            if (!selected.contains(candidate.externalPositionId())) continue;
            InstrumentAlias mapping = mappings.get(key(candidate.externalSymbol()));
            if (mapping == null) throw badRequest("Resolve symbol mapping for " + candidate.externalSymbol());
            Optional<Trade> existingExternal = findExternalTrade(user, report, candidate);
            Trade trade;
            boolean wasExisting;
            UUID linkedId = links.get(candidate.externalPositionId());
            if (linkedId != null) {
                trade = tradeRepository.findByIdAndUserId(linkedId, user.getId())
                        .orElseThrow(() -> forbidden("The linked trade is not owned by the current user"));
                wasExisting = true;
            } else if (existingExternal.isPresent()) {
                trade = existingExternal.get();
                wasExisting = true;
                duplicates++;
            } else {
                trade = Trade.builder().user(user).createdAt(OffsetDateTime.now()).build();
                wasExisting = false;
            }
            applyBrokerFields(trade, account, batch, report, candidate, mapping, request.sourceTimezone(), !wasExisting);
            trade = tradeRepository.save(trade);
            upsertExecutions(trade, batch, report, candidate, sourceZone);
            upsertOrders(trade, batch, report, candidate, sourceZone);
            tradeIds.add(trade.getId());
            if (wasExisting) updated++; else created++;
            gross = gross.add(zero(candidate.brokerReportedGrossPnl()));
            costs = costs.add(zero(candidate.commission())).add(zero(candidate.otherCosts()));
            net = net.add(zero(candidate.brokerReportedNetPnl()));
            warnings.addAll(candidate.warnings());
        }
        persistUnlinkedAccountTransactions(batch, report, sourceZone);
        persistUnlinkedOrders(batch, report, candidates, sourceZone);
        if (request.saveBrokerTimezone()) {
            saveAccountMapping(account, user, report, request.sourceTimezone());
        }
        int excluded = candidates.size() - selected.size();
        TradeImportStatus status = warnings.isEmpty() ? TradeImportStatus.IMPORTED : TradeImportStatus.WARNING;
        Mt5ImportCommitResponse response = new Mt5ImportCommitResponse(batch.getId(), status, created, updated, duplicates,
                Math.max(0, excluded), gross, costs, net, tradeIds, warnings.stream().distinct().toList(), List.of());
        batch.setTargetAccount(account);
        batch.setSourceTimezone(request.sourceTimezone());
        batch.setStatus(status);
        batch.setCreatedTrades(created);
        batch.setUpdatedTrades(updated);
        batch.setDuplicates(duplicates);
        batch.setWarningCount(response.warnings().size());
        batch.setCompletedAt(OffsetDateTime.now());
        batch.setResultPayload(objectMapper.valueToTree(response));
        batchRepository.save(batch);
        log.info("MT5 import committed batchId={} userId={} targetAccountId={} source={} externalAccountId={} broker={} server={} created={} updated={} duplicates={} excluded={} warnings={}",
                batch.getId(), user.getId(), account.getId(), SOURCE, report.metadata().externalAccountId(),
                report.metadata().company(), safeServer(report.metadata().brokerServer()), created, updated,
                duplicates, response.excluded(), response.warnings().size());
        return response;
    }

    private PreviewParts buildPreviewParts(User user, Mt5ParsedReport report, List<Mt5TradeCandidate> candidates,
                                            String sourceTimezone, Account account) {
        Map<String, InstrumentAlias> mappings = new HashMap<>();
        List<Mt5ImportPreviewResponse.UnmappedSymbol> unmapped = new ArrayList<>();
        for (String symbol : candidates.stream().map(Mt5TradeCandidate::externalSymbol).filter(Objects::nonNull).distinct().toList()) {
            List<InstrumentAlias> found = aliasRepository.findMappings(user.getId(), report.metadata().company(), safeServer(report.metadata().brokerServer()), symbol);
            if (found.isEmpty()) unmapped.add(new Mt5ImportPreviewResponse.UnmappedSymbol(symbol, null));
            else mappings.put(key(symbol), found.get(0));
        }
        int duplicateCount = 0;
        for (Mt5TradeCandidate candidate : candidates) if (findExternalTrade(user, report, candidate).isPresent()) duplicateCount++;
        int ready = sourceTimezone == null || account == null ? 0 : (int) candidates.stream().filter(c -> mappings.containsKey(key(c.externalSymbol()))).count();
        List<String> warnings = new ArrayList<>();
        if (!unmapped.isEmpty()) warnings.add("Resolve all symbol mappings before importing affected trades");
        return new PreviewParts(mappings, unmapped, duplicateCount, ready, warnings);
    }

    private Mt5ImportPreviewResponse toPreview(TradeImportBatch batch, Mt5ParsedReport report, List<Mt5TradeCandidate> candidates,
                                                PreviewParts parts, List<String> warnings) {
        BigDecimal gross = candidates.stream().map(Mt5TradeCandidate::brokerReportedGrossPnl).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal costs = candidates.stream().map(c -> zero(c.commission()).add(zero(c.otherCosts()))).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal net = candidates.stream().map(Mt5TradeCandidate::brokerReportedNetPnl).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        int transactions = (int) report.deals().stream().filter(d -> !d.isTradingExecution()).count();
        List<Mt5ImportPreviewResponse.TradePreview> previews = candidates.stream().map(candidate -> {
            InstrumentAlias mapping = parts.mappings().get(key(candidate.externalSymbol()));
            Optional<Trade> existing = findExternalTrade(batch.getUser(), report, candidate);
            List<Mt5ImportPreviewResponse.ManualMatch> matches = manualMatches(batch.getUser(), candidate, mapping);
            return new Mt5ImportPreviewResponse.TradePreview(candidate.externalPositionId(), candidate.externalSymbol(),
                    mapping == null ? null : mapping.getInternalSymbol(), mapping == null ? null : mapping.getMarket(),
                    mapping == null ? null : mapping.getTradeCurrency(), candidate.direction(), candidate.status(),
                    candidate.openedAt(), candidate.closedAt(), candidate.quantity(), candidate.entryPrice(), candidate.exitPrice(),
                    candidate.initialStopLossPrice(), candidate.initialTakeProfitPrice(), candidate.finalStopLossPrice(), candidate.finalTakeProfitPrice(),
                    candidate.brokerReportedGrossPnl(), candidate.commission(), candidate.otherCosts(), candidate.brokerReportedNetPnl(),
                    report.metadata().currency(), candidate.entryOrderType(), candidate.requestedEntryPrice(), candidate.requestedExitPrice(),
                    candidate.entrySlippagePoints(), candidate.exitSlippagePoints(), candidate.exitReason(), candidate.note(), existing.isPresent(),
                    existing.map(Trade::getId).orElse(null), matches, candidate.warnings());
        }).toList();
        int warningCount = warnings.size() + candidates.stream().mapToInt(c -> c.warnings().size()).sum();
        return new Mt5ImportPreviewResponse(batch.getId(), batch.getStatus(),
                new Mt5ImportPreviewResponse.AccountMetadata(report.metadata().externalAccountId(), report.metadata().accountName(),
                        report.metadata().currency(), report.metadata().company(), report.metadata().brokerServer(),
                        report.metadata().accountType(), report.metadata().accountingMode(), report.metadata().reportGeneratedAt()),
                new Mt5ImportPreviewResponse.Summary(report.positions().size(), report.orders().size(), report.deals().size(),
                        transactions, parts.ready(), parts.duplicates(), warningCount, gross, costs, net),
                batch.getSourceTimezone(), batch.getTargetAccount() == null ? null : batch.getTargetAccount().getId(),
                parts.unmapped(), previews, warnings.stream().distinct().toList(), List.of());
    }

    private List<Mt5ImportPreviewResponse.ManualMatch> manualMatches(User user, Mt5TradeCandidate candidate, InstrumentAlias mapping) {
        String expectedSymbol = mapping == null ? candidate.externalSymbol() : mapping.getInternalSymbol();
        return tradeRepository.findByUserId(user.getId()).stream()
                .filter(t -> t.getSource() == null || t.getSource() == TradeSource.MANUAL)
                .map(t -> {
                    int confidence = t.getSymbol().equalsIgnoreCase(expectedSymbol) ? 15 : 0;
                    if (t.getDirection() == candidate.direction()) confidence += 15;
                    if (same(t.getQuantity(), candidate.quantity())) confidence += 15;
                    if (same(t.getEntryPrice(), candidate.entryPrice())) confidence += 15;
                    if (same(t.getExitPrice(), candidate.exitPrice())) confidence += 15;
                    if (near(t.getOpenedAt(), candidate.openedAt())) confidence += 15;
                    if (near(t.getClosedAt(), candidate.closedAt())) confidence += 10;
                    return new Mt5ImportPreviewResponse.ManualMatch(t.getId(), t.getSymbol(), confidence,
                            "Symbol, direction, quantity, prices, and timestamps are suggestions only; linking requires confirmation");
                }).filter(m -> m.confidence() >= 55).sorted(Comparator.comparingInt(Mt5ImportPreviewResponse.ManualMatch::confidence).reversed())
                .limit(3).toList();
    }

    private Map<String, InstrumentAlias> resolveMappings(User user, Mt5ParsedReport report, List<Mt5TradeCandidate> candidates,
                                                          List<Mt5ImportCommitRequest.SymbolMapping> supplied) {
        Map<String, Mt5ImportCommitRequest.SymbolMapping> suppliedBySymbol = supplied == null ? Map.of() : supplied.stream()
                .collect(Collectors.toMap(m -> key(m.externalSymbol()), Function.identity(), (a, b) -> b));
        Map<String, InstrumentAlias> result = new HashMap<>();
        for (String symbol : candidates.stream().map(Mt5TradeCandidate::externalSymbol).filter(Objects::nonNull).distinct().toList()) {
            Mt5ImportCommitRequest.SymbolMapping input = suppliedBySymbol.get(key(symbol));
            InstrumentAlias alias;
            if (input != null) {
                alias = aliasRepository.findOwned(user.getId(), report.metadata().company(), safeServer(report.metadata().brokerServer()), symbol)
                        .orElseGet(InstrumentAlias::new);
                alias.setUser(user); alias.setBroker(report.metadata().company()); alias.setBrokerServer(safeServer(report.metadata().brokerServer()));
                alias.setExternalSymbol(symbol); alias.setInternalSymbol(input.internalSymbol().trim()); alias.setMarket(input.market());
                alias.setTradeCurrency(input.tradeCurrency().trim().toUpperCase(Locale.ROOT)); alias.setTickSize(input.tickSize());
                alias.setTickValue(input.tickValue()); alias.setPointValue(input.pointValue()); alias.setContractMultiplier(input.contractMultiplier());
                alias.setActive(true);
                if (input.saveForFuture()) alias = aliasRepository.save(alias);
            } else {
                alias = aliasRepository.findMappings(user.getId(), report.metadata().company(), safeServer(report.metadata().brokerServer()), symbol)
                        .stream().findFirst().orElse(null);
            }
            if (alias != null) result.put(key(symbol), alias);
        }
        return result;
    }

    private void applyBrokerFields(Trade trade, Account account, TradeImportBatch batch, Mt5ParsedReport report,
                                   Mt5TradeCandidate c, InstrumentAlias mapping, String zone, boolean isNew) {
        OffsetDateTime now = OffsetDateTime.now();
        trade.setUser(batch.getUser()); trade.setAccount(account); trade.setSource(SOURCE);
        trade.setExternalAccountId(report.metadata().externalAccountId()); trade.setExternalPositionId(c.externalPositionId());
        trade.setBrokerAccountId(report.metadata().externalAccountId()); trade.setSourceBroker(report.metadata().company());
        trade.setSourceBrokerServer(safeServer(report.metadata().brokerServer())); trade.setSourceTimezone(zone);
        trade.setAccountCurrency(report.metadata().currency()); trade.setBrokerReportedPnlCurrency(report.metadata().currency());
        trade.setSymbol(mapping.getInternalSymbol()); trade.setMarket(mapping.getMarket()); trade.setTradeCurrency(mapping.getTradeCurrency());
        trade.setProfileCurrency(report.metadata().currency()); trade.setDirection(c.direction()); trade.setStatus(c.status());
        trade.setOpenedAt(c.openedAt()); trade.setClosedAt(c.closedAt()); trade.setQuantity(c.quantity());
        trade.setEntryPrice(c.entryPrice()); trade.setExitPrice(c.exitPrice());
        trade.setInitialStopLossPrice(c.initialStopLossPrice()); trade.setInitialTakeProfitPrice(c.initialTakeProfitPrice());
        trade.setFinalStopLossPrice(c.finalStopLossPrice()); trade.setFinalTakeProfitPrice(c.finalTakeProfitPrice());
        trade.setStopLossPrice(firstNonNull(c.initialStopLossPrice(), c.finalStopLossPrice()));
        trade.setTakeProfitPrice(firstNonNull(c.initialTakeProfitPrice(), c.finalTakeProfitPrice()));
        trade.setCommission(zero(c.commission())); trade.setFees(zero(c.otherCosts())); trade.setBrokerFees(zero(c.otherCosts()));
        trade.setSlippage(BigDecimal.ZERO); trade.setSwap(BigDecimal.ZERO);
        trade.setPnlGross(c.brokerReportedGrossPnl()); trade.setPnlNet(c.brokerReportedNetPnl());
        trade.setPnlProfileCurrency(c.brokerReportedNetPnl()); trade.setBrokerReportedGrossPnl(c.brokerReportedGrossPnl());
        trade.setBrokerReportedNetPnl(c.brokerReportedNetPnl()); trade.setEntryOrderType(c.entryOrderType());
        trade.setExitReason(c.exitReason()); trade.setRequestedEntryPrice(c.requestedEntryPrice()); trade.setRequestedExitPrice(c.requestedExitPrice());
        trade.setEntrySlippagePoints(c.entrySlippagePoints()); trade.setExitSlippagePoints(c.exitSlippagePoints());
        trade.setContractMultiplier(firstNonNull(mapping.getContractMultiplier(), BigDecimal.ONE));
        trade.setImportBatchId(batch.getId()); trade.setImportStatus(TradeImportStatus.NEEDS_REVIEW);
        if (trade.getImportedAt() == null) trade.setImportedAt(now); trade.setLastSynchronizedAt(now); trade.setUpdatedAt(now);
        if (isNew) { trade.setCreatedAt(now); trade.setNotes(c.note()); }
    }

    private void upsertExecutions(Trade trade, TradeImportBatch batch, Mt5ParsedReport report, Mt5TradeCandidate candidate, ZoneId zone) {
        Set<String> ids = new HashSet<>(candidate.dealIds());
        for (Mt5ParsedReport.Deal deal : report.deals()) {
            if (deal.externalDealId() == null || !ids.contains(deal.externalDealId())) continue;
            ImportedTradeExecution entity = executionRepository
                    .findByUserIdAndSourceAndBrokerServerIgnoreCaseAndExternalAccountIdAndExternalDealId(batch.getUser().getId(), SOURCE, safeServer(report.metadata().brokerServer()),
                            report.metadata().externalAccountId(), deal.externalDealId()).orElseGet(ImportedTradeExecution::new);
            entity.setUser(batch.getUser()); entity.setTrade(trade); entity.setImportBatch(batch); entity.setSource(SOURCE); entity.setBrokerServer(safeServer(report.metadata().brokerServer()));
            entity.setExternalAccountId(report.metadata().externalAccountId()); entity.setExternalDealId(deal.externalDealId());
            entity.setExternalOrderId(deal.externalOrderId()); entity.setExternalPositionId(candidate.externalPositionId()); entity.setSymbol(deal.symbol());
            entity.setExecutionDirection(deal.type()); entity.setEntryExitClassification(deal.direction()); entity.setQuantity(deal.volume());
            entity.setPrice(deal.price()); entity.setExecutedAt(reconstructor.toUtc(deal.executedAt(), zone)); entity.setOriginalBrokerTimestamp(deal.executedAt());
            entity.setCommission(deal.commission()); entity.setFee(deal.fee()); entity.setCost(deal.cost()); entity.setSwap(deal.swap());
            entity.setProfit(deal.profit()); entity.setBalanceAfter(deal.balance()); entity.setCurrency(report.metadata().currency());
            entity.setComment(deal.comment()); entity.setRawSourceData(objectMapper.valueToTree(deal.raw())); executionRepository.save(entity);
        }
    }

    private void persistUnlinkedAccountTransactions(TradeImportBatch batch, Mt5ParsedReport report, ZoneId zone) {
        for (Mt5ParsedReport.Deal deal : report.deals()) {
            if (deal.isTradingExecution() || deal.externalDealId() == null) continue;
            ImportedTradeExecution entity = executionRepository
                    .findByUserIdAndSourceAndBrokerServerIgnoreCaseAndExternalAccountIdAndExternalDealId(batch.getUser().getId(), SOURCE, safeServer(report.metadata().brokerServer()),
                            report.metadata().externalAccountId(), deal.externalDealId()).orElseGet(ImportedTradeExecution::new);
            entity.setUser(batch.getUser()); entity.setTrade(null); entity.setImportBatch(batch); entity.setSource(SOURCE); entity.setBrokerServer(safeServer(report.metadata().brokerServer()));
            entity.setExternalAccountId(report.metadata().externalAccountId()); entity.setExternalDealId(deal.externalDealId());
            entity.setExternalOrderId(deal.externalOrderId()); entity.setExternalPositionId(deal.externalPositionId()); entity.setSymbol(deal.symbol());
            entity.setExecutionDirection(deal.type()); entity.setEntryExitClassification(deal.direction()); entity.setQuantity(deal.volume());
            entity.setPrice(deal.price()); entity.setExecutedAt(reconstructor.toUtc(deal.executedAt(), zone)); entity.setOriginalBrokerTimestamp(deal.executedAt());
            entity.setCommission(deal.commission()); entity.setFee(deal.fee()); entity.setCost(deal.cost()); entity.setSwap(deal.swap());
            entity.setProfit(deal.profit()); entity.setBalanceAfter(deal.balance()); entity.setCurrency(report.metadata().currency());
            entity.setComment(deal.comment()); entity.setRawSourceData(objectMapper.valueToTree(deal.raw())); executionRepository.save(entity);
        }
    }

    private void upsertOrders(Trade trade, TradeImportBatch batch, Mt5ParsedReport report, Mt5TradeCandidate candidate, ZoneId zone) {
        Set<String> ids = new HashSet<>(candidate.orderIds());
        for (Mt5ParsedReport.Order order : report.orders()) {
            if (order.externalOrderId() == null || !ids.contains(order.externalOrderId())) continue;
            ImportedTradeOrder entity = orderRepository
                    .findByUserIdAndSourceAndBrokerServerIgnoreCaseAndExternalAccountIdAndExternalOrderId(batch.getUser().getId(), SOURCE, safeServer(report.metadata().brokerServer()),
                            report.metadata().externalAccountId(), order.externalOrderId()).orElseGet(ImportedTradeOrder::new);
            entity.setUser(batch.getUser()); entity.setTrade(trade); entity.setImportBatch(batch); entity.setSource(SOURCE); entity.setBrokerServer(safeServer(report.metadata().brokerServer()));
            entity.setExternalAccountId(report.metadata().externalAccountId()); entity.setExternalOrderId(order.externalOrderId());
            entity.setExternalPositionId(candidate.externalPositionId()); entity.setSymbol(order.symbol()); entity.setOrderType(order.type());
            entity.setRequestedQuantity(order.requestedVolume()); entity.setFilledQuantity(order.filledVolume()); entity.setRequestedPrice(order.requestedPrice());
            entity.setStopLoss(order.stopLoss()); entity.setTakeProfit(order.takeProfit()); entity.setState(order.state());
            entity.setOpenedAt(reconstructor.toUtc(order.openedAt(), zone)); entity.setCompletedAt(reconstructor.toUtc(order.completedAt(), zone));
            entity.setOriginalOpenedAt(order.openedAt()); entity.setOriginalCompletedAt(order.completedAt()); entity.setComment(order.comment());
            entity.setRawSourceData(objectMapper.valueToTree(order.raw())); orderRepository.save(entity);
        }
    }

    private void persistUnlinkedOrders(TradeImportBatch batch, Mt5ParsedReport report, List<Mt5TradeCandidate> candidates, ZoneId zone) {
        Set<String> linkedOrderIds = candidates.stream().flatMap(candidate -> candidate.orderIds().stream()).collect(Collectors.toSet());
        for (Mt5ParsedReport.Order order : report.orders()) {
            if (order.externalOrderId() == null || linkedOrderIds.contains(order.externalOrderId())) continue;
            ImportedTradeOrder entity = orderRepository
                    .findByUserIdAndSourceAndBrokerServerIgnoreCaseAndExternalAccountIdAndExternalOrderId(batch.getUser().getId(), SOURCE, safeServer(report.metadata().brokerServer()),
                            report.metadata().externalAccountId(), order.externalOrderId()).orElseGet(ImportedTradeOrder::new);
            entity.setUser(batch.getUser()); entity.setTrade(null); entity.setImportBatch(batch); entity.setSource(SOURCE); entity.setBrokerServer(safeServer(report.metadata().brokerServer()));
            entity.setExternalAccountId(report.metadata().externalAccountId()); entity.setExternalOrderId(order.externalOrderId());
            entity.setExternalPositionId(order.externalPositionId()); entity.setSymbol(order.symbol()); entity.setOrderType(order.type());
            entity.setRequestedQuantity(order.requestedVolume()); entity.setFilledQuantity(order.filledVolume()); entity.setRequestedPrice(order.requestedPrice());
            entity.setStopLoss(order.stopLoss()); entity.setTakeProfit(order.takeProfit()); entity.setState(order.state());
            entity.setOpenedAt(reconstructor.toUtc(order.openedAt(), zone)); entity.setCompletedAt(reconstructor.toUtc(order.completedAt(), zone));
            entity.setOriginalOpenedAt(order.openedAt()); entity.setOriginalCompletedAt(order.completedAt()); entity.setComment(order.comment());
            entity.setRawSourceData(objectMapper.valueToTree(order.raw())); orderRepository.save(entity);
        }
    }

    private Optional<Trade> findExternalTrade(User user, Mt5ParsedReport report, Mt5TradeCandidate candidate) {
        return tradeRepository.findByUserIdAndSourceAndSourceBrokerServerIgnoreCaseAndExternalAccountIdAndExternalPositionId(
                user.getId(), SOURCE, safeServer(report.metadata().brokerServer()), report.metadata().externalAccountId(), candidate.externalPositionId());
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) throw badRequest("An MT5 HTML report is required");
        String name = safeFilename(file.getOriginalFilename()).toLowerCase(Locale.ROOT);
        if (!name.endsWith(".html") && !name.endsWith(".htm")) throw badRequest("Only .html and .htm MetaTrader reports are accepted");
        if (file.getSize() > MAX_FILE_SIZE) throw badRequest("The MT5 report exceeds the 10 MB limit");
    }

    private Account ownedAccount(UUID id, UUID userId) { return accountRepository.findByIdAndUserId(id, userId).orElseThrow(() -> forbidden("Target account not found")); }
    private void saveAccountMapping(Account account, User user, Mt5ParsedReport report, String sourceTimezone) {
        String externalAccountId = report.metadata().externalAccountId();
        String brokerServer = safeServer(report.metadata().brokerServer());
        List<Account> mappedAccounts = accountRepository.findByUserIdAndExternalAccountIdAndBrokerServerIgnoreCase(
                user.getId(), externalAccountId, brokerServer);
        if (mappedAccounts.stream().anyMatch(mapped -> !mapped.getId().equals(account.getId()))) {
            throw conflict("This MT5 account is already mapped to another TradeJAudit account");
        }
        if (account.getExternalAccountId() != null
                && (!account.getExternalAccountId().equalsIgnoreCase(externalAccountId)
                || !safeServer(account.getBrokerServer()).equalsIgnoreCase(brokerServer))) {
            throw conflict("The selected TradeJAudit account is already mapped to a different broker account");
        }
        account.setExternalAccountId(externalAccountId);
        account.setBrokerServer(report.metadata().brokerServer());
        account.setBrokerTimezone(sourceTimezone);
        if (account.getBroker() == null) account.setBroker(report.metadata().company());
        if (account.getAccountCurrency() == null) account.setAccountCurrency(report.metadata().currency());
        accountRepository.save(account);
    }
    private TradeImportBatch ownedBatch(UUID id, UUID userId) { return batchRepository.findByIdAndUserId(id, userId).orElseThrow(() -> forbidden("Import batch not found")); }
    private ZoneId validZone(String value) { try { return ZoneId.of(value); } catch (Exception ex) { throw badRequest("Invalid IANA source timezone: " + value); } }
    private static String safeFilename(String value) { String name = value == null ? "report.html" : value.replace('\\', '/'); int slash = name.lastIndexOf('/'); return (slash >= 0 ? name.substring(slash + 1) : name).replaceAll("[\\r\\n]", "_"); }
    private static String safeServer(String value) { return value == null ? "" : value.trim(); }
    private static String key(String value) { return value == null ? "" : value.trim().toLowerCase(Locale.ROOT); }
    private static BigDecimal zero(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
    private static boolean same(BigDecimal a, BigDecimal b) { return a != null && b != null && a.subtract(b).abs().compareTo(new BigDecimal("0.0001")) <= 0; }
    private static boolean near(OffsetDateTime a, OffsetDateTime b) {
        return a != null && b != null && Math.abs(java.time.Duration.between(a, b).toMinutes()) <= 5;
    }
    private static <T> T firstNonNull(T a, T b) { return a != null ? a : b; }
    private static String firstNonBlank(String... values) { for (String value : values) if (value != null && !value.isBlank()) return value.trim(); return null; }
    private static String sha256(byte[] bytes) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); } catch (Exception ex) { throw new IllegalStateException(ex); } }
    private static ResponseStatusException badRequest(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private static ResponseStatusException forbidden(String message) { return new ResponseStatusException(HttpStatus.FORBIDDEN, message); }
    private static ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }
    private record PreviewParts(Map<String, InstrumentAlias> mappings, List<Mt5ImportPreviewResponse.UnmappedSymbol> unmapped,
                                int duplicates, int ready, List<String> warnings) {}
}
