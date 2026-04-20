package com.tradevault.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.Tag;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.entity.UserStrategy;
import com.tradevault.domain.enums.Direction;
import com.tradevault.dto.trade.DailyAccountSummaryResponse;
import com.tradevault.dto.trade.ImportedTradeCandidate;
import com.tradevault.dto.trade.TradeRequest;
import com.tradevault.dto.trade.TradeResponse;
import com.tradevault.exception.TradeSearchValidationException;
import com.tradevault.repository.AccountRepository;
import com.tradevault.repository.TagRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.repository.UserStrategyRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TradeService {
    private static final Logger log = LoggerFactory.getLogger(TradeService.class);
    private static final DateTimeFormatter DATE_ONLY_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter OFFSET_DATE_TIME_FORMATTER = DateTimeFormatter.ISO_OFFSET_DATE_TIME;
    private static final DateTimeFormatter LOCAL_DATE_TIME_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    private static final String DEFAULT_CURRENCY = "USD";
    private static final String FX_SOURCE_IDENTITY = "IDENTITY";
    private static final String FX_SOURCE_MANUAL = "MANUAL";
    private final TradeRepository tradeRepository;
    private final AccountRepository accountRepository;
    private final TagRepository tagRepository;
    private final UserStrategyRepository userStrategyRepository;
    private final CurrentUserService currentUserService;
    private final TimezoneService timezoneService;

    public Page<TradeResponse> search(int page, int size,
                                      String openedAtFromRaw,
                                      String openedAtToRaw,
                                      OffsetDateTime closedAtFrom,
                                      OffsetDateTime closedAtTo,
                                      LocalDate closedDate,
                                      String tz,
                                      String symbol,
                                      String strategy,
                                      String accountId,
                                      Direction direction,
                                      com.tradevault.domain.enums.TradeStatus status) {
        User user = currentUserService.getCurrentUser();
        ZoneId zone = timezoneService.resolveZone(tz, user);
        OffsetDateTime openedAtFrom = parseDateTimeFilter(openedAtFromRaw, zone, false, "openedAtFrom");
        OffsetDateTime openedAtTo = parseDateTimeFilter(openedAtToRaw, zone, true, "openedAtTo");
        AccountFilter accountFilter = resolveAccountFilter(accountId);
        logSearchParams(symbol, strategy);
        var pageable = PageRequest.of(Math.max(page, 0), size, Sort.by(Sort.Direction.DESC, "openedAt", "createdAt"));
        var normalizedSymbol = normalizeSearchToken(symbol);
        var normalizedStrategy = normalizeSearchToken(strategy);
        if (closedDate != null) {
            closedAtFrom = closedDate.atStartOfDay(zone).toOffsetDateTime();
            closedAtTo = closedDate.plusDays(1).atStartOfDay(zone).minusNanos(1).toOffsetDateTime();
        }
        validateDateRange(openedAtFrom, openedAtTo, "openedAtFrom", "openedAtTo");
        validateDateRange(closedAtFrom, closedAtTo, "closedAtFrom", "closedAtTo");

        Page<UUID> idPage = tradeRepository.searchTradeIds(
                user.getId(),
                openedAtFrom,
                openedAtTo,
                closedAtFrom,
                closedAtTo,
                normalizedSymbol,
                normalizedStrategy,
                accountFilter.brokerAccountId(),
                accountFilter.accountRefId(),
                direction,
                status,
                pageable
        );

        if (idPage.isEmpty()) {
            return new org.springframework.data.domain.PageImpl<>(List.of(), pageable, idPage.getTotalElements());
        }

        List<Trade> trades = loadTradesInOrderWithTagsAndAccount(idPage.getContent());
        Map<UUID, String> strategyNames = loadStrategyNames(trades, user.getId());
        List<TradeResponse> responses = trades.stream()
                .map(trade -> toResponse(trade, strategyNames))
                .toList();
        return new org.springframework.data.domain.PageImpl<>(responses, pageable, idPage.getTotalElements());
    }

    private OffsetDateTime parseDateTimeFilter(String rawValue, ZoneId zone, boolean endOfDayForDateOnly, String fieldName) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }
        String value = rawValue.trim();
        try {
            if (value.length() == 10) {
                LocalDate date = LocalDate.parse(value, DATE_ONLY_FORMATTER);
                if (endOfDayForDateOnly) {
                    return date.plusDays(1).atStartOfDay(zone).minusNanos(1).toOffsetDateTime();
                }
                return date.atStartOfDay(zone).toOffsetDateTime();
            }
            return OffsetDateTime.parse(value, OFFSET_DATE_TIME_FORMATTER);
        } catch (DateTimeParseException ex) {
            try {
                LocalDateTime localDateTime = LocalDateTime.parse(value, LOCAL_DATE_TIME_FORMATTER);
                return localDateTime.atZone(zone).toOffsetDateTime();
            } catch (DateTimeParseException ignored) {
                throw invalidDateTimeFormat(fieldName, rawValue);
            }
        }
    }

    private void validateDateRange(OffsetDateTime from, OffsetDateTime to, String fromField, String toField) {
        if (from == null || to == null || !from.isAfter(to)) {
            return;
        }
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("fieldErrors", List.of(
                Map.of("field", fromField, "message", "Must be before or equal to " + toField),
                Map.of("field", toField, "message", "Must be after or equal to " + fromField)
        ));
        throw new TradeSearchValidationException(
                "Invalid date range: '%s' must be before or equal to '%s'.".formatted(fromField, toField),
                details
        );
    }

    private TradeSearchValidationException invalidDateTimeFormat(String fieldName, String rawValue) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("fieldErrors", List.of(
                Map.of("field", fieldName, "message", "Expected YYYY-MM-DD or ISO date-time")
        ));
        details.put("received", rawValue);
        return new TradeSearchValidationException(
                "Invalid date format for '%s' (expected YYYY-MM-DD or ISO date-time)".formatted(fieldName),
                details
        );
    }

    private static String normalizeSearchToken(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isBlank()) {
            return null;
        }
        return trimmed.toLowerCase(Locale.ROOT);
    }

    private void logSearchParams(String symbol, String strategy) {
        if (!log.isDebugEnabled()) {
            return;
        }
        log.debug("[TradeSearch] symbolType={}, strategyType={}, symbolValue={}, strategyValue={}",
                typeName(symbol), typeName(strategy), safeParamValue(symbol), safeParamValue(strategy));
    }

    private static String typeName(Object value) {
        return value == null ? "null" : value.getClass().getName();
    }

    private static String safeParamValue(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.length() > 64) {
            trimmed = trimmed.substring(0, 64) + "...";
        }
        return "'" + trimmed + "'";
    }

    public Page<TradeResponse> listAll(int page, int size) {
        User user = currentUserService.getCurrentUser();
        var pageable = PageRequest.of(Math.max(page, 0), size, Sort.by(Sort.Direction.DESC, "openedAt", "createdAt"));
        Page<UUID> tradeIdsPage = tradeRepository.findTradeIdsForList(user.getId(), pageable);
        if (tradeIdsPage.isEmpty()) {
            return new org.springframework.data.domain.PageImpl<>(List.of(), pageable, tradeIdsPage.getTotalElements());
        }

        List<UUID> orderedIds = tradeIdsPage.getContent();
        List<Trade> trades = loadTradesInOrderWithTagsAndAccount(orderedIds);
        Map<UUID, String> strategyNames = loadStrategyNames(trades, user.getId());
        List<TradeResponse> responses = trades.stream()
                .map(trade -> toResponse(trade, strategyNames))
                .toList();

        return new org.springframework.data.domain.PageImpl<>(responses, pageable, tradeIdsPage.getTotalElements());
    }

    public TradeResponse getById(UUID id) {
        User user = currentUserService.getCurrentUser();
        Trade trade = tradeRepository.findByIdAndUserIdWithTagsAndAccount(id, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Trade not found"));
        return toResponse(trade, loadStrategyNames(List.of(trade), user.getId()));
    }

    @Transactional
    public TradeResponse create(TradeRequest request) {
        User user = currentUserService.getCurrentUser();
        validateClosedTrade(request);
        Trade trade = new Trade();
        trade.setUser(user);
        trade.setBrokerAccountId(normalizeOptionalText(request.getAccountId()));
        trade.setSymbol(request.getSymbol());
        trade.setMarket(request.getMarket());
        trade.setDirection(request.getDirection());
        trade.setStatus(request.getStatus());
        trade.setOpenedAt(request.getOpenedAt());
        trade.setClosedAt(request.getClosedAt());
        trade.setQuantity(request.getQuantity());
        trade.setEntryPrice(request.getEntryPrice());
        trade.setExitPrice(request.getExitPrice());
        trade.setStopLossPrice(request.getStopLossPrice());
        trade.setTakeProfitPrice(request.getTakeProfitPrice());
        trade.setFees(defaultZero(request.getFees()));
        trade.setCommission(defaultZero(request.getCommission()));
        trade.setSlippage(defaultZero(request.getSlippage()));
        trade.setContractMultiplier(defaultOne(request.getContractMultiplier()));
        trade.setFeesProfileCurrency(defaultZero(request.getFeesProfileCurrency()));
        // Do NOT trust client-provided PnL values on create; compute authoritatively below
        trade.setRiskAmount(request.getRiskAmount());
        trade.setCapitalUsed(request.getCapitalUsed());
        trade.setTimeframe(request.getTimeframe());
        trade.setSetup(request.getSetup());
        trade.setStrategyTag(request.getStrategyTag());
        trade.setCatalystTag(request.getCatalystTag());
        trade.setStrategyId(requireOwnedStrategyId(request.getStrategyId(), user.getId()));
        trade.setStrategyVersionId(request.getStrategyVersionId());
        trade.setContextSnapshotId(request.getContextSnapshotId());
        trade.setSetupGrade(request.getSetupGrade());
        trade.setSession(request.getSession());
        trade.setSessionId(request.getSessionId());
        trade.setSetupId(request.getSetupId());
        trade.setSweepLevelId(request.getSweepLevelId());
        trade.setSweepPoolId(request.getSweepPoolId());
        trade.setEntryLevelId(request.getEntryLevelId());
        trade.setSlLevelId(request.getSlLevelId());
        trade.setTpLevelId(request.getTpLevelId());
        trade.setNarrativeSnapshotJson(resolveNarrativeSnapshot(request.getNarrativeSnapshotJson(), null));
        trade.setSweepConfirmed(request.getSweepConfirmed());
        trade.setDisplacementConfirmed(request.getDisplacementConfirmed());
        trade.setMssConfirmed(request.getMssConfirmed());
        trade.setSweepDepthPoints(request.getSweepDepthPoints());
        trade.setDisplacementSizePoints(request.getDisplacementSizePoints());
        trade.setTimeSweepToEntrySeconds(request.getTimeSweepToEntrySeconds());
        trade.setMfePoints(request.getMfePoints());
        trade.setMaePoints(request.getMaePoints());
        trade.setLevelExpectationMet(request.getLevelExpectationMet());
        trade.setLevelExpectation(normalizeOptionalText(request.getLevelExpectation()));
        trade.setFeeling(normalizeFeeling(request.getFeeling()));
        trade.setRuleBreaks(normalizeRuleBreaks(request.getRuleBreaks()));
        trade.setLinkedContentIds(normalizeLinkedContentIds(request.getLinkedContentIds()));
        trade.setLinkedPlanIds(normalizeLinkedPlanIds(request.getLinkedPlanIds()));
        trade.setNotes(request.getNotes());
        trade.setInitialNotes(request.getInitialNotes());
        trade.setEntryJournalText(normalizeOptionalText(request.getEntryJournalText()));
        trade.setEntryInvalidation(normalizeOptionalText(request.getEntryInvalidation()));
        trade.setEntryScreenshotAssetIds(normalizeLinkedAssetIds(request.getEntryScreenshotAssetIds()));
        trade.setCreatedAt(OffsetDateTime.now());
        trade.setUpdatedAt(trade.getCreatedAt());
        applyCurrencyContextForCreate(trade, request, user);
        trade.setAccount(resolveAccount(request, user));
        if (request.getTagIds() != null && !request.getTagIds().isEmpty()) {
            Set<Tag> tags = tagRepository.findByIdInAndUserId(request.getTagIds(), user.getId()).stream()
                    .collect(Collectors.toSet());
            trade.setTags(tags);
        }
        // Always compute authoritative derived metrics on create
        recalculateRiskPercent(trade);
        recalculateAndApplyPnl(trade);
        recalculateProfileCurrencyAmounts(trade);
        logNarrativeSnapshotState("create", trade.getId(), trade.getStatus(), request.getNarrativeSnapshotJson(), null, trade.getNarrativeSnapshotJson());
        Trade savedTrade = tradeRepository.save(trade);
        return toResponse(savedTrade, loadStrategyNames(List.of(savedTrade), user.getId()));
    }

    @Transactional
    public TradeResponse update(UUID id, TradeRequest request) {
        User user = currentUserService.getCurrentUser();
        Trade trade = tradeRepository.findByIdAndUserId(id, user.getId()).orElseThrow(() -> new EntityNotFoundException("Trade not found"));
        validateClosedTrade(request);
        boolean shouldRecalculate = pnlInputsChanged(trade, request);

        // Map incoming fields onto entity (do not trust client-provided PnL values)
        trade.setBrokerAccountId(normalizeOptionalText(request.getAccountId()));
        trade.setSymbol(request.getSymbol());
        trade.setMarket(request.getMarket());
        trade.setDirection(request.getDirection());
        trade.setStatus(request.getStatus());
        trade.setOpenedAt(request.getOpenedAt());
        trade.setClosedAt(request.getClosedAt());
        trade.setQuantity(request.getQuantity());
        trade.setEntryPrice(request.getEntryPrice());
        trade.setExitPrice(request.getExitPrice());
        trade.setStopLossPrice(request.getStopLossPrice());
        trade.setTakeProfitPrice(request.getTakeProfitPrice());
        trade.setFees(defaultZero(request.getFees()));
        trade.setCommission(defaultZero(request.getCommission()));
        trade.setSlippage(defaultZero(request.getSlippage()));
        trade.setContractMultiplier(defaultOne(request.getContractMultiplier()));
        trade.setFeesProfileCurrency(defaultZero(request.getFeesProfileCurrency()));
        // Never accept client PnL fields on update; we'll recompute if needed
        trade.setRiskAmount(request.getRiskAmount());
        trade.setCapitalUsed(request.getCapitalUsed());
        trade.setTimeframe(request.getTimeframe());
        trade.setSetup(request.getSetup());
        trade.setStrategyTag(request.getStrategyTag());
        trade.setCatalystTag(request.getCatalystTag());
        trade.setStrategyId(requireOwnedStrategyId(request.getStrategyId(), user.getId()));
        trade.setStrategyVersionId(request.getStrategyVersionId());
        trade.setContextSnapshotId(request.getContextSnapshotId());
        trade.setSetupGrade(request.getSetupGrade());
        trade.setSession(request.getSession());
        trade.setSessionId(request.getSessionId());
        trade.setSetupId(request.getSetupId());
        trade.setSweepLevelId(request.getSweepLevelId());
        trade.setSweepPoolId(request.getSweepPoolId());
        trade.setEntryLevelId(request.getEntryLevelId());
        trade.setSlLevelId(request.getSlLevelId());
        trade.setTpLevelId(request.getTpLevelId());
        JsonNode previousNarrativeSnapshot = trade.getNarrativeSnapshotJson();
        trade.setNarrativeSnapshotJson(resolveNarrativeSnapshot(request.getNarrativeSnapshotJson(), previousNarrativeSnapshot));
        trade.setSweepConfirmed(request.getSweepConfirmed());
        trade.setDisplacementConfirmed(request.getDisplacementConfirmed());
        trade.setMssConfirmed(request.getMssConfirmed());
        trade.setSweepDepthPoints(request.getSweepDepthPoints());
        trade.setDisplacementSizePoints(request.getDisplacementSizePoints());
        trade.setTimeSweepToEntrySeconds(request.getTimeSweepToEntrySeconds());
        trade.setMfePoints(request.getMfePoints());
        trade.setMaePoints(request.getMaePoints());
        trade.setLevelExpectationMet(request.getLevelExpectationMet());
        trade.setLevelExpectation(normalizeOptionalText(request.getLevelExpectation()));
        trade.setFeeling(normalizeFeeling(request.getFeeling()));
        if (request.getRuleBreaks() != null) {
            trade.setRuleBreaks(normalizeRuleBreaks(request.getRuleBreaks()));
        } else if (trade.getRuleBreaks() == null) {
            trade.setRuleBreaks(new LinkedHashSet<>());
        }
        if (request.getLinkedContentIds() != null) {
            trade.setLinkedContentIds(normalizeLinkedContentIds(request.getLinkedContentIds()));
        } else if (trade.getLinkedContentIds() == null) {
            trade.setLinkedContentIds(new LinkedHashSet<>());
        }
        if (request.getLinkedPlanIds() != null) {
            trade.setLinkedPlanIds(normalizeLinkedPlanIds(request.getLinkedPlanIds()));
        } else if (trade.getLinkedPlanIds() == null) {
            trade.setLinkedPlanIds(new LinkedHashSet<>());
        }
        trade.setNotes(request.getNotes());
        if (request.getInitialNotes() != null) {
            trade.setInitialNotes(request.getInitialNotes());
        }
        if (request.getEntryJournalText() != null) {
            trade.setEntryJournalText(normalizeOptionalText(request.getEntryJournalText()));
        }
        if (request.getEntryInvalidation() != null) {
            trade.setEntryInvalidation(normalizeOptionalText(request.getEntryInvalidation()));
        }
        if (request.getEntryScreenshotAssetIds() != null) {
            trade.setEntryScreenshotAssetIds(normalizeLinkedAssetIds(request.getEntryScreenshotAssetIds()));
        } else if (trade.getEntryScreenshotAssetIds() == null) {
            trade.setEntryScreenshotAssetIds(new LinkedHashSet<>());
        }
        applyCurrencyContextForUpdate(trade, request, user);
        trade.setAccount(resolveAccount(request, user));
        if (request.getTagIds() != null) {
            Set<Tag> tags = tagRepository.findByIdInAndUserId(request.getTagIds(), user.getId()).stream()
                    .collect(Collectors.toSet());
            trade.setTags(tags);
        }

        recalculateRiskPercent(trade);
        if (shouldRecalculate) {
            recalculateAndApplyPnl(trade);
        }
        recalculateProfileCurrencyAmounts(trade);
        trade.setUpdatedAt(OffsetDateTime.now());
        logNarrativeSnapshotState("update", trade.getId(), trade.getStatus(), request.getNarrativeSnapshotJson(), previousNarrativeSnapshot, trade.getNarrativeSnapshotJson());
        Trade savedTrade = tradeRepository.save(trade);
        return toResponse(savedTrade, loadStrategyNames(List.of(savedTrade), user.getId()));
    }

    @Transactional
    public ImportUpsertResult upsertImportedTrade(ImportedTradeCandidate candidate) {
        User user = currentUserService.getCurrentUser();
        Optional<Trade> existing = findExistingImportedTrade(user.getId(), candidate);
        TradeRequest request = existing.map(this::copyTradeToRequest).orElseGet(TradeRequest::new);
        applyImportedCandidate(request, candidate);
        if (existing.isPresent()) {
            return new ImportUpsertResult(update(existing.get().getId(), request), true);
        }
        return new ImportUpsertResult(create(request), false);
    }

    @Transactional
    public TradeResponse updateEntryJournal(UUID id,
                                            String entryJournalText,
                                            String entryInvalidation,
                                            String feeling,
                                            Set<UUID> entryScreenshotAssetIds) {
        User user = currentUserService.getCurrentUser();
        Trade trade = tradeRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Trade not found"));
        trade.setEntryJournalText(normalizeOptionalText(entryJournalText));
        trade.setEntryInvalidation(normalizeOptionalText(entryInvalidation));
        trade.setFeeling(normalizeFeeling(feeling));
        trade.setEntryScreenshotAssetIds(normalizeLinkedAssetIds(entryScreenshotAssetIds));
        trade.setUpdatedAt(OffsetDateTime.now());
        Trade savedTrade = tradeRepository.save(trade);
        return toResponse(savedTrade, loadStrategyNames(List.of(savedTrade), user.getId()));
    }

    public void delete(UUID id) {
        User user = currentUserService.getCurrentUser();
        Trade trade = tradeRepository.findByIdAndUserId(id, user.getId()).orElseThrow(() -> new EntityNotFoundException("Trade not found"));
        tradeRepository.delete(trade);
    }

    public java.util.List<TradeResponse> listClosedTradesByDate(LocalDate date, String tz, String accountId) {
        User user = currentUserService.getCurrentUser();
        ZoneId zone = timezoneService.resolveZone(tz, user);
        AccountFilter accountFilter = resolveAccountFilter(accountId);
        //log.info("[CALENDAR] listClosedTradesByDate userId={}, date={}, tz={}", user.getId(), date, zone.getId());
        List<UUID> tradeIds = tradeRepository.findClosedTradeIdsForLocalDate(
                user.getId(),
                date,
                zone.getId(),
                accountFilter.brokerAccountId(),
                accountFilter.accountRefId()
        );
        var trades = loadTradesInOrderWithTagsAndAccount(tradeIds);
        //log.info("[CALENDAR] listClosedTradesByDate result size={}", (trades != null ? trades.size() : 0));
        return trades
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public com.tradevault.dto.trade.DailySummaryResponse dailySummary(LocalDate date, String tz, String accountId) {
        User user = currentUserService.getCurrentUser();
        ZoneId zone = timezoneService.resolveZone(tz, user);
        AccountFilter accountFilter = resolveAccountFilter(accountId);
        List<UUID> tradeIds = tradeRepository.findClosedTradeIdsForLocalDate(
                user.getId(),
                date,
                zone.getId(),
                accountFilter.brokerAccountId(),
                accountFilter.accountRefId()
        );
        var trades = loadTradesInOrderWithTagsAndAccount(tradeIds);
        if (trades == null || trades.isEmpty()) {
            return com.tradevault.dto.trade.DailySummaryResponse.builder()
                    .date(date)
                    .netPnl(BigDecimal.ZERO)
                    .tradeCount(0)
                    .winners(0)
                    .losers(0)
                    .winRate(0)
                    .equityPoints(List.of())
                    .accounts(List.of())
                    .build();
        }
        BigDecimal netPnl = trades.stream()
                .map(Trade::getPnlNet)
                .filter(pnl -> pnl != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long winners = trades.stream().filter(t -> t.getPnlNet() != null && t.getPnlNet().compareTo(BigDecimal.ZERO) > 0).count();
        long losers = trades.stream().filter(t -> t.getPnlNet() != null && t.getPnlNet().compareTo(BigDecimal.ZERO) < 0).count();
        long tradeCount = trades.size();
        double winRate = tradeCount == 0 ? 0 : (double) winners / (double) tradeCount;
        List<BigDecimal> equityPoints = new java.util.ArrayList<>();
        BigDecimal running = BigDecimal.ZERO;
        for (Trade trade : trades) {
            BigDecimal pnl = trade.getPnlNet() == null ? BigDecimal.ZERO : trade.getPnlNet();
            running = running.add(pnl);
            equityPoints.add(running);
        }
        List<DailyAccountSummaryResponse> accountSummaries = trades.stream()
                .collect(Collectors.groupingBy(
                        this::resolvedDisplayAccountId,
                        LinkedHashMap::new,
                        Collectors.toList()
                ))
                .entrySet()
                .stream()
                .map(entry -> buildDailyAccountSummary(entry.getKey(), entry.getValue()))
                .toList();
        return com.tradevault.dto.trade.DailySummaryResponse.builder()
                .date(date)
                .netPnl(netPnl)
                .tradeCount(tradeCount)
                .winners(winners)
                .losers(losers)
                .winRate(winRate)
                .equityPoints(equityPoints)
                .accounts(accountSummaries)
                .build();
    }

    public java.util.List<TradeResponse> listLosses(LocalDate from, LocalDate to, String tz, BigDecimal minLoss) {
        User user = currentUserService.getCurrentUser();
        ZoneId zone = timezoneService.resolveZone(tz, user);
        OffsetDateTime fromDateTime = from.atStartOfDay(zone).toOffsetDateTime();
        OffsetDateTime toDateTime = to.plusDays(1).atStartOfDay(zone).minusNanos(1).toOffsetDateTime();
        BigDecimal threshold = minLoss == null ? BigDecimal.ZERO : minLoss;
        List<UUID> tradeIds = tradeRepository.findLossTradeIdsInRange(
                user.getId(),
                fromDateTime,
                toDateTime,
                com.tradevault.domain.enums.TradeStatus.CLOSED,
                threshold.negate()
        );
        return loadTradesInOrderWithTagsAndAccount(tradeIds).stream()
                .map(this::toResponse)
                .toList();
    }

    private List<Trade> loadTradesInOrderWithTagsAndAccount(List<UUID> orderedIds) {
        if (orderedIds == null || orderedIds.isEmpty()) {
            return List.of();
        }

        Map<UUID, Trade> tradesById = tradeRepository.findAllByIdInWithTagsAndAccount(orderedIds).stream()
                .collect(Collectors.toMap(Trade::getId, Function.identity(), (left, right) -> left));

        return orderedIds.stream()
                .map(tradesById::get)
                .filter(Objects::nonNull)
                .toList();
    }

    private Map<UUID, String> loadStrategyNames(List<Trade> trades, UUID userId) {
        if (trades == null || trades.isEmpty()) {
            return Map.of();
        }
        List<UUID> strategyIds = trades.stream()
                .map(Trade::getStrategyId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (strategyIds.isEmpty()) {
            return Map.of();
        }
        return userStrategyRepository.findByIdInAndUser_Id(strategyIds, userId).stream()
                .collect(Collectors.toMap(UserStrategy::getId, UserStrategy::getName, (left, right) -> left));
    }

    private UUID requireOwnedStrategyId(UUID strategyId, UUID userId) {
        if (strategyId == null) {
            return null;
        }
        return userStrategyRepository.findByIdAndUser_Id(strategyId, userId)
                .map(UserStrategy::getId)
                .orElseThrow(() -> new EntityNotFoundException("Strategy not found"));
    }

    private BigDecimal defaultZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private BigDecimal defaultOne(BigDecimal value) {
        return value == null ? BigDecimal.ONE : value;
    }

    private Account resolveAccount(TradeRequest request, User user) {
        UUID accountRefId = resolveAccountRefId(request);
        if (accountRefId == null) {
            return null;
        }
        return accountRepository.findByIdAndUserId(accountRefId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Account not found"));
    }

    private UUID resolveAccountRefId(TradeRequest request) {
        if (request.getAccountRefId() != null) {
            return request.getAccountRefId();
        }
        String maybeLegacyAccountId = normalizeOptionalText(request.getAccountId());
        return parseUuidOrNull(maybeLegacyAccountId);
    }

    private AccountFilter resolveAccountFilter(String accountId) {
        String brokerAccountId = normalizeOptionalText(accountId);
        return new AccountFilter(brokerAccountId, parseUuidOrNull(brokerAccountId));
    }

    private UUID parseUuidOrNull(String value) {
        if (value == null) {
            return null;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private Optional<Trade> findExistingImportedTrade(UUID userId, ImportedTradeCandidate candidate) {
        String brokerAccountId = normalizeOptionalText(candidate.getAccountId());
        if (brokerAccountId != null) {
            return tradeRepository.findByUserIdAndSymbolAndDirectionAndOpenedAtAndBrokerAccountId(
                    userId,
                    candidate.getSymbol(),
                    candidate.getDirection(),
                    candidate.getOpenedAt(),
                    brokerAccountId
            );
        }
        return tradeRepository.findByUserIdAndSymbolAndDirectionAndOpenedAt(
                userId,
                candidate.getSymbol(),
                candidate.getDirection(),
                candidate.getOpenedAt()
        );
    }

    private TradeRequest copyTradeToRequest(Trade trade) {
        TradeRequest request = new TradeRequest();
        request.setSymbol(trade.getSymbol());
        request.setMarket(trade.getMarket());
        request.setDirection(trade.getDirection());
        request.setStatus(trade.getStatus());
        request.setOpenedAt(trade.getOpenedAt());
        request.setClosedAt(trade.getClosedAt());
        request.setQuantity(trade.getQuantity());
        request.setEntryPrice(trade.getEntryPrice());
        request.setExitPrice(trade.getExitPrice());
        request.setStopLossPrice(trade.getStopLossPrice());
        request.setTakeProfitPrice(trade.getTakeProfitPrice());
        request.setFees(trade.getFees());
        request.setFeesProfileCurrency(trade.getFeesProfileCurrency());
        request.setCommission(trade.getCommission());
        request.setSlippage(trade.getSlippage());
        request.setTradeCurrency(trade.getTradeCurrency());
        request.setProfileCurrency(trade.getProfileCurrency());
        request.setFxRateTradeToProfile(trade.getFxRateTradeToProfile());
        request.setFxRateTimestamp(trade.getFxRateTimestamp());
        request.setFxRateSource(trade.getFxRateSource());
        request.setPnlProfileCurrency(trade.getPnlProfileCurrency());
        request.setRiskAmount(trade.getRiskAmount());
        request.setCapitalUsed(trade.getCapitalUsed());
        request.setTimeframe(trade.getTimeframe());
        request.setSetup(trade.getSetup());
        request.setStrategyTag(trade.getStrategyTag());
        request.setCatalystTag(trade.getCatalystTag());
        request.setStrategyId(trade.getStrategyId());
        request.setStrategyVersionId(trade.getStrategyVersionId());
        request.setContextSnapshotId(trade.getContextSnapshotId());
        request.setSetupGrade(trade.getSetupGrade());
        request.setRuleBreaks(trade.getRuleBreaks() == null ? null : new LinkedHashSet<>(trade.getRuleBreaks()));
        request.setSession(trade.getSession());
        request.setSessionId(trade.getSessionId());
        request.setSetupId(trade.getSetupId());
        request.setSweepLevelId(trade.getSweepLevelId());
        request.setSweepPoolId(trade.getSweepPoolId());
        request.setEntryLevelId(trade.getEntryLevelId());
        request.setSlLevelId(trade.getSlLevelId());
        request.setTpLevelId(trade.getTpLevelId());
        request.setNarrativeSnapshotJson(trade.getNarrativeSnapshotJson());
        request.setSweepConfirmed(trade.getSweepConfirmed());
        request.setDisplacementConfirmed(trade.getDisplacementConfirmed());
        request.setMssConfirmed(trade.getMssConfirmed());
        request.setSweepDepthPoints(trade.getSweepDepthPoints());
        request.setDisplacementSizePoints(trade.getDisplacementSizePoints());
        request.setTimeSweepToEntrySeconds(trade.getTimeSweepToEntrySeconds());
        request.setMfePoints(trade.getMfePoints());
        request.setMaePoints(trade.getMaePoints());
        request.setLevelExpectationMet(trade.getLevelExpectationMet());
        request.setLevelExpectation(trade.getLevelExpectation());
        request.setFeeling(trade.getFeeling());
        request.setLinkedContentIds(trade.getLinkedContentIds() == null ? null : new LinkedHashSet<>(trade.getLinkedContentIds()));
        request.setLinkedPlanIds(trade.getLinkedPlanIds() == null ? null : new LinkedHashSet<>(trade.getLinkedPlanIds()));
        request.setNotes(trade.getNotes());
        request.setInitialNotes(trade.getInitialNotes());
        request.setEntryJournalText(trade.getEntryJournalText());
        request.setEntryInvalidation(trade.getEntryInvalidation());
        request.setEntryScreenshotAssetIds(trade.getEntryScreenshotAssetIds() == null ? null : new LinkedHashSet<>(trade.getEntryScreenshotAssetIds()));
        request.setAccountId(trade.getBrokerAccountId());
        request.setAccountRefId(trade.getAccount() == null ? null : trade.getAccount().getId());
        request.setContractMultiplier(trade.getContractMultiplier());
        request.setTagIds(trade.getTags() == null ? null : trade.getTags().stream().map(Tag::getId).collect(Collectors.toCollection(LinkedHashSet::new)));
        return request;
    }

    private void applyImportedCandidate(TradeRequest request, ImportedTradeCandidate candidate) {
        request.setSymbol(candidate.getSymbol());
        request.setMarket(candidate.getMarket());
        request.setDirection(candidate.getDirection());
        request.setStatus(candidate.getStatus());
        request.setOpenedAt(candidate.getOpenedAt());
        request.setClosedAt(candidate.getClosedAt());
        request.setQuantity(candidate.getQuantity());
        request.setEntryPrice(candidate.getEntryPrice());
        request.setExitPrice(candidate.getExitPrice());
        request.setStopLossPrice(candidate.getStopLossPrice());
        request.setTakeProfitPrice(candidate.getTakeProfitPrice());
        request.setFees(candidate.getFees());
        request.setCommission(candidate.getCommission());
        request.setSlippage(candidate.getSlippage());
        request.setTradeCurrency(candidate.getTradeCurrency());
        request.setProfileCurrency(candidate.getProfileCurrency());
        request.setAccountId(candidate.getAccountId());
        request.setAccountRefId(candidate.getAccountRefId());
        request.setContractMultiplier(candidate.getContractMultiplier());
        if (request.getInitialNotes() == null) {
            request.setInitialNotes(candidate.getInitialNotes());
        }
    }

    private Set<String> normalizeRuleBreaks(Set<String> values) {
        if (values == null || values.isEmpty()) {
            return new LinkedHashSet<>();
        }
        return values.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(token -> !token.isEmpty())
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private Set<UUID> normalizeLinkedContentIds(Set<UUID> values) {
        if (values == null || values.isEmpty()) {
            return new LinkedHashSet<>();
        }
        return values.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private Set<UUID> normalizeLinkedPlanIds(Set<UUID> values) {
        if (values == null || values.isEmpty()) {
            return new LinkedHashSet<>();
        }
        return values.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private Set<UUID> normalizeLinkedAssetIds(Set<UUID> values) {
        if (values == null || values.isEmpty()) {
            return new LinkedHashSet<>();
        }
        return values.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private JsonNode resolveNarrativeSnapshot(JsonNode requestedSnapshot, JsonNode existingSnapshot) {
        if (requestedSnapshot != null && !requestedSnapshot.isNull()) {
            return requestedSnapshot;
        }
        if (existingSnapshot != null && !existingSnapshot.isNull()) {
            return existingSnapshot;
        }
        return JsonNodeFactory.instance.objectNode();
    }

    private void logNarrativeSnapshotState(String operation,
                                           UUID tradeId,
                                           com.tradevault.domain.enums.TradeStatus status,
                                           JsonNode requestedSnapshot,
                                           JsonNode previousSnapshot,
                                           JsonNode finalSnapshot) {
        if (!log.isDebugEnabled()) {
            return;
        }
        log.debug(
                "[TradeWrite] op={}, tradeId={}, status={}, requestNarrativeNull={}, previousNarrativeNull={}, finalNarrativeNull={}",
                operation,
                tradeId,
                status,
                requestedSnapshot == null || requestedSnapshot.isNull(),
                previousSnapshot == null || previousSnapshot.isNull(),
                finalSnapshot == null || finalSnapshot.isNull()
        );
    }

    private String normalizeFeeling(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private void calculateMetrics(Trade trade) {
        if (trade.getExitPrice() != null) {
            BigDecimal priceDiff = trade.getDirection() == Direction.LONG ?
                    trade.getExitPrice().subtract(trade.getEntryPrice()) :
                    trade.getEntryPrice().subtract(trade.getExitPrice());
            BigDecimal pnlGross = priceDiff.multiply(trade.getQuantity()).multiply(defaultOne(trade.getContractMultiplier()));
            BigDecimal totalCosts = defaultZero(trade.getFees()).add(defaultZero(trade.getCommission())).add(defaultZero(trade.getSlippage()));
            BigDecimal pnlNet = pnlGross.subtract(totalCosts);
            if (trade.getPnlGross() == null) {
                trade.setPnlGross(pnlGross);
            }
            if (trade.getPnlNet() == null) {
                trade.setPnlNet(pnlNet);
            }
            if (trade.getPnlPercent() == null) {
                if (trade.getCapitalUsed() != null && trade.getCapitalUsed().compareTo(BigDecimal.ZERO) != 0) {
                    trade.setPnlPercent(pnlNet.divide(trade.getCapitalUsed(), 4, java.math.RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)));
                }
            }
            if (trade.getRMultiple() == null) {
                if (trade.getRiskAmount() != null && trade.getRiskAmount().compareTo(BigDecimal.ZERO) != 0) {
                    trade.setRMultiple(pnlNet.divide(trade.getRiskAmount(), 4, java.math.RoundingMode.HALF_UP));
                }
            }
        }
    }

    private boolean equalBD(BigDecimal a, BigDecimal b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return a.compareTo(b) == 0;
    }

    private boolean pnlInputsChanged(Trade existing, TradeRequest request) {
        // Fields that influence PnL or its denominators/meaning
        boolean changed = false;
        changed |= existing.getDirection() != request.getDirection();
        changed |= !equalBD(existing.getQuantity(), request.getQuantity());
        changed |= !equalBD(existing.getEntryPrice(), request.getEntryPrice());
        changed |= !equalBD(existing.getExitPrice(), request.getExitPrice());
        changed |= !equalBD(existing.getFees(), defaultZero(request.getFees()));
        changed |= !equalBD(existing.getCommission(), defaultZero(request.getCommission()));
        changed |= !equalBD(existing.getSlippage(), defaultZero(request.getSlippage()));
        changed |= !equalBD(existing.getContractMultiplier(), defaultOne(request.getContractMultiplier()));
        changed |= existing.getStatus() != request.getStatus();
        changed |= (existing.getClosedAt() == null ? request.getClosedAt() != null : !existing.getClosedAt().equals(request.getClosedAt()));
        changed |= !equalBD(existing.getRiskAmount(), request.getRiskAmount());
        changed |= !equalBD(existing.getCapitalUsed(), request.getCapitalUsed());
        changed |= !equalBD(existing.getStopLossPrice(), request.getStopLossPrice());
        return changed;
    }

    private void recalculateAndApplyPnl(Trade trade) {
        // Reset derived fields first
        trade.setPnlGross(null);
        trade.setPnlNet(null);
        trade.setPnlPercent(null);
        trade.setRMultiple(null);

        // Only compute when we have sufficient inputs
        if (trade.getDirection() == null || trade.getEntryPrice() == null || trade.getQuantity() == null || trade.getExitPrice() == null) {
            return; // leave as nulls for open/incomplete trades
        }

        BigDecimal priceDiff = trade.getDirection() == Direction.LONG ?
                trade.getExitPrice().subtract(trade.getEntryPrice()) :
                trade.getEntryPrice().subtract(trade.getExitPrice());
        BigDecimal pnlGross = priceDiff.multiply(trade.getQuantity()).multiply(defaultOne(trade.getContractMultiplier()));
        BigDecimal totalCosts = defaultZero(trade.getFees()).add(defaultZero(trade.getCommission())).add(defaultZero(trade.getSlippage()));
        BigDecimal pnlNet = pnlGross.subtract(totalCosts);

        trade.setPnlGross(pnlGross);
        trade.setPnlNet(pnlNet);

        if (trade.getCapitalUsed() != null && trade.getCapitalUsed().compareTo(BigDecimal.ZERO) != 0) {
            trade.setPnlPercent(pnlNet.divide(trade.getCapitalUsed(), 4, java.math.RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)));
        }
        if (trade.getRiskAmount() != null && trade.getRiskAmount().compareTo(BigDecimal.ZERO) != 0) {
            trade.setRMultiple(pnlNet.divide(trade.getRiskAmount(), 4, java.math.RoundingMode.HALF_UP));
        }
    }

    private void recalculateRiskPercent(Trade trade) {
        trade.setRiskPercent(null);
        if (trade.getRiskAmount() != null && trade.getCapitalUsed() != null && trade.getCapitalUsed().compareTo(BigDecimal.ZERO) != 0) {
            trade.setRiskPercent(trade.getRiskAmount().divide(trade.getCapitalUsed(), 4, java.math.RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)));
        }
    }

    private void applyCurrencyContextForCreate(Trade trade, TradeRequest request, User user) {
        String profileCurrency = resolveProfileCurrency(request.getProfileCurrency(), user.getBaseCurrency(), null);
        String tradeCurrency = resolveTradeCurrency(request.getTradeCurrency(), profileCurrency, null);
        BigDecimal fxRate = resolveFxRate(request.getFxRateTradeToProfile(), tradeCurrency, profileCurrency, null);
        trade.setProfileCurrency(profileCurrency);
        trade.setTradeCurrency(tradeCurrency);
        trade.setFxRateTradeToProfile(fxRate);
        trade.setFxRateTimestamp(resolveFxTimestamp(request.getFxRateTimestamp(), tradeCurrency, profileCurrency, null));
        trade.setFxRateSource(resolveFxSource(request.getFxRateSource(), tradeCurrency, profileCurrency, null));
    }

    private void applyCurrencyContextForUpdate(Trade trade, TradeRequest request, User user) {
        String profileCurrency = resolveProfileCurrency(request.getProfileCurrency(), user.getBaseCurrency(), trade.getProfileCurrency());
        String tradeCurrency = resolveTradeCurrency(request.getTradeCurrency(), profileCurrency, trade.getTradeCurrency());
        BigDecimal fxRate = resolveFxRate(request.getFxRateTradeToProfile(), tradeCurrency, profileCurrency, trade.getFxRateTradeToProfile());
        trade.setProfileCurrency(profileCurrency);
        trade.setTradeCurrency(tradeCurrency);
        trade.setFxRateTradeToProfile(fxRate);
        trade.setFxRateTimestamp(resolveFxTimestamp(request.getFxRateTimestamp(), tradeCurrency, profileCurrency, trade.getFxRateTimestamp()));
        trade.setFxRateSource(resolveFxSource(request.getFxRateSource(), tradeCurrency, profileCurrency, trade.getFxRateSource()));
    }

    private String resolveProfileCurrency(String requestProfileCurrency, String userBaseCurrency, String existingProfileCurrency) {
        return normalizeCurrency(firstNonBlank(requestProfileCurrency, existingProfileCurrency, userBaseCurrency, DEFAULT_CURRENCY));
    }

    private String resolveTradeCurrency(String requestTradeCurrency, String profileCurrency, String existingTradeCurrency) {
        return normalizeCurrency(firstNonBlank(requestTradeCurrency, existingTradeCurrency, profileCurrency, DEFAULT_CURRENCY));
    }

    private BigDecimal resolveFxRate(BigDecimal requestRate, String tradeCurrency, String profileCurrency, BigDecimal existingRate) {
        if (isSameCurrency(tradeCurrency, profileCurrency)) {
            return BigDecimal.ONE;
        }
        BigDecimal candidate = requestRate;
        if (candidate == null || candidate.compareTo(BigDecimal.ZERO) <= 0) {
            candidate = existingRate;
        }
        if (candidate == null || candidate.compareTo(BigDecimal.ZERO) <= 0) {
            candidate = BigDecimal.ONE;
        }
        return scaleRate(candidate);
    }

    private OffsetDateTime resolveFxTimestamp(OffsetDateTime requestTimestamp,
                                              String tradeCurrency,
                                              String profileCurrency,
                                              OffsetDateTime existingTimestamp) {
        if (isSameCurrency(tradeCurrency, profileCurrency)) {
            return requestTimestamp != null ? requestTimestamp : OffsetDateTime.now();
        }
        if (requestTimestamp != null) {
            return requestTimestamp;
        }
        return existingTimestamp != null ? existingTimestamp : OffsetDateTime.now();
    }

    private String resolveFxSource(String requestSource,
                                   String tradeCurrency,
                                   String profileCurrency,
                                   String existingSource) {
        if (isSameCurrency(tradeCurrency, profileCurrency)) {
            return FX_SOURCE_IDENTITY;
        }
        String normalizedRequest = normalizeOptionalText(requestSource);
        if (normalizedRequest != null) {
            return normalizedRequest.toUpperCase(Locale.ROOT);
        }
        String normalizedExisting = normalizeOptionalText(existingSource);
        if (normalizedExisting != null) {
            return normalizedExisting.toUpperCase(Locale.ROOT);
        }
        return FX_SOURCE_MANUAL;
    }

    private void recalculateProfileCurrencyAmounts(Trade trade) {
        BigDecimal fxRate = resolveFxRate(trade.getFxRateTradeToProfile(), trade.getTradeCurrency(), trade.getProfileCurrency(), trade.getFxRateTradeToProfile());
        trade.setFxRateTradeToProfile(fxRate);
        trade.setFeesProfileCurrency(scaleMoney(defaultZero(trade.getFees()).multiply(fxRate)));
        if (trade.getPnlNet() == null) {
            trade.setPnlProfileCurrency(null);
            return;
        }
        trade.setPnlProfileCurrency(scaleMoney(trade.getPnlNet().multiply(fxRate)));
    }

    private String normalizeCurrency(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            return DEFAULT_CURRENCY;
        }
        return normalized.toUpperCase(Locale.ROOT);
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String firstNonBlank(String... values) {
        if (values == null || values.length == 0) {
            return null;
        }
        for (String value : values) {
            String normalized = normalizeOptionalText(value);
            if (normalized != null) {
                return normalized;
            }
        }
        return null;
    }

    private String resolvedDisplayAccountId(Trade trade) {
        return firstNonBlank(
                trade.getBrokerAccountId(),
                trade.getAccount() != null ? trade.getAccount().getId().toString() : null
        );
    }

    private DailyAccountSummaryResponse buildDailyAccountSummary(String accountId, List<Trade> trades) {
        BigDecimal netPnl = trades.stream()
                .map(Trade::getPnlNet)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long winners = trades.stream().filter(t -> t.getPnlNet() != null && t.getPnlNet().compareTo(BigDecimal.ZERO) > 0).count();
        long losers = trades.stream().filter(t -> t.getPnlNet() != null && t.getPnlNet().compareTo(BigDecimal.ZERO) < 0).count();
        long tradeCount = trades.size();
        double winRate = tradeCount == 0 ? 0 : (double) winners / (double) tradeCount;
        return DailyAccountSummaryResponse.builder()
                .accountId(accountId)
                .netPnl(netPnl)
                .tradeCount(tradeCount)
                .winners(winners)
                .losers(losers)
                .winRate(winRate)
                .build();
    }

    private boolean isSameCurrency(String tradeCurrency, String profileCurrency) {
        return normalizeCurrency(tradeCurrency).equals(normalizeCurrency(profileCurrency));
    }

    private BigDecimal scaleMoney(BigDecimal value) {
        if (value == null) {
            return null;
        }
        return value.setScale(4, RoundingMode.HALF_UP);
    }

    private BigDecimal scaleRate(BigDecimal value) {
        if (value == null) {
            return null;
        }
        return value.setScale(8, RoundingMode.HALF_UP);
    }

    private void validateClosedTrade(TradeRequest request) {
        if (request.getStatus() == com.tradevault.domain.enums.TradeStatus.CLOSED && request.getExitPrice() == null) {
            throw new IllegalArgumentException("Exit price is required when status is CLOSED");
        }
        if (request.getStatus() == com.tradevault.domain.enums.TradeStatus.CLOSED && request.getClosedAt() == null) {
            throw new IllegalArgumentException("Closed at is required when status is CLOSED");
        }
    }

    private TradeResponse toResponse(Trade trade) {
        return toResponse(trade, loadStrategyNames(List.of(trade), currentUserService.getCurrentUser().getId()));
    }

    private TradeResponse toResponse(Trade trade, Map<UUID, String> strategyNames) {
        return TradeResponse.builder()
                .id(trade.getId())
                .symbol(trade.getSymbol())
                .market(trade.getMarket())
                .direction(trade.getDirection())
                .status(trade.getStatus())
                .openedAt(trade.getOpenedAt())
                .closedAt(trade.getClosedAt())
                .quantity(trade.getQuantity())
                .entryPrice(trade.getEntryPrice())
                .exitPrice(trade.getExitPrice())
                .stopLossPrice(trade.getStopLossPrice())
                .takeProfitPrice(trade.getTakeProfitPrice())
                .fees(trade.getFees())
                .feesProfileCurrency(trade.getFeesProfileCurrency())
                .commission(trade.getCommission())
                .slippage(trade.getSlippage())
                .pnlGross(trade.getPnlGross())
                .pnlNet(trade.getPnlNet())
                .pnlProfileCurrency(trade.getPnlProfileCurrency())
                .tradeCurrency(trade.getTradeCurrency())
                .profileCurrency(trade.getProfileCurrency())
                .fxRateTradeToProfile(trade.getFxRateTradeToProfile())
                .fxRateTimestamp(trade.getFxRateTimestamp())
                .fxRateSource(trade.getFxRateSource())
                .pnlPercent(trade.getPnlPercent())
                .rMultiple(trade.getRMultiple())
                .riskAmount(trade.getRiskAmount())
                .riskPercent(trade.getRiskPercent())
                .capitalUsed(trade.getCapitalUsed())
                .timeframe(trade.getTimeframe())
                .setup(trade.getSetup())
                .strategyName(trade.getStrategyId() == null ? null : strategyNames.get(trade.getStrategyId()))
                .strategyTag(trade.getStrategyTag())
                .catalystTag(trade.getCatalystTag())
                .strategyId(trade.getStrategyId())
                .strategyVersionId(trade.getStrategyVersionId())
                .contextSnapshotId(trade.getContextSnapshotId())
                .setupGrade(trade.getSetupGrade())
                .ruleBreaks(trade.getRuleBreaks() == null ? Collections.emptySet() : new LinkedHashSet<>(trade.getRuleBreaks()))
                .session(trade.getSession())
                .sessionId(trade.getSessionId())
                .setupId(trade.getSetupId())
                .sweepLevelId(trade.getSweepLevelId())
                .sweepPoolId(trade.getSweepPoolId())
                .entryLevelId(trade.getEntryLevelId())
                .slLevelId(trade.getSlLevelId())
                .tpLevelId(trade.getTpLevelId())
                .narrativeSnapshotJson(trade.getNarrativeSnapshotJson())
                .sweepConfirmed(trade.getSweepConfirmed())
                .displacementConfirmed(trade.getDisplacementConfirmed())
                .mssConfirmed(trade.getMssConfirmed())
                .sweepDepthPoints(trade.getSweepDepthPoints())
                .displacementSizePoints(trade.getDisplacementSizePoints())
                .timeSweepToEntrySeconds(trade.getTimeSweepToEntrySeconds())
                .mfePoints(trade.getMfePoints())
                .maePoints(trade.getMaePoints())
                .levelExpectationMet(trade.getLevelExpectationMet())
                .levelExpectation(trade.getLevelExpectation())
                .feeling(trade.getFeeling())
                .linkedContentIds(trade.getLinkedContentIds() == null ? Collections.emptySet() : new LinkedHashSet<>(trade.getLinkedContentIds()))
                .linkedPlanIds(trade.getLinkedPlanIds() == null ? Collections.emptySet() : new LinkedHashSet<>(trade.getLinkedPlanIds()))
                .notes(trade.getNotes())
                .initialNotes(trade.getInitialNotes())
                .entryJournalText(trade.getEntryJournalText())
                .entryInvalidation(trade.getEntryInvalidation())
                .entryScreenshotAssetIds(trade.getEntryScreenshotAssetIds() == null ? Collections.emptySet() : new LinkedHashSet<>(trade.getEntryScreenshotAssetIds()))
                .createdAt(trade.getCreatedAt())
                .updatedAt(trade.getUpdatedAt())
                .accountId(resolvedDisplayAccountId(trade))
                .accountRefId(trade.getAccount() != null ? trade.getAccount().getId() : null)
                .contractMultiplier(defaultOne(trade.getContractMultiplier()))
                .tags((trade.getTags() == null ? java.util.Collections.<String>emptySet() : trade.getTags().stream().map(Tag::getName).collect(Collectors.toSet())))
                .build();
    }

    public record ImportUpsertResult(TradeResponse trade, boolean updated) {}

    private record AccountFilter(String brokerAccountId, UUID accountRefId) {}
}
