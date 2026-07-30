package com.tradevault.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.InstrumentAlias;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.TradeImportBatch;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeImportStatus;
import com.tradevault.domain.enums.TradeSource;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.tradeimport.Trading212ImportCommitRequest;
import com.tradevault.dto.tradeimport.Trading212ImportCommitResponse;
import com.tradevault.dto.tradeimport.Trading212ImportPreviewResponse;
import com.tradevault.repository.AccountRepository;
import com.tradevault.repository.InstrumentAliasRepository;
import com.tradevault.repository.TradeImportBatchRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.service.trading212.Trading212ClosedPosition;
import com.tradevault.service.trading212.Trading212CsvParser;
import com.tradevault.service.trading212.Trading212ExternalIdentity;
import com.tradevault.service.trading212.Trading212ImportLockService;
import com.tradevault.service.trading212.Trading212ParsedReport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigDecimal;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class Trading212TradeImportService {
    private static final TradeSource SOURCE = TradeSource.TRADING212_CSV;
    private static final String BROKER = "Trading 212";
    private static final String BROKER_SERVER = "";

    private final CurrentUserService currentUserService;
    private final Trading212CsvParser parser;
    private final ObjectMapper objectMapper;
    private final TradeImportBatchRepository batchRepository;
    private final InstrumentAliasRepository aliasRepository;
    private final AccountRepository accountRepository;
    private final TradeRepository tradeRepository;
    private final Trading212ExternalIdentity externalIdentity;
    private final Trading212ImportLockService importLockService;

    @Value("${trade-import.trading212.max-file-size-mb:10}")
    private int maximumFileSizeMb = 10;
    @Value("${trade-import.trading212.max-rows:10000}")
    private int maximumRows = 10_000;

    @Transactional
    public Trading212ImportPreviewResponse preview(MultipartFile file, UUID targetAccountId) throws IOException {
        validateFile(file);
        User user = currentUserService.getCurrentUser();
        if (targetAccountId == null) {
            throw badRequest("Select the target TradeJAudit account before uploading a Trading 212 CSV");
        }
        Account target = ownedAccount(targetAccountId, user.getId());
        byte[] bytes = file.getBytes();
        Trading212ParsedReport report;
        try {
            report = parser.parse(bytes, maximumRows);
        } catch (RuntimeException ex) {
            log.warn("Trading 212 preview parse failed userId={} filename={} size={} reason={}",
                    user.getId(), safeFilename(file.getOriginalFilename()), bytes.length, ex.getMessage());
            throw ex;
        }
        TradeImportBatch batch = TradeImportBatch.builder()
                .user(user)
                .source(SOURCE)
                .originalFilename(safeFilename(file.getOriginalFilename()))
                .fileHash(sha256(bytes))
                .fileSize(bytes.length)
                .parserVersion(Trading212CsvParser.PARSER_VERSION)
                .accountCurrency(report.accountCurrency())
                .broker(BROKER)
                .sourceTimezone("UTC")
                .targetAccount(target)
                .status(TradeImportStatus.PREVIEW)
                .positionsFound(report.closedPositions().size())
                .ordersFound(0)
                .dealsFound(report.rows().size())
                .parsedPayload(objectMapper.valueToTree(report))
                .build();
        PreviewParts parts = buildPreviewParts(user, report, target);
        batch.setTradesReady(parts.ready());
        batch.setDuplicates(parts.duplicates());
        batch.setWarningCount(parts.warningCount());
        batch = batchRepository.save(batch);
        return toPreview(batch, report, parts);
    }

    @Transactional(readOnly = true)
    public Object details(UUID batchId) {
        User user = currentUserService.getCurrentUser();
        TradeImportBatch batch = ownedBatch(batchId, user.getId());
        if (batch.getStatus() != TradeImportStatus.PREVIEW) return batch.getResultPayload();
        Trading212ParsedReport report = objectMapper.convertValue(batch.getParsedPayload(), Trading212ParsedReport.class);
        return toPreview(batch, report, buildPreviewParts(user, report, batch.getTargetAccount()));
    }

    @Transactional
    public Trading212ImportCommitResponse commit(UUID batchId, Trading212ImportCommitRequest request) {
        User user = currentUserService.getCurrentUser();
        TradeImportBatch batch = ownedBatch(batchId, user.getId());
        if (batch.getStatus() != TradeImportStatus.PREVIEW && batch.getStatus() != TradeImportStatus.WARNING) {
            throw conflict("This import batch has already been committed");
        }
        Account account = ownedAccount(request.targetAccountId(), user.getId());
        Trading212ParsedReport report = objectMapper.convertValue(batch.getParsedPayload(), Trading212ParsedReport.class);
        Map<String, InstrumentAlias> mappings = resolveMappings(user, report.closedPositions(), request.symbolMappings());
        Set<String> selectedIdentities = request.selectedExternalTradeIds() == null
                ? Set.of()
                : request.selectedExternalTradeIds().stream().filter(Objects::nonNull).collect(Collectors.toSet());
        Set<String> legacySelectedPositions = request.selectedPositionIds() == null
                ? Set.of()
                : request.selectedPositionIds().stream().filter(Objects::nonNull).collect(Collectors.toSet());
        boolean selectAll = request.selectedExternalTradeIds() == null && request.selectedPositionIds() == null;
        Map<String, UUID> links = request.linkToExistingTradeIds() == null ? Map.of() : request.linkToExistingTradeIds();
        int created = 0;
        int updated = 0;
        int duplicates = 0;
        int parserDuplicatesInFile = (int) report.rows().stream()
                .filter(Trading212TradeImportService::isDuplicateRow).count();
        int duplicatesInFile = parserDuplicatesInFile;
        List<UUID> tradeIds = new ArrayList<>();
        List<String> warnings = new ArrayList<>(report.warnings());
        BigDecimal gross = BigDecimal.ZERO;
        BigDecimal net = BigDecimal.ZERO;
        BigDecimal skippedNet = BigDecimal.ZERO;

        if (currencyMismatch(account, report.accountCurrency())) {
            warnings.add("Trading 212 account currency " + report.accountCurrency()
                    + " differs from target account currency " + account.getAccountCurrency());
        }

        LinkedHashMap<String, Trading212ClosedPosition> selectedRows = new LinkedHashMap<>();
        for (Trading212ClosedPosition position : report.closedPositions()) {
            String identity = externalIdentity.resolve(account.getId(), position);
            boolean selected = selectAll
                    || selectedIdentities.contains(identity)
                    || legacySelectedPositions.contains(position.positionId());
            if (!selected) continue;
            if (selectedRows.putIfAbsent(identity, position) != null) {
                duplicatesInFile++;
                skippedNet = skippedNet.add(position.totalResult());
            }
        }

        importLockService.lockAll(account.getId(), selectedRows.keySet());
        Map<String, Trade> existingByIdentity = selectedRows.isEmpty()
                ? new HashMap<>()
                : tradeRepository.findByUserIdAndAccountIdAndSourceAndExternalTradeIdIn(
                                user.getId(), account.getId(), SOURCE, selectedRows.keySet())
                        .stream()
                        .collect(Collectors.toMap(Trade::getExternalTradeId, Function.identity(), (a, b) -> a));
        List<Trade> tradesToSave = new ArrayList<>();

        for (Map.Entry<String, Trading212ClosedPosition> selectedRow : selectedRows.entrySet()) {
            String identity = selectedRow.getKey();
            Trading212ClosedPosition position = selectedRow.getValue();
            InstrumentAlias mapping = mappings.get(key(position.symbol()));
            if (mapping == null) throw badRequest("Resolve symbol mapping for " + position.symbol());

            UUID linkedId = firstNonNull(links.get(identity), links.get(position.positionId()));
            Trade trade;
            boolean newTrade = false;
            boolean explicitLink = linkedId != null;
            if (explicitLink) {
                trade = tradeRepository.findByIdAndUserId(linkedId, user.getId())
                        .orElseThrow(() -> forbidden("The linked trade is not owned by the current user"));
                if (trade.getAccount() != null && !trade.getAccount().getId().equals(account.getId())) {
                    throw badRequest("The linked manual trade belongs to a different account");
                }
                if (trade.getSource() != null && trade.getSource() != TradeSource.MANUAL && trade.getSource() != SOURCE) {
                    throw conflict("The selected trade is already owned by another import source");
                }
            } else {
                Trade existing = existingByIdentity.get(identity);
                if (existing == null && position.orderId() == null) {
                    existing = findLegacyExternalTrade(user, account, position).orElse(null);
                }
                if (existing != null) {
                    duplicates++;
                    tradeIds.add(existing.getId());
                    skippedNet = skippedNet.add(position.totalResult());
                    warnings.addAll(position.warnings());
                    continue;
                }
                trade = Trade.builder().user(user).createdAt(OffsetDateTime.now()).build();
                newTrade = true;
            }

            applyBrokerFields(trade, account, batch, position, identity, mapping, newTrade);
            tradesToSave.add(trade);
            if (newTrade) created++; else updated++;
            gross = gross.add(position.result());
            net = net.add(position.totalResult());
            warnings.addAll(position.warnings());
        }

        if (!tradesToSave.isEmpty()) {
            tradeRepository.saveAll(tradesToSave).forEach(trade -> tradeIds.add(trade.getId()));
        }
        int selectedCount = selectedRows.size() + duplicatesInFile - parserDuplicatesInFile;
        int excluded = Math.max(0, report.closedPositions().size() - selectedCount);
        int invalidRows = (int) report.rows().stream()
                .filter(row -> row.supported() && !row.valid() && !isDuplicateRow(row))
                .count();
        BigDecimal costs = gross.subtract(net);
        List<String> distinctWarnings = warnings.stream().distinct().toList();
        TradeImportStatus status = distinctWarnings.isEmpty() ? TradeImportStatus.IMPORTED : TradeImportStatus.WARNING;
        OffsetDateTime importedAt = OffsetDateTime.now();
        Trading212ImportCommitResponse response = new Trading212ImportCommitResponse(
                batch.getId(), status, report.rows().size(), report.closedPositions().size(),
                created, updated, duplicates, duplicatesInFile, invalidRows, 0, excluded,
                account.getId(), account.getName(), batch.getOriginalFilename(), importedAt,
                gross, costs, net, skippedNet, tradeIds, distinctWarnings, List.of());
        batch.setTargetAccount(account);
        batch.setStatus(status);
        batch.setCreatedTrades(created);
        batch.setUpdatedTrades(updated);
        batch.setDuplicates(duplicates + duplicatesInFile);
        batch.setWarningCount(distinctWarnings.size());
        batch.setErrorCount(invalidRows);
        batch.setCompletedAt(importedAt);
        batch.setResultPayload(objectMapper.valueToTree(response));
        batchRepository.save(batch);
        log.info("Trading 212 import committed batchId={} userId={} targetAccountId={} created={} linked={} existing={} duplicateRows={} invalid={} excluded={} warnings={}",
                batch.getId(), user.getId(), account.getId(), created, updated, duplicates, duplicatesInFile,
                invalidRows, excluded, distinctWarnings.size());
        return response;
    }

    private PreviewParts buildPreviewParts(User user, Trading212ParsedReport report, Account account) {
        Map<String, InstrumentAlias> mappings = new HashMap<>();
        List<Trading212ImportPreviewResponse.UnmappedSymbol> unmapped = new ArrayList<>();
        report.closedPositions().stream()
                .collect(Collectors.toMap(p -> key(p.symbol()), Function.identity(), (a, b) -> a, LinkedHashMap::new))
                .values()
                .forEach(position -> {
                    List<InstrumentAlias> found = aliasRepository.findMappings(user.getId(), BROKER, BROKER_SERVER, position.symbol());
                    if (found.isEmpty()) {
                        unmapped.add(new Trading212ImportPreviewResponse.UnmappedSymbol(position.symbol(), position.symbol(),
                                position.instrument(), position.instrumentCurrency(), Market.CFD));
                    } else {
                        mappings.put(key(position.symbol()), found.get(0));
                    }
                });
        Map<Long, String> identities = report.closedPositions().stream().collect(Collectors.toMap(
                Trading212ClosedPosition::rowNumber,
                position -> externalIdentity.resolve(account.getId(), position)));
        Set<Long> duplicateRows = new HashSet<>();
        Set<String> seen = new HashSet<>();
        report.closedPositions().forEach(position -> {
            String identity = identities.get(position.rowNumber());
            if (!seen.add(identity)) duplicateRows.add(position.rowNumber());
        });
        Map<String, Trade> existing = identities.isEmpty()
                ? new HashMap<>()
                : tradeRepository.findByUserIdAndAccountIdAndSourceAndExternalTradeIdIn(
                                user.getId(), account.getId(), SOURCE, new HashSet<>(identities.values()))
                        .stream()
                        .collect(Collectors.toMap(Trade::getExternalTradeId, Function.identity(), (a, b) -> a));
        report.closedPositions().stream()
                .filter(position -> position.orderId() == null)
                .forEach(position -> findLegacyExternalTrade(user, account, position)
                        .ifPresent(trade -> existing.putIfAbsent(identities.get(position.rowNumber()), trade)));
        int duplicateCount = (int) report.closedPositions().stream()
                .filter(position -> existing.containsKey(identities.get(position.rowNumber()))).count();
        int ready = (int) report.closedPositions().stream()
                .filter(position -> mappings.containsKey(key(position.symbol()))).count();
        List<String> warnings = new ArrayList<>(report.warnings());
        if (account != null && currencyMismatch(account, report.accountCurrency())) {
            warnings.add("Trading 212 account currency " + report.accountCurrency()
                    + " differs from target account currency " + account.getAccountCurrency());
        }
        if (!unmapped.isEmpty()) warnings.add("Confirm all Trading 212 symbol and market mappings before importing");
        int rowWarnings = report.closedPositions().stream().mapToInt(position -> position.warnings().size()).sum();
        int parserDuplicates = (int) report.rows().stream().filter(Trading212TradeImportService::isDuplicateRow).count();
        return new PreviewParts(mappings, unmapped, identities, existing, duplicateRows,
                parserDuplicates + duplicateRows.size(),
                duplicateCount, ready, warnings, warnings.size() + rowWarnings);
    }

    private Trading212ImportPreviewResponse toPreview(TradeImportBatch batch, Trading212ParsedReport report, PreviewParts parts) {
        List<Trading212ImportPreviewResponse.TradePreview> trades = report.closedPositions().stream().map(position -> {
            InstrumentAlias mapping = parts.mappings().get(key(position.symbol()));
            String identity = parts.identities().get(position.rowNumber());
            Optional<Trade> existing = Optional.ofNullable(parts.existing().get(identity));
            List<Trading212ImportPreviewResponse.ManualMatch> matches =
                    manualMatches(batch.getUser(), batch.getTargetAccount(), position, mapping);
            return new Trading212ImportPreviewResponse.TradePreview(
                    position.positionId(), position.orderId(), identity, position.instrument(), position.symbol(),
                    mapping == null ? null : mapping.getInternalSymbol(), mapping == null ? null : mapping.getMarket(),
                    mapping == null ? position.instrumentCurrency() : mapping.getTradeCurrency(),
                    position.direction(), TradeStatus.CLOSED, position.openedAt(), position.closedAt(),
                    Duration.between(position.openedAt(), position.closedAt()).getSeconds(), position.units(),
                    position.averagePrice(), position.closePrice(), null, null, null, null,
                    position.result(), null, position.result().subtract(position.totalResult()), position.totalResult(),
                    position.accountCurrency(), position.instrumentCurrency(), position.exchangeRate(), position.spread(),
                    position.fxFee(), position.resultAfterFxFee(), position.overnightInterest(),
                    position.dividendAdjustment(), position.priceDerivedPnl(),
                    position.totalReconciliationDifference(), position.recordType(),
                    existing.isPresent() || parts.duplicateRows().contains(position.rowNumber()),
                    existing.map(Trade::getId).orElse(null), matches, position.warnings(), position.raw());
        }).toList();
        BigDecimal gross = sum(report.closedPositions(), Trading212ClosedPosition::result);
        BigDecimal net = sum(report.closedPositions(), Trading212ClosedPosition::totalResult);
        BigDecimal spread = sum(report.closedPositions(), Trading212ClosedPosition::spread);
        List<Trading212ImportPreviewResponse.UnsupportedRow> unsupported = report.rows().stream()
                .filter(row -> !row.valid())
                .map(row -> new Trading212ImportPreviewResponse.UnsupportedRow(
                        row.rowNumber(), row.recordType(), row.supported(), row.warnings(), row.errors()))
                .toList();
        int invalidRows = (int) report.rows().stream()
                .filter(row -> row.supported() && !row.valid() && !isDuplicateRow(row))
                .count();
        int unsupportedRows = (int) report.rows().stream().filter(row -> !row.supported()).count();
        return new Trading212ImportPreviewResponse(
                batch.getId(), batch.getStatus(),
                new Trading212ImportPreviewResponse.AccountMetadata(null, null, report.accountCurrency(), BROKER,
                        null, null, null, report.latestTimestamp() == null ? null : report.latestTimestamp().toString()),
                new Trading212ImportPreviewResponse.Summary(report.closedPositions().size(), 0, report.rows().size(),
                        unsupportedRows, parts.ready(), parts.duplicates(), parts.warningCount(), gross,
                        gross.subtract(net), net, unsupportedRows, invalidRows, parts.duplicatesInFile(), spread,
                        report.earliestTimestamp(), report.latestTimestamp()),
                "UTC", batch.getTargetAccount() == null ? null : batch.getTargetAccount().getId(),
                parts.unmapped(), trades, unsupported, parts.warnings().stream().distinct().toList(), List.of());
    }

    private List<Trading212ImportPreviewResponse.ManualMatch> manualMatches(
            User user, Account account, Trading212ClosedPosition position, InstrumentAlias mapping) {
        if (account == null) return List.of();
        String expectedSymbol = mapping == null ? position.symbol() : mapping.getInternalSymbol();
        return tradeRepository.findByUserId(user.getId()).stream()
                .filter(trade -> trade.getSource() == null || trade.getSource() == TradeSource.MANUAL)
                .filter(trade -> trade.getAccount() != null && account.getId().equals(trade.getAccount().getId()))
                .map(trade -> {
                    List<String> reasons = new ArrayList<>();
                    int confidence = 0;
                    if (equalsIgnoreCase(trade.getSymbol(), expectedSymbol)) { confidence += 20; reasons.add("same symbol"); }
                    if (trade.getDirection() == position.direction()) { confidence += 15; reasons.add("same direction"); }
                    if (same(trade.getQuantity(), position.units())) { confidence += 15; reasons.add("same quantity"); }
                    if (same(trade.getEntryPrice(), position.averagePrice())) { confidence += 15; reasons.add("same entry price"); }
                    if (same(trade.getExitPrice(), position.closePrice())) { confidence += 15; reasons.add("same exit price"); }
                    if (near(trade.getOpenedAt(), position.openedAt())) { confidence += 10; reasons.add("near opened time"); }
                    if (near(trade.getClosedAt(), position.closedAt())) { confidence += 10; reasons.add("near closed time"); }
                    return new Trading212ImportPreviewResponse.ManualMatch(trade.getId(), trade.getSymbol(), confidence,
                            String.join(", ", reasons) + "; linking always requires confirmation");
                })
                .filter(match -> match.confidence() >= 60)
                .sorted(Comparator.comparingInt(Trading212ImportPreviewResponse.ManualMatch::confidence).reversed())
                .limit(3)
                .toList();
    }

    private Map<String, InstrumentAlias> resolveMappings(
            User user, List<Trading212ClosedPosition> positions, List<Trading212ImportCommitRequest.SymbolMapping> supplied) {
        Map<String, Trading212ImportCommitRequest.SymbolMapping> suppliedBySymbol = supplied == null ? Map.of()
                : supplied.stream().collect(Collectors.toMap(mapping -> key(mapping.externalSymbol()),
                Function.identity(), (a, b) -> b));
        Map<String, InstrumentAlias> result = new HashMap<>();
        positions.stream().collect(Collectors.toMap(p -> key(p.symbol()), Function.identity(), (a, b) -> a))
                .values().forEach(position -> {
                    Trading212ImportCommitRequest.SymbolMapping input = suppliedBySymbol.get(key(position.symbol()));
                    InstrumentAlias alias;
                    if (input != null) {
                        alias = aliasRepository.findOwned(user.getId(), BROKER, BROKER_SERVER, position.symbol())
                                .orElseGet(InstrumentAlias::new);
                        alias.setUser(user);
                        alias.setBroker(BROKER);
                        alias.setBrokerServer(BROKER_SERVER);
                        alias.setExternalSymbol(position.symbol());
                        alias.setExternalInstrumentName(position.instrument());
                        alias.setInternalSymbol(input.internalSymbol().trim());
                        alias.setMarket(input.market());
                        alias.setTradeCurrency(input.tradeCurrency().trim().toUpperCase(Locale.ROOT));
                        alias.setTickSize(input.tickSize());
                        alias.setTickValue(input.tickValue());
                        alias.setPointValue(input.pointValue());
                        alias.setContractMultiplier(input.contractMultiplier());
                        alias.setActive(true);
                        if (input.saveForFuture()) alias = aliasRepository.save(alias);
                    } else {
                        alias = aliasRepository.findMappings(user.getId(), BROKER, BROKER_SERVER, position.symbol())
                                .stream().findFirst().orElse(null);
                    }
                    if (alias != null) result.put(key(position.symbol()), alias);
                });
        return result;
    }

    private void applyBrokerFields(Trade trade, Account account, TradeImportBatch batch,
                                   Trading212ClosedPosition position, String identity,
                                   InstrumentAlias mapping, boolean isNew) {
        OffsetDateTime now = OffsetDateTime.now();
        trade.setUser(batch.getUser());
        trade.setAccount(account);
        trade.setSource(SOURCE);
        trade.setExternalPositionId(position.positionId());
        trade.setExternalOrderId(position.orderId());
        trade.setExternalTradeId(identity);
        trade.setExternalInstrumentName(position.instrument());
        trade.setExternalSymbol(position.symbol());
        trade.setSourceBroker(BROKER);
        trade.setSourceBrokerServer(BROKER_SERVER);
        trade.setSourceTimezone("UTC");
        trade.setAccountCurrency(position.accountCurrency());
        trade.setBrokerReportedPnlCurrency(position.accountCurrency());
        trade.setSourceRecordedAt(position.recordDate());
        trade.setSymbol(mapping.getInternalSymbol());
        trade.setMarket(mapping.getMarket());
        trade.setTradeCurrency(mapping.getTradeCurrency());
        trade.setDirection(position.direction());
        trade.setStatus(TradeStatus.CLOSED);
        trade.setOpenedAt(position.openedAt());
        trade.setClosedAt(position.closedAt());
        trade.setQuantity(position.units());
        trade.setEntryPrice(position.averagePrice());
        trade.setExitPrice(position.closePrice());
        trade.setContractMultiplier(firstNonNull(mapping.getContractMultiplier(), BigDecimal.ONE));
        trade.setPnlGross(position.result());
        trade.setPnlNet(position.totalResult());
        trade.setBrokerReportedGrossPnl(position.result());
        trade.setBrokerReportedResultAfterFxFee(position.resultAfterFxFee());
        trade.setBrokerReportedNetPnl(position.totalResult());
        trade.setCalculatedGrossPnl(position.priceDerivedPnl());
        trade.setCalculatedNetPnl(position.priceDerivedPnl()
                .add(zero(position.overnightInterest())).add(zero(position.dividendAdjustment())));
        trade.setPnlReconciliationDifference(position.totalReconciliationDifference());
        trade.setSourceExchangeRate(position.exchangeRate());
        trade.setBrokerReportedSpread(position.spread());
        trade.setFxFee(position.fxFee());
        trade.setOvernightInterest(position.overnightInterest());
        trade.setDividendAdjustment(position.dividendAdjustment());
        trade.setImportBatchId(batch.getId());
        trade.setImportStatus(TradeImportStatus.NEEDS_REVIEW);
        if (trade.getImportedAt() == null) trade.setImportedAt(now);
        trade.setLastSynchronizedAt(now);
        trade.setUpdatedAt(now);
        String profileCurrency = normalizeCurrency(trade.getProfileCurrency());
        if (isNew) {
            trade.setCreatedAt(now);
            profileCurrency = normalizeCurrency(batch.getUser().getBaseCurrency());
            trade.setProfileCurrency(profileCurrency);
        }
        if (profileCurrency != null && profileCurrency.equalsIgnoreCase(position.accountCurrency())) {
            trade.setPnlProfileCurrency(position.totalResult());
            if (profileCurrency.equalsIgnoreCase(mapping.getTradeCurrency())) {
                trade.setFxRateTradeToProfile(BigDecimal.ONE);
                trade.setFxRateSource("IDENTITY");
                trade.setFxRateTimestamp(position.closedAt());
            }
        }
    }

    private Optional<Trade> findLegacyExternalTrade(User user, Account account, Trading212ClosedPosition position) {
        if (position.orderId() != null) return Optional.empty();
        return tradeRepository.findByUserIdAndAccountIdAndSourceAndExternalPositionId(
                        user.getId(), account.getId(), SOURCE, position.positionId())
                .filter(trade -> trade.getExternalTradeId() == null);
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) throw badRequest("A Trading 212 CSV report is required");
        String filename = safeFilename(file.getOriginalFilename()).toLowerCase(Locale.ROOT);
        if (!filename.endsWith(".csv")) throw badRequest("Only .csv Trading 212 reports are accepted");
        long maximumBytes = Math.max(1, maximumFileSizeMb) * 1024L * 1024L;
        if (file.getSize() > maximumBytes) {
            throw badRequest("The Trading 212 report exceeds the " + Math.max(1, maximumFileSizeMb) + " MB limit");
        }
        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank()
                && !Set.of("text/csv", "text/plain", "application/csv", "application/vnd.ms-excel",
                        "application/octet-stream").contains(contentType.toLowerCase(Locale.ROOT))) {
            throw badRequest("The uploaded file content type is not supported for Trading 212 CSV");
        }
    }

    private Account ownedAccount(UUID id, UUID userId) {
        return accountRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> forbidden("Target account not found"));
    }

    private TradeImportBatch ownedBatch(UUID id, UUID userId) {
        TradeImportBatch batch = batchRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> forbidden("Import batch not found"));
        if (batch.getSource() != SOURCE) throw badRequest("Import batch is not a Trading 212 CSV batch");
        return batch;
    }

    private static boolean currencyMismatch(Account account, String sourceCurrency) {
        return account != null && account.getAccountCurrency() != null && sourceCurrency != null
                && !account.getAccountCurrency().equalsIgnoreCase(sourceCurrency);
    }

    private static <T> BigDecimal sum(Collection<T> values, Function<T, BigDecimal> mapper) {
        return values.stream().map(mapper).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static String safeFilename(String value) {
        String name = value == null ? "trading212.csv" : value.replace('\\', '/');
        int slash = name.lastIndexOf('/');
        return (slash >= 0 ? name.substring(slash + 1) : name).replaceAll("[\\r\\n]", "_");
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static String key(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean equalsIgnoreCase(String a, String b) {
        return a == null ? b == null : b != null && a.equalsIgnoreCase(b);
    }

    private static boolean same(BigDecimal a, BigDecimal b) {
        return a != null && b != null && a.compareTo(b) == 0;
    }

    private static boolean near(OffsetDateTime a, OffsetDateTime b) {
        return a != null && b != null && Math.abs(Duration.between(a, b).toMinutes()) <= 5;
    }

    private static BigDecimal zero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static <T> T firstNonNull(T a, T b) {
        return a != null ? a : b;
    }

    private static String normalizeCurrency(String value) {
        return value == null || value.isBlank() ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    private static boolean isDuplicateRow(Trading212ParsedReport.SourceRow row) {
        return row.errors().stream().anyMatch(error -> error.startsWith("Duplicate Trading 212 Order ID"));
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static ResponseStatusException forbidden(String message) {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, message);
    }

    private static ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }

    private record PreviewParts(
            Map<String, InstrumentAlias> mappings,
            List<Trading212ImportPreviewResponse.UnmappedSymbol> unmapped,
            Map<Long, String> identities,
            Map<String, Trade> existing,
            Set<Long> duplicateRows,
            int duplicatesInFile,
            int duplicates,
            int ready,
            List<String> warnings,
            int warningCount
    ) {
    }
}
