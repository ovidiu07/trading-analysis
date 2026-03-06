package com.tradevault.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.tradevault.domain.entity.BacktestRun;
import com.tradevault.domain.entity.BacktestRunReport;
import com.tradevault.domain.entity.BacktestTrade;
import com.tradevault.domain.entity.ContextSnapshot;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.entity.UserStrategy;
import com.tradevault.dto.diagnostics.DiagnosticsBacktestRunRow;
import com.tradevault.dto.diagnostics.DiagnosticsBreakdownRow;
import com.tradevault.dto.diagnostics.DiagnosticsCoreMetrics;
import com.tradevault.dto.diagnostics.DiagnosticsFailureModeRow;
import com.tradevault.dto.diagnostics.DiagnosticsHistogramBucket;
import com.tradevault.dto.diagnostics.DiagnosticsReportRow;
import com.tradevault.dto.diagnostics.DiagnosticsReportsResponse;
import com.tradevault.dto.diagnostics.DiagnosticsStrategiesResponse;
import com.tradevault.dto.diagnostics.DiagnosticsStrategyDetailResponse;
import com.tradevault.dto.diagnostics.DiagnosticsStrategyHeadline;
import com.tradevault.dto.diagnostics.DiagnosticsSuggestion;
import com.tradevault.dto.diagnostics.DiagnosticsTriggerImpactRow;
import com.tradevault.dto.diagnostics.LiveDiagnosticsSummaryResponse;
import com.tradevault.repository.BacktestRunRepository;
import com.tradevault.repository.BacktestRunReportRepository;
import com.tradevault.repository.BacktestTradeRepository;
import com.tradevault.repository.ContextSnapshotRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.repository.UserStrategyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DiagnosticsService {
    private static final UUID UNASSIGNED_STRATEGY_ID = UUID.fromString("00000000-0000-0000-0000-000000000000");
    private static final String UNASSIGNED_STRATEGY_NAME = "Unassigned strategy";

    private final CurrentUserService currentUserService;
    private final TradeRepository tradeRepository;
    private final BacktestTradeRepository backtestTradeRepository;
    private final BacktestRunRepository backtestRunRepository;
    private final BacktestRunReportRepository backtestRunReportRepository;
    private final UserStrategyRepository userStrategyRepository;
    private final ContextSnapshotRepository contextSnapshotRepository;

    public DiagnosticsStrategiesResponse listStrategies() {
        User user = currentUserService.getCurrentUser();
        UUID userId = user.getId();
        Map<UUID, String> strategyNames = mapStrategyNames(userId);

        List<TradeSample> samples = loadSamples(userId, DiagnosticsMode.BOTH, null, null, null, null, null, null);

        Map<UUID, StatsBucket> grouped = new LinkedHashMap<>();
        for (TradeSample sample : samples) {
            UUID strategyKey = sample.strategyId() == null ? UNASSIGNED_STRATEGY_ID : sample.strategyId();
            grouped.computeIfAbsent(strategyKey, ignored -> new StatsBucket()).add(sample);
        }

        List<DiagnosticsStrategyHeadline> rows = grouped.entrySet().stream()
                .map(entry -> {
                    UUID strategyId = entry.getKey();
                    StatsBucket stats = entry.getValue();
                    String strategyName = UNASSIGNED_STRATEGY_ID.equals(strategyId)
                            ? UNASSIGNED_STRATEGY_NAME
                            : strategyNames.getOrDefault(strategyId, "Unnamed strategy");
                    return DiagnosticsStrategyHeadline.builder()
                            .strategyId(strategyId)
                            .strategyName(strategyName)
                            .sampleSize(stats.count)
                            .winRate(scale(stats.winRatePct()))
                            .expectancyR(scale(stats.expectancyR()))
                            .profitFactor(scale(stats.profitFactor()))
                            .build();
                })
                .sorted(Comparator
                        .comparing(DiagnosticsStrategyHeadline::getSampleSize)
                        .reversed()
                        .thenComparing(DiagnosticsStrategyHeadline::getExpectancyR, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        return DiagnosticsStrategiesResponse.builder().strategies(rows).build();
    }

    public DiagnosticsReportsResponse listReports(LocalDate from,
                                                  LocalDate to,
                                                  String instrument,
                                                  String strategyName) {
        User user = currentUserService.getCurrentUser();
        UUID userId = user.getId();
        OffsetDateTime fromTs = from == null ? null : from.atStartOfDay().atOffset(java.time.ZoneOffset.UTC);
        OffsetDateTime toTs = to == null ? null : to.plusDays(1).atStartOfDay().atOffset(java.time.ZoneOffset.UTC).minusNanos(1);
        String normalizedInstrument = normalizeOptionalText(instrument);
        String normalizedStrategyName = normalizeOptionalText(strategyName);

        List<DiagnosticsReportRow> rows = backtestRunReportRepository.findByRun_User_IdOrderByCreatedAtUtcDesc(userId).stream()
                .filter(report -> {
                    OffsetDateTime created = report.getCreatedAtUtc();
                    if (fromTs != null && (created == null || created.isBefore(fromTs))) {
                        return false;
                    }
                    if (toTs != null && (created == null || created.isAfter(toTs))) {
                        return false;
                    }
                    return true;
                })
                .filter(report -> normalizedInstrument == null
                        || (report.getRun() != null && equalsIgnoreCase(report.getRun().getSymbol(), normalizedInstrument)))
                .filter(report -> normalizedStrategyName == null || equalsIgnoreCase(report.getStrategyNameSnapshot(), normalizedStrategyName))
                .map(this::toReportRow)
                .toList();

        return DiagnosticsReportsResponse.builder()
                .reports(rows)
                .build();
    }

    public LiveDiagnosticsSummaryResponse getLiveSummary(LocalDate from,
                                                         LocalDate to,
                                                         String symbol,
                                                         String sessionWindow) {
        User user = currentUserService.getCurrentUser();
        UUID userId = user.getId();
        Map<UUID, String> strategyNames = mapStrategyNames(userId);

        List<TradeSample> samples = loadSamples(userId, DiagnosticsMode.LIVE, from, to, symbol, sessionWindow, null, null);
        DiagnosticsCoreMetrics coreMetrics = buildCoreMetrics(samples);
        List<DiagnosticsBreakdownRow> bySession = buildBreakdown(samples, TradeSample::sessionLabel);
        List<DiagnosticsBreakdownRow> bySymbol = buildBreakdown(samples, TradeSample::symbol);
        List<DiagnosticsBreakdownRow> byDow = buildBreakdown(samples, sample -> sample.dayOfWeek() == null ? "N/A" : sample.dayOfWeek().name());

        Set<UUID> snapshotIds = samples.stream()
                .map(TradeSample::contextSnapshotId)
                .filter(Objects::nonNull)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        Map<UUID, ContextSnapshot> snapshots = new HashMap<>();
        if (!snapshotIds.isEmpty()) {
            contextSnapshotRepository.findAllById(snapshotIds).forEach(item -> snapshots.put(item.getId(), item));
        }

        List<DiagnosticsTriggerImpactRow> triggerImpact = buildTriggerImpact(samples, snapshots);
        List<DiagnosticsFailureModeRow> failureModes = buildFailureModes(samples, snapshots);
        List<DiagnosticsSuggestion> suggestions = buildSuggestions(samples, triggerImpact, failureModes, bySession);

        Map<UUID, StatsBucket> grouped = new LinkedHashMap<>();
        for (TradeSample sample : samples) {
            UUID strategyKey = sample.strategyId() == null ? UNASSIGNED_STRATEGY_ID : sample.strategyId();
            grouped.computeIfAbsent(strategyKey, ignored -> new StatsBucket()).add(sample);
        }

        List<DiagnosticsStrategyHeadline> strategyPerformance = grouped.entrySet().stream()
                .map(entry -> {
                    UUID strategyId = entry.getKey();
                    StatsBucket stats = entry.getValue();
                    String strategyName = UNASSIGNED_STRATEGY_ID.equals(strategyId)
                            ? UNASSIGNED_STRATEGY_NAME
                            : strategyNames.getOrDefault(strategyId, "Unnamed strategy");
                    return DiagnosticsStrategyHeadline.builder()
                            .strategyId(strategyId)
                            .strategyName(strategyName)
                            .sampleSize(stats.count)
                            .winRate(scale(stats.winRatePct()))
                            .expectancyR(scale(stats.expectancyR()))
                            .profitFactor(scale(stats.profitFactor()))
                            .build();
                })
                .sorted(Comparator
                        .comparing(DiagnosticsStrategyHeadline::getSampleSize)
                        .reversed()
                        .thenComparing(DiagnosticsStrategyHeadline::getExpectancyR, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        return LiveDiagnosticsSummaryResponse.builder()
                .coreMetrics(coreMetrics)
                .breakdownBySession(bySession)
                .breakdownBySymbol(bySymbol)
                .breakdownByDayOfWeek(byDow)
                .strategyPerformance(strategyPerformance)
                .failureModes(failureModes)
                .suggestions(suggestions)
                .generatedAt(OffsetDateTime.now())
                .build();
    }

    public DiagnosticsStrategyDetailResponse getStrategyDetail(UUID strategyId,
                                                               String modeRaw,
                                                               LocalDate from,
                                                               LocalDate to,
                                                               String symbol,
                                                               String sessionWindow,
                                                               String backtestSource) {
        User user = currentUserService.getCurrentUser();
        UUID userId = user.getId();
        DiagnosticsMode mode = DiagnosticsMode.from(modeRaw);
        Map<UUID, String> strategyNames = mapStrategyNames(userId);

        List<TradeSample> samples = loadSamples(userId, mode, from, to, symbol, sessionWindow, backtestSource, strategyId);

        DiagnosticsCoreMetrics coreMetrics = buildCoreMetrics(samples);
        List<DiagnosticsBreakdownRow> bySession = buildBreakdown(samples, TradeSample::sessionLabel);
        List<DiagnosticsBreakdownRow> bySymbol = buildBreakdown(samples, TradeSample::symbol);
        List<DiagnosticsBreakdownRow> byDow = buildBreakdown(samples, sample -> sample.dayOfWeek() == null ? "N/A" : sample.dayOfWeek().name());
        List<DiagnosticsHistogramBucket> rDistribution = buildRDistribution(samples);

        Set<UUID> snapshotIds = samples.stream()
                .map(TradeSample::contextSnapshotId)
                .filter(Objects::nonNull)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        Map<UUID, ContextSnapshot> snapshots = new HashMap<>();
        if (!snapshotIds.isEmpty()) {
            contextSnapshotRepository.findAllById(snapshotIds).forEach(item -> snapshots.put(item.getId(), item));
        }

        List<DiagnosticsTriggerImpactRow> triggerImpact = buildTriggerImpact(samples, snapshots);
        List<DiagnosticsFailureModeRow> failureModes = buildFailureModes(samples, snapshots);
        List<DiagnosticsSuggestion> suggestions = buildSuggestions(samples, triggerImpact, failureModes, bySession);
        List<DiagnosticsBacktestRunRow> backtestRuns = buildBacktestRunRows(userId, samples);

        String strategyName = UNASSIGNED_STRATEGY_ID.equals(strategyId)
                ? UNASSIGNED_STRATEGY_NAME
                : strategyNames.getOrDefault(strategyId, "Unnamed strategy");

        return DiagnosticsStrategyDetailResponse.builder()
                .strategyId(strategyId)
                .strategyName(strategyName)
                .mode(mode.name())
                .coreMetrics(coreMetrics)
                .breakdownBySession(bySession)
                .breakdownBySymbol(bySymbol)
                .breakdownByDayOfWeek(byDow)
                .rDistribution(rDistribution)
                .triggerImpact(triggerImpact)
                .failureModes(failureModes)
                .suggestions(suggestions)
                .backtestRuns(backtestRuns)
                .build();
    }

    private Map<UUID, String> mapStrategyNames(UUID userId) {
        Map<UUID, String> names = new HashMap<>();
        for (UserStrategy strategy : userStrategyRepository.findByUser_IdOrderByUpdatedAtDesc(userId)) {
            names.put(strategy.getId(), strategy.getName());
        }
        return names;
    }

    private List<TradeSample> loadSamples(UUID userId,
                                          DiagnosticsMode mode,
                                          LocalDate from,
                                          LocalDate to,
                                          String symbol,
                                          String sessionWindow,
                                          String backtestSource,
                                          UUID strategyFilter) {
        OffsetDateTime fromTs = from == null ? null : from.atStartOfDay().atOffset(java.time.ZoneOffset.UTC);
        OffsetDateTime toTs = to == null ? null : to.plusDays(1).atStartOfDay().atOffset(java.time.ZoneOffset.UTC).minusNanos(1);
        String normalizedSymbol = normalizeOptionalText(symbol);
        String normalizedSession = normalizeOptionalText(sessionWindow);
        String normalizedBacktestSource = normalizeOptionalText(backtestSource);
        boolean filterUnassignedStrategy = strategyFilter != null && UNASSIGNED_STRATEGY_ID.equals(strategyFilter);

        List<TradeSample> rows = new ArrayList<>();

        if (mode == DiagnosticsMode.BOTH || mode == DiagnosticsMode.LIVE) {
            for (Trade trade : tradeRepository.findByUserId(userId)) {
                if (trade.getStatus() != com.tradevault.domain.enums.TradeStatus.CLOSED) {
                    continue;
                }
                if (trade.getClosedAt() == null) {
                    continue;
                }
                if (filterUnassignedStrategy) {
                    if (trade.getStrategyId() != null) {
                        continue;
                    }
                } else if (strategyFilter != null && !Objects.equals(strategyFilter, trade.getStrategyId())) {
                    continue;
                }
                if (fromTs != null && trade.getClosedAt().isBefore(fromTs)) {
                    continue;
                }
                if (toTs != null && trade.getClosedAt().isAfter(toTs)) {
                    continue;
                }
                if (normalizedSymbol != null && !equalsIgnoreCase(trade.getSymbol(), normalizedSymbol)) {
                    continue;
                }
                String session = trade.getSession() == null ? "N/A" : trade.getSession().name();
                if (normalizedSession != null && !equalsIgnoreCase(session, normalizedSession)) {
                    continue;
                }
                rows.add(new TradeSample(
                        TradeSourceMode.LIVE,
                        trade.getId(),
                        null,
                        trade.getStrategyId(),
                        trade.getSymbol(),
                        session,
                        trade.getClosedAt().getDayOfWeek(),
                        trade.getRMultiple() == null ? BigDecimal.ZERO : trade.getRMultiple(),
                        null,
                        null,
                        trade.getOpenedAt() != null
                                ? BigDecimal.valueOf(Duration.between(trade.getOpenedAt(), trade.getClosedAt()).toMinutes())
                                : null,
                        trade.getClosedAt(),
                        trade.getContextSnapshotId()
                ));
            }
        }

        if (mode == DiagnosticsMode.BOTH || mode == DiagnosticsMode.BACKTEST) {
            Map<UUID, BacktestRun> runById = new HashMap<>();
            for (BacktestRun run : backtestRunRepository.findByUser_IdOrderByCreatedAtDesc(userId)) {
                runById.put(run.getId(), run);
            }

            for (BacktestTrade trade : backtestTradeRepository.findByUser_IdOrderByCreatedAtAsc(userId)) {
                if (filterUnassignedStrategy) {
                    if (trade.getStrategyId() != null) {
                        continue;
                    }
                } else if (strategyFilter != null && !Objects.equals(strategyFilter, trade.getStrategyId())) {
                    continue;
                }

                OffsetDateTime eventTime = trade.getExitTime() != null
                        ? trade.getExitTime()
                        : trade.getEntryTime() != null ? trade.getEntryTime() : trade.getRequestedAt();
                if (eventTime == null) {
                    continue;
                }
                if (fromTs != null && eventTime.isBefore(fromTs)) {
                    continue;
                }
                if (toTs != null && eventTime.isAfter(toTs)) {
                    continue;
                }
                if (normalizedSymbol != null && !equalsIgnoreCase(trade.getSymbol(), normalizedSymbol)) {
                    continue;
                }

                BacktestRun run = runById.get(trade.getRun().getId());
                String session = run == null ? "N/A" : (normalizeOptionalText(run.getSessionWindow()) == null ? "N/A" : run.getSessionWindow());
                if (normalizedSession != null && !equalsIgnoreCase(session, normalizedSession)) {
                    continue;
                }
                if (normalizedBacktestSource != null) {
                    String runSource = run == null ? null : normalizeOptionalText(run.getProvider());
                    if (!equalsIgnoreCase(runSource, normalizedBacktestSource)) {
                        continue;
                    }
                }

                rows.add(new TradeSample(
                        TradeSourceMode.BACKTEST,
                        trade.getId(),
                        trade.getRun().getId(),
                        trade.getStrategyId(),
                        trade.getSymbol(),
                        session,
                        eventTime.getDayOfWeek(),
                        trade.getRMultiple() == null ? BigDecimal.ZERO : trade.getRMultiple(),
                        trade.getMaeR(),
                        trade.getMfeR(),
                        trade.getDurationMinutes() == null ? null : BigDecimal.valueOf(trade.getDurationMinutes()),
                        eventTime,
                        trade.getContextSnapshotId()
                ));
            }
        }

        return rows;
    }

    private DiagnosticsCoreMetrics buildCoreMetrics(List<TradeSample> samples) {
        StatsBucket bucket = new StatsBucket();
        samples.forEach(bucket::add);
        return DiagnosticsCoreMetrics.builder()
                .sampleSize(bucket.count)
                .winRate(scale(bucket.winRatePct()))
                .expectancyR(scale(bucket.expectancyR()))
                .profitFactor(scale(bucket.profitFactor()))
                .avgMaeR(scale(bucket.avgMaeR()))
                .avgMfeR(scale(bucket.avgMfeR()))
                .avgDurationMinutes(scale(bucket.avgDurationMinutes()))
                .build();
    }

    private List<DiagnosticsBreakdownRow> buildBreakdown(List<TradeSample> samples,
                                                         java.util.function.Function<TradeSample, String> keyFn) {
        Map<String, StatsBucket> grouped = new LinkedHashMap<>();
        for (TradeSample sample : samples) {
            String key = normalizeOptionalText(keyFn.apply(sample));
            if (key == null) {
                key = "N/A";
            }
            grouped.computeIfAbsent(key, ignored -> new StatsBucket()).add(sample);
        }

        return grouped.entrySet().stream()
                .map(entry -> DiagnosticsBreakdownRow.builder()
                        .key(entry.getKey())
                        .sampleSize(entry.getValue().count)
                        .winRate(scale(entry.getValue().winRatePct()))
                        .expectancyR(scale(entry.getValue().expectancyR()))
                        .build())
                .sorted(Comparator
                        .comparing(DiagnosticsBreakdownRow::getSampleSize)
                        .reversed()
                        .thenComparing(DiagnosticsBreakdownRow::getExpectancyR, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    private List<DiagnosticsTriggerImpactRow> buildTriggerImpact(List<TradeSample> samples,
                                                                 Map<UUID, ContextSnapshot> snapshots) {
        Map<UUID, Map<String, Boolean>> signalsBySnapshot = new HashMap<>();
        Set<String> allSignals = new LinkedHashSet<>();
        for (ContextSnapshot snapshot : snapshots.values()) {
            Map<String, Boolean> states = extractChecklistSignals(snapshot);
            signalsBySnapshot.put(snapshot.getId(), states);
            allSignals.addAll(states.keySet());
        }

        List<DiagnosticsTriggerImpactRow> rows = new ArrayList<>();
        for (String signal : allSignals) {
            StatsBucket checked = new StatsBucket();
            StatsBucket unchecked = new StatsBucket();
            for (TradeSample sample : samples) {
                Map<String, Boolean> states = sample.contextSnapshotId() == null ? null : signalsBySnapshot.get(sample.contextSnapshotId());
                boolean value = states != null && Boolean.TRUE.equals(states.get(signal));
                if (value) {
                    checked.add(sample);
                } else {
                    unchecked.add(sample);
                }
            }
            if (checked.count == 0 && unchecked.count == 0) {
                continue;
            }
            BigDecimal checkedExpectancy = scale(checked.expectancyR());
            BigDecimal uncheckedExpectancy = scale(unchecked.expectancyR());
            BigDecimal delta = null;
            if (checkedExpectancy != null && uncheckedExpectancy != null) {
                delta = checkedExpectancy.subtract(uncheckedExpectancy).setScale(4, RoundingMode.HALF_UP);
            }
            rows.add(DiagnosticsTriggerImpactRow.builder()
                    .triggerKey(signal)
                    .checkedExpectancy(checkedExpectancy)
                    .uncheckedExpectancy(uncheckedExpectancy)
                    .deltaExpectancy(delta)
                    .checkedCount(checked.count)
                    .uncheckedCount(unchecked.count)
                    .build());
        }

        rows.sort(Comparator.comparing(DiagnosticsTriggerImpactRow::getDeltaExpectancy, Comparator.nullsLast(Comparator.reverseOrder())));
        return rows;
    }

    private List<DiagnosticsHistogramBucket> buildRDistribution(List<TradeSample> samples) {
        Map<String, Integer> buckets = new LinkedHashMap<>();
        buckets.put("< -2R", 0);
        buckets.put("-2R to -1R", 0);
        buckets.put("-1R to 0R", 0);
        buckets.put("0R to 1R", 0);
        buckets.put("1R to 2R", 0);
        buckets.put("> 2R", 0);
        for (TradeSample sample : samples) {
            BigDecimal r = sample.rMultiple();
            if (r == null) continue;
            String key;
            if (r.compareTo(BigDecimal.valueOf(-2)) < 0) {
                key = "< -2R";
            } else if (r.compareTo(BigDecimal.valueOf(-1)) < 0) {
                key = "-2R to -1R";
            } else if (r.compareTo(BigDecimal.ZERO) < 0) {
                key = "-1R to 0R";
            } else if (r.compareTo(BigDecimal.ONE) < 0) {
                key = "0R to 1R";
            } else if (r.compareTo(BigDecimal.valueOf(2)) < 0) {
                key = "1R to 2R";
            } else {
                key = "> 2R";
            }
            buckets.computeIfPresent(key, (ignored, current) -> current + 1);
        }
        return buckets.entrySet().stream()
                .map(entry -> DiagnosticsHistogramBucket.builder()
                        .bucket(entry.getKey())
                        .count(entry.getValue())
                        .build())
                .toList();
    }

    private List<DiagnosticsFailureModeRow> buildFailureModes(List<TradeSample> samples,
                                                              Map<UUID, ContextSnapshot> snapshots) {
        List<TradeSample> losses = samples.stream()
                .filter(sample -> sample.rMultiple().compareTo(BigDecimal.ZERO) < 0)
                .toList();
        if (losses.isEmpty()) {
            return List.of();
        }

        StatsBucket missingTriggers = new StatsBucket();
        StatsBucket lowRr = new StatsBucket();
        Map<String, StatsBucket> bySession = new LinkedHashMap<>();

        for (TradeSample sample : losses) {
            ContextSnapshot snapshot = sample.contextSnapshotId() == null ? null : snapshots.get(sample.contextSnapshotId());
            if (snapshot != null) {
                long missingRequired = countMissingRequired(snapshot);
                if (missingRequired > 0) {
                    missingTriggers.add(sample);
                }
                BigDecimal rr = snapshot.getRrAtEntry();
                if (rr != null && rr.compareTo(BigDecimal.valueOf(1.5)) < 0) {
                    lowRr.add(sample);
                }
            }
            bySession.computeIfAbsent(sample.sessionLabel(), ignored -> new StatsBucket()).add(sample);
        }

        List<DiagnosticsFailureModeRow> rows = new ArrayList<>();
        if (missingTriggers.count > 0) {
            rows.add(DiagnosticsFailureModeRow.builder()
                    .label("Missing triggers")
                    .count(missingTriggers.count)
                    .avgR(scale(missingTriggers.expectancyR()))
                    .build());
        }
        if (lowRr.count > 0) {
            rows.add(DiagnosticsFailureModeRow.builder()
                    .label("RR < 1.5")
                    .count(lowRr.count)
                    .avgR(scale(lowRr.expectancyR()))
                    .build());
        }

        bySession.entrySet().stream()
                .sorted(Comparator.comparing(entry -> entry.getValue().expectancyR()))
                .findFirst()
                .ifPresent(entry -> rows.add(DiagnosticsFailureModeRow.builder()
                        .label("Weak session: " + entry.getKey())
                        .count(entry.getValue().count)
                        .avgR(scale(entry.getValue().expectancyR()))
                        .build()));

        return rows;
    }

    private List<DiagnosticsSuggestion> buildSuggestions(List<TradeSample> samples,
                                                         List<DiagnosticsTriggerImpactRow> triggerImpact,
                                                         List<DiagnosticsFailureModeRow> failureModes,
                                                         List<DiagnosticsBreakdownRow> bySession) {
        List<DiagnosticsSuggestion> suggestions = new ArrayList<>();

        triggerImpact.stream()
                .filter(item -> item.getTriggerKey().toUpperCase(Locale.ROOT).contains("MSS"))
                .filter(item -> item.getDeltaExpectancy() != null && item.getDeltaExpectancy().compareTo(BigDecimal.valueOf(0.2)) > 0)
                .findFirst()
                .ifPresent(item -> suggestions.add(DiagnosticsSuggestion.builder()
                        .title("Promote MSS to required")
                        .description("Trades without MSS underperform. Make MSS required before execution.")
                        .build()));

        failureModes.stream()
                .filter(item -> item.getLabel().equals("RR < 1.5"))
                .filter(item -> item.getAvgR() != null && item.getAvgR().compareTo(BigDecimal.ZERO) < 0)
                .findFirst()
                .ifPresent(item -> suggestions.add(DiagnosticsSuggestion.builder()
                        .title("Keep RR gate >= 1.5")
                        .description("Low RR setups are bleeding expectancy. Keep strict RR gating or reduce size.")
                        .build()));

        bySession.stream()
                .filter(item -> item.getSampleSize() >= 8)
                .filter(item -> item.getExpectancyR() != null && item.getExpectancyR().compareTo(BigDecimal.ZERO) < 0)
                .min(Comparator.comparing(DiagnosticsBreakdownRow::getExpectancyR))
                .ifPresent(item -> suggestions.add(DiagnosticsSuggestion.builder()
                        .title("Session filter opportunity")
                        .description("Session " + item.getKey() + " is negative expectancy. Reduce exposure or tighten criteria there.")
                        .build()));

        if (suggestions.isEmpty() && samples.size() >= 5) {
            suggestions.add(DiagnosticsSuggestion.builder()
                    .title("Collect more segmented samples")
                    .description("No strong rule signal yet. Keep logging context snapshots to sharpen diagnostics.")
                    .build());
        }

        return suggestions.stream().limit(3).toList();
    }

    private List<DiagnosticsBacktestRunRow> buildBacktestRunRows(UUID userId, List<TradeSample> samples) {
        Set<UUID> runIds = samples.stream()
                .map(TradeSample::runId)
                .filter(Objects::nonNull)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        if (runIds.isEmpty()) {
            return List.of();
        }

        Map<UUID, BacktestRun> runs = new HashMap<>();
        for (BacktestRun run : backtestRunRepository.findByUser_IdOrderByCreatedAtDesc(userId)) {
            if (runIds.contains(run.getId())) {
                runs.put(run.getId(), run);
            }
        }

        Map<UUID, StatsBucket> grouped = new LinkedHashMap<>();
        for (TradeSample sample : samples) {
            if (sample.runId() == null) {
                continue;
            }
            grouped.computeIfAbsent(sample.runId(), ignored -> new StatsBucket()).add(sample);
        }

        return grouped.entrySet().stream()
                .map(entry -> {
                    BacktestRun run = runs.get(entry.getKey());
                    if (run == null) {
                        return null;
                    }
                    StatsBucket stats = entry.getValue();
                    return DiagnosticsBacktestRunRow.builder()
                            .runId(run.getId())
                            .symbol(run.getSymbol())
                            .timeframe(run.getTimeframe())
                            .from(run.getRangeFrom())
                            .to(run.getRangeTo())
                            .tradesCount(stats.count)
                            .expectancyR(scale(stats.expectancyR()))
                            .build();
                })
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(DiagnosticsBacktestRunRow::getFrom, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    private DiagnosticsReportRow toReportRow(BacktestRunReport report) {
        JsonNode summary = report.getSummarySnapshotJson();
        JsonNode filters = report.getFiltersSnapshotJson();
        int sampleSize = summary == null ? 0 : summary.path("sampleSize").asInt(0);
        BigDecimal winRate = summary == null ? BigDecimal.ZERO : parseDecimal(summary.path("winRate").asText(null));
        BigDecimal expectancy = summary == null ? BigDecimal.ZERO : parseDecimal(summary.path("expectancyR").asText(null));
        String timeframe = filters == null ? null : normalizeOptionalText(filters.path("executionTimeframe").asText(null));
        String sessionFilter = filters == null ? null : normalizeOptionalText(filters.path("sessionFilter").asText(null));

        return DiagnosticsReportRow.builder()
                .reportId(report.getId())
                .runId(report.getRun() == null ? null : report.getRun().getId())
                .strategyId(report.getStrategyId())
                .strategyName(report.getStrategyNameSnapshot())
                .instrument(report.getRun() == null ? null : report.getRun().getSymbol())
                .timeframe(timeframe)
                .sessionFilter(sessionFilter)
                .sampleSize(sampleSize)
                .winRate(scale(winRate))
                .expectancyR(scale(expectancy))
                .createdAt(report.getCreatedAtUtc())
                .build();
    }

    private Map<String, Boolean> extractChecklistSignals(ContextSnapshot snapshot) {
        Map<String, Boolean> signals = new LinkedHashMap<>();
        appendSignalsFromStates(signals, snapshot.getPrereqsStatesJson());
        appendSignalsFromStates(signals, snapshot.getTriggersStatesJson());
        return signals;
    }

    private void appendSignalsFromStates(Map<String, Boolean> target, JsonNode states) {
        if (states == null || !states.isArray()) {
            return;
        }
        for (JsonNode item : states) {
            String text = normalizeOptionalText(item.path("text").asText(null));
            if (text == null) {
                continue;
            }
            boolean completed = item.path("completed").asBoolean(false);
            target.put(text, completed);
        }
    }

    private long countMissingRequired(ContextSnapshot snapshot) {
        return countMissingRequired(snapshot.getPrereqsStatesJson()) + countMissingRequired(snapshot.getTriggersStatesJson());
    }

    private long countMissingRequired(JsonNode states) {
        if (states == null || !states.isArray()) {
            return 0;
        }
        long count = 0;
        for (JsonNode item : states) {
            boolean required = item.path("required").asBoolean(false);
            boolean completed = item.path("completed").asBoolean(false);
            if (required && !completed) {
                count++;
            }
        }
        return count;
    }

    private BigDecimal scale(BigDecimal value) {
        if (value == null) {
            return null;
        }
        return value.setScale(4, RoundingMode.HALF_UP);
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private boolean equalsIgnoreCase(String value, String expected) {
        if (value == null || expected == null) {
            return false;
        }
        return value.equalsIgnoreCase(expected);
    }

    private BigDecimal parseDecimal(String raw) {
        if (raw == null || raw.isBlank()) {
            return BigDecimal.ZERO;
        }
        try {
            return new BigDecimal(raw);
        } catch (Exception ex) {
            return BigDecimal.ZERO;
        }
    }

    private record TradeSample(
            TradeSourceMode sourceMode,
            UUID id,
            UUID runId,
            UUID strategyId,
            String symbol,
            String sessionLabel,
            DayOfWeek dayOfWeek,
            BigDecimal rMultiple,
            BigDecimal maeR,
            BigDecimal mfeR,
            BigDecimal durationMinutes,
            OffsetDateTime eventTime,
            UUID contextSnapshotId
    ) {}

    private enum TradeSourceMode {
        LIVE,
        BACKTEST
    }

    private enum DiagnosticsMode {
        LIVE,
        BACKTEST,
        BOTH;

        static DiagnosticsMode from(String raw) {
            if (raw == null || raw.isBlank()) {
                return BOTH;
            }
            try {
                return DiagnosticsMode.valueOf(raw.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ex) {
                return BOTH;
            }
        }
    }

    private static final class StatsBucket {
        private int count;
        private int wins;
        private BigDecimal sumR = BigDecimal.ZERO;
        private BigDecimal grossProfit = BigDecimal.ZERO;
        private BigDecimal grossLoss = BigDecimal.ZERO;
        private BigDecimal sumMaeR = BigDecimal.ZERO;
        private BigDecimal sumMfeR = BigDecimal.ZERO;
        private int maeCount;
        private int mfeCount;
        private BigDecimal sumDurationMinutes = BigDecimal.ZERO;
        private int durationCount;

        void add(TradeSample sample) {
            if (sample == null || sample.rMultiple() == null) {
                return;
            }
            count++;
            BigDecimal r = sample.rMultiple();
            sumR = sumR.add(r);
            if (r.compareTo(BigDecimal.ZERO) > 0) {
                wins++;
                grossProfit = grossProfit.add(r);
            } else if (r.compareTo(BigDecimal.ZERO) < 0) {
                grossLoss = grossLoss.add(r.abs());
            }
            if (sample.maeR() != null) {
                sumMaeR = sumMaeR.add(sample.maeR());
                maeCount++;
            }
            if (sample.mfeR() != null) {
                sumMfeR = sumMfeR.add(sample.mfeR());
                mfeCount++;
            }
            if (sample.durationMinutes() != null) {
                sumDurationMinutes = sumDurationMinutes.add(sample.durationMinutes());
                durationCount++;
            }
        }

        BigDecimal expectancyR() {
            if (count == 0) {
                return BigDecimal.ZERO;
            }
            return sumR.divide(BigDecimal.valueOf(count), 6, RoundingMode.HALF_UP);
        }

        BigDecimal winRatePct() {
            if (count == 0) {
                return BigDecimal.ZERO;
            }
            return BigDecimal.valueOf(wins)
                    .multiply(BigDecimal.valueOf(100))
                    .divide(BigDecimal.valueOf(count), 6, RoundingMode.HALF_UP);
        }

        BigDecimal profitFactor() {
            if (grossLoss.compareTo(BigDecimal.ZERO) == 0) {
                return grossProfit.compareTo(BigDecimal.ZERO) == 0 ? BigDecimal.ZERO : null;
            }
            return grossProfit.divide(grossLoss, 6, RoundingMode.HALF_UP);
        }

        BigDecimal avgMaeR() {
            if (maeCount == 0) {
                return BigDecimal.ZERO;
            }
            return sumMaeR.divide(BigDecimal.valueOf(maeCount), 6, RoundingMode.HALF_UP);
        }

        BigDecimal avgMfeR() {
            if (mfeCount == 0) {
                return BigDecimal.ZERO;
            }
            return sumMfeR.divide(BigDecimal.valueOf(mfeCount), 6, RoundingMode.HALF_UP);
        }

        BigDecimal avgDurationMinutes() {
            if (durationCount == 0) {
                return BigDecimal.ZERO;
            }
            return sumDurationMinutes.divide(BigDecimal.valueOf(durationCount), 6, RoundingMode.HALF_UP);
        }
    }
}
