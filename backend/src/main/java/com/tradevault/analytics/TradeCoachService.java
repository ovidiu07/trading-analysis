package com.tradevault.analytics;

import com.tradevault.config.TradeCoachConfig;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.analytics.*;
import com.tradevault.repository.TradeRepository;
import com.tradevault.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TradeCoachService {
    private static final ZoneId DISPLAY_ZONE = ZoneId.of("Europe/Bucharest");

    private final TradeRepository tradeRepository;
    private final CurrentUserService currentUserService;
    private final TradeCoachConfig config;

    public CoachResponse coach(OffsetDateTime from,
                               OffsetDateTime to,
                               String symbol,
                               Direction direction,
                               TradeStatus status,
                               String strategy,
                               String setup,
                               String catalyst,
                               String market,
                               String dateMode,
                               boolean excludeOutliers) {
        User user = currentUserService.getCurrentUser();
        List<Trade> trades = tradeRepository.findByUserId(user.getId());
        DateMode mode = DateMode.fromString(dateMode);
        List<Trade> filtered = filterTrades(trades, from, to, symbol, direction, status, strategy, setup, catalyst, market, mode);
        CoachDataQuality dataQuality = buildDataQuality(filtered);

        List<Trade> closedTrades = filtered.stream()
                .filter(t -> t.getStatus() == TradeStatus.CLOSED && t.getClosedAt() != null)
                .toList();

        List<Trade> closedForMetrics = excludeOutliers ? filterOutliers(closedTrades) : closedTrades;
        List<TradeMetrics> metrics = closedForMetrics.stream()
                .map(trade -> toMetrics(trade, mode))
                .filter(Objects::nonNull)
                .toList();

        boolean dataQualityPenalty = hasDataQualityPenalty(dataQuality);
        List<AdviceCard> advice = new ArrayList<>();
        advice.addAll(buildHourAdvice(metrics, mode, dataQualityPenalty));
        advice.addAll(buildSymbolAdvice(metrics, mode, dataQualityPenalty));
        advice.addAll(buildHoldingBucketAdvice(metrics, mode, dataQualityPenalty));
        advice.addAll(buildStyleAdvice(metrics, dataQualityPenalty));
        advice.addAll(buildCostAdvice(metrics, dataQualityPenalty));
        advice.addAll(buildOvertradingAdvice(metrics, mode, dataQualityPenalty));
        advice.addAll(buildDataQualityAdvice(dataQuality, metrics.size(), mode));

        return CoachResponse.builder()
                .dataQuality(dataQuality)
                .advice(advice)
                .build();
    }

    private List<Trade> filterTrades(List<Trade> trades,
                                     OffsetDateTime from,
                                     OffsetDateTime to,
                                     String symbol,
                                     Direction direction,
                                     TradeStatus status,
                                     String strategy,
                                     String setup,
                                     String catalyst,
                                     String market,
                                     DateMode mode) {
        List<Trade> filtered = trades;
        if (symbol != null && !symbol.isBlank()) {
            Set<String> symbols = parseFilterValues(symbol);
            filtered = filtered.stream().filter(t -> t.getSymbol() != null && symbols.contains(t.getSymbol().toLowerCase(Locale.ROOT))).toList();
        }
        if (direction != null) {
            filtered = filtered.stream().filter(t -> t.getDirection() == direction).toList();
        }
        if (market != null && !market.isBlank()) {
            Set<String> markets = parseFilterValues(market);
            filtered = filtered.stream().filter(t -> t.getMarket() != null && markets.contains(t.getMarket().name().toLowerCase(Locale.ROOT))).toList();
        }
        if (status != null) {
            filtered = filtered.stream().filter(t -> t.getStatus() == status).toList();
        }
        if (strategy != null && !strategy.isBlank()) {
            Set<String> strategies = parseFilterValues(strategy);
            filtered = filtered.stream().filter(t -> t.getStrategyTag() != null && strategies.contains(t.getStrategyTag().toLowerCase(Locale.ROOT))).toList();
        }
        if (setup != null && !setup.isBlank()) {
            Set<String> setups = parseFilterValues(setup);
            filtered = filtered.stream().filter(t -> t.getSetup() != null && setups.contains(t.getSetup().toLowerCase(Locale.ROOT))).toList();
        }
        if (catalyst != null && !catalyst.isBlank()) {
            Set<String> catalysts = parseFilterValues(catalyst);
            filtered = filtered.stream().filter(t -> t.getCatalystTag() != null && catalysts.contains(t.getCatalystTag().toLowerCase(Locale.ROOT))).toList();
        }
        if (from != null || to != null) {
            filtered = filtered.stream().filter(t -> {
                OffsetDateTime time = getEventTime(t, mode);
                if (time == null) return false;
                boolean afterFrom = from == null || !time.isBefore(from);
                boolean beforeTo = to == null || !time.isAfter(to);
                return afterFrom && beforeTo;
            }).toList();
        }
        return filtered;
    }

    private CoachDataQuality buildDataQuality(List<Trade> trades) {
        int total = trades.size();
        int closed = (int) trades.stream().filter(t -> t.getStatus() == TradeStatus.CLOSED).count();
        int missingClosedAt = (int) trades.stream()
                .filter(t -> t.getStatus() == TradeStatus.CLOSED && t.getClosedAt() == null)
                .count();
        int missingPnlNet = (int) trades.stream()
                .filter(t -> t.getStatus() == TradeStatus.CLOSED && t.getClosedAt() != null && t.getPnlNet() == null)
                .count();
        int missingEntryExit = (int) trades.stream()
                .filter(t -> t.getStatus() == TradeStatus.CLOSED)
                .filter(t -> t.getEntryPrice() == null || t.getExitPrice() == null || t.getQuantity() == null)
                .count();
        int inconsistentPnl = (int) trades.stream()
                .filter(t -> t.getStatus() == TradeStatus.CLOSED && t.getPnlNet() != null)
                .filter(this::isPnlInconsistent)
                .count();

        return CoachDataQuality.builder()
                .totalTrades(total)
                .closedTrades(closed)
                .missingClosedAtCount(missingClosedAt)
                .missingPnlNetCount(missingPnlNet)
                .missingEntryExitCount(missingEntryExit)
                .inconsistentPnlCount(inconsistentPnl)
                .build();
    }

    private boolean isPnlInconsistent(Trade trade) {
        if (trade.getEntryPrice() == null || trade.getExitPrice() == null || trade.getQuantity() == null || trade.getDirection() == null) {
            return false;
        }
        BigDecimal qty = trade.getQuantity();
        BigDecimal entry = trade.getEntryPrice();
        BigDecimal exit = trade.getExitPrice();
        BigDecimal expected = trade.getDirection() == Direction.LONG
                ? exit.subtract(entry).multiply(qty)
                : entry.subtract(exit).multiply(qty);
        BigDecimal actual = trade.getPnlNet();
        BigDecimal diff = expected.subtract(actual).abs();
        BigDecimal threshold = expected.abs().multiply(BigDecimal.valueOf(0.1));
        if (threshold.compareTo(BigDecimal.ONE) < 0) {
            threshold = BigDecimal.ONE;
        }
        return diff.compareTo(threshold) > 0;
    }

    private boolean hasDataQualityPenalty(CoachDataQuality dataQuality) {
        if (dataQuality.getClosedTrades() == 0) return false;
        double ratio = (double) (dataQuality.getMissingClosedAtCount()
                + dataQuality.getMissingPnlNetCount()
                + dataQuality.getMissingEntryExitCount()
                + dataQuality.getInconsistentPnlCount())
                / Math.max(1, dataQuality.getClosedTrades());
        return ratio >= config.getDataQualityPenaltyRatio();
    }

    private TradeMetrics toMetrics(Trade trade, DateMode mode) {
        if (trade.getClosedAt() == null && trade.getOpenedAt() == null) return null;
        OffsetDateTime eventTime = getEventTime(trade, mode);
        if (eventTime == null) return null;
        BigDecimal pnlNet = trade.getPnlNet() == null ? BigDecimal.ZERO : trade.getPnlNet();
        BigDecimal fees = trade.getFees() == null ? BigDecimal.ZERO : trade.getFees();
        BigDecimal commission = trade.getCommission() == null ? BigDecimal.ZERO : trade.getCommission();
        BigDecimal slippage = trade.getSlippage() == null ? BigDecimal.ZERO : trade.getSlippage();
        BigDecimal costs = fees.add(commission).add(slippage);
        Long holdingMinutes = holdingMinutes(trade);
        ZonedDateTime zoned = eventTime.atZoneSameInstant(DISPLAY_ZONE);
        int hour = zoned.getHour();
        int dayOfWeek = zoned.getDayOfWeek().getValue();
        BigDecimal r = rEstimate(trade, pnlNet);
        String holdingBucket = bucketHoldingTime(trade);

        return new TradeMetrics(trade.getId(), pnlNet, costs, holdingMinutes, hour, dayOfWeek, r, holdingBucket, eventTime, trade.getSymbol(), trade.getMarket() == null ? null : trade.getMarket().name(), trade.getDirection() == null ? null : trade.getDirection().name(),
                trade.getStrategyTag(), trade.getSetup(), trade.getCatalystTag());
    }

    private List<AdviceCard> buildHourAdvice(List<TradeMetrics> metrics, DateMode mode, boolean dataQualityPenalty) {
        Map<Integer, GroupStats> hourStats = groupBy(metrics, TradeMetrics::hourOfDay);
        List<GroupStatsEntry<Integer>> eligible = hourStats.entrySet().stream()
                .filter(entry -> entry.getValue().count >= config.getMinTradesForFinding())
                .map(entry -> new GroupStatsEntry<>(entry.getKey(), entry.getValue()))
                .toList();
        if (eligible.isEmpty()) {
            return List.of();
        }
        GroupStatsEntry<Integer> best = eligible.stream().max(Comparator.comparing(e -> e.stats.totalNet)).orElse(null);
        GroupStatsEntry<Integer> worst = eligible.stream().min(Comparator.comparing(e -> e.stats.totalNet)).orElse(null);
        List<AdviceCard> results = new ArrayList<>();
        if (best != null) {
            results.add(AdviceCard.builder()
                    .id("coach-hour-best-" + best.key)
                    .severity(AdviceSeverity.INFO)
                    .confidence(confidenceForCount(best.stats.count, dataQualityPenalty))
                    .title(String.format("Best close hour: %02d:00", best.key))
                    .message(List.of(
                            "This hour delivers your highest net P&L and expectancy.",
                            "Consider prioritizing setups that complete around this window."
                    ))
                    .evidence(buildEvidence(best.stats))
                    .recommendedActions(List.of("Allocate more focus to this hour", "Review setups that win here"))
                    .filters(AdviceFilters.builder().hourBucket(String.valueOf(best.key)).dateMode(mode.name()).status("CLOSED").build())
                    .build());
        }
        if (worst != null && (best == null || !Objects.equals(best.key, worst.key))) {
            results.add(AdviceCard.builder()
                    .id("coach-hour-worst-" + worst.key)
                    .severity(AdviceSeverity.WARN)
                    .confidence(confidenceForCount(worst.stats.count, dataQualityPenalty))
                    .title(String.format("Weak close hour: %02d:00", worst.key))
                    .message(List.of(
                            "This hour has the weakest net performance.",
                            "Reduce size or avoid marginal setups here."
                    ))
                    .evidence(buildEvidence(worst.stats))
                    .recommendedActions(List.of("Cut size during this hour", "Skip low-conviction setups"))
                    .filters(AdviceFilters.builder().hourBucket(String.valueOf(worst.key)).dateMode(mode.name()).status("CLOSED").build())
                    .build());
        }
        return results;
    }

    private List<AdviceCard> buildSymbolAdvice(List<TradeMetrics> metrics, DateMode mode, boolean dataQualityPenalty) {
        Map<String, GroupStats> symbolStats = groupBy(metrics, TradeMetrics::symbol);
        List<GroupStatsEntry<String>> eligible = symbolStats.entrySet().stream()
                .filter(entry -> entry.getValue().count >= config.getMinTradesForFinding())
                .map(entry -> new GroupStatsEntry<>(entry.getKey(), entry.getValue()))
                .toList();
        if (eligible.isEmpty()) {
            return List.of();
        }
        List<AdviceCard> results = new ArrayList<>();
        eligible.stream()
                .sorted(Comparator.comparing((GroupStatsEntry<String> entry) -> entry.stats.totalNet).reversed())
                .limit(3)
                .forEach(entry -> results.add(AdviceCard.builder()
                        .id("coach-symbol-focus-" + entry.key.toLowerCase(Locale.ROOT))
                        .severity(AdviceSeverity.INFO)
                        .confidence(confidenceForCount(entry.stats.count, dataQualityPenalty))
                        .title("Lean into " + entry.key)
                        .message(List.of(
                                "This symbol is one of your strongest contributors.",
                                "Increase attention on repeatable setups that work here."
                        ))
                        .evidence(buildEvidence(entry.stats))
                        .recommendedActions(List.of("Review best setups on " + entry.key, "Keep sizing consistent here"))
                        .filters(AdviceFilters.builder().symbol(entry.key).dateMode(mode.name()).status("CLOSED").build())
                        .build()));

        eligible.stream()
                .filter(entry -> entry.stats.totalNet.compareTo(BigDecimal.ZERO) < 0)
                .filter(entry -> entry.stats.profitFactor() != null && entry.stats.profitFactor() < 0.9)
                .forEach(entry -> {
                    AdviceSeverity severity = entry.stats.expectancy().compareTo(BigDecimal.valueOf(config.getCriticalExpectancy())) <= 0
                            ? AdviceSeverity.CRITICAL
                            : AdviceSeverity.WARN;
                    results.add(AdviceCard.builder()
                            .id("coach-symbol-avoid-" + entry.key.toLowerCase(Locale.ROOT))
                            .severity(severity)
                            .confidence(confidenceForCount(entry.stats.count, dataQualityPenalty))
                            .title("Consider pausing " + entry.key)
                            .message(List.of(
                                    "Results are negative with weak profit factor.",
                                    "Stand down until you identify a clear edge or better conditions."
                            ))
                            .evidence(buildEvidence(entry.stats))
                            .recommendedActions(List.of("Pause trades on " + entry.key, "Audit recent losses for common triggers"))
                            .filters(AdviceFilters.builder().symbol(entry.key).dateMode(mode.name()).status("CLOSED").build())
                            .build());
                });
        return results;
    }

    private List<AdviceCard> buildHoldingBucketAdvice(List<TradeMetrics> metrics, DateMode mode, boolean dataQualityPenalty) {
        Map<String, GroupStats> holdingStats = groupBy(metrics, TradeMetrics::holdingBucket);
        List<GroupStatsEntry<String>> eligible = holdingStats.entrySet().stream()
                .filter(entry -> entry.getValue().count >= config.getMinTradesForFinding())
                .map(entry -> new GroupStatsEntry<>(entry.getKey(), entry.getValue()))
                .toList();
        if (eligible.size() < 2) {
            return List.of();
        }
        GroupStatsEntry<String> best = eligible.stream().max(Comparator.comparing(e -> e.stats.expectancy())).orElse(null);
        GroupStatsEntry<String> worst = eligible.stream().min(Comparator.comparing(e -> e.stats.expectancy())).orElse(null);
        if (best == null || worst == null || Objects.equals(best.key, worst.key)) {
            return List.of();
        }
        BigDecimal delta = best.stats.expectancy().subtract(worst.stats.expectancy()).abs();
        boolean useR = best.stats.averageR() != null && worst.stats.averageR() != null;
        boolean triggered = useR
                ? best.stats.averageR().subtract(worst.stats.averageR()).abs().compareTo(BigDecimal.valueOf(config.getHoldingBucketDeltaR())) >= 0
                : delta.compareTo(BigDecimal.valueOf(config.getHoldingBucketDelta())) >= 0;
        if (!triggered) {
            return List.of();
        }
        return List.of(AdviceCard.builder()
                .id("coach-holding-leak-" + worst.key)
                .severity(AdviceSeverity.WARN)
                .confidence(confidenceForCount(worst.stats.count, dataQualityPenalty))
                .title("Holding time leak: " + worst.key)
                .message(List.of(
                        "This holding bucket underperforms the best bucket by a wide margin.",
                        "Reduce exposure or tighten exits when trades drift into this range."
                ))
                .evidence(buildEvidence(worst.stats))
                .recommendedActions(List.of("Review exits for " + worst.key + " trades", "Set time-based stop for this bucket"))
                .filters(AdviceFilters.builder().holdingBucket(worst.key).dateMode(mode.name()).status("CLOSED").build())
                .build());
    }

    private List<AdviceCard> buildStyleAdvice(List<TradeMetrics> metrics, boolean dataQualityPenalty) {
        GroupStats overall = summarize(metrics);
        if (overall.count < config.getMinTradesForFinding()) {
            return List.of();
        }
        List<AdviceCard> results = new ArrayList<>();
        double winRate = overall.winRate();
        BigDecimal payoff = overall.payoffRatio();
        if (winRate > 55 && payoff != null && payoff.compareTo(BigDecimal.valueOf(0.8)) < 0) {
            results.add(AdviceCard.builder()
                    .id("coach-payoff-compression")
                    .severity(AdviceSeverity.WARN)
                    .confidence(confidenceForCount(overall.count, dataQualityPenalty))
                    .title("Profits may be cut early")
                    .message(List.of(
                            "Win rate is strong, but payoff ratio is below target.",
                            "Let winners run slightly longer or tighten stop placement."
                    ))
                    .evidence(buildEvidence(overall))
                    .recommendedActions(List.of("Review exit rules", "Measure average win expansion targets"))
                    .filters(AdviceFilters.builder().status("CLOSED").build())
                    .build());
        }
        if (winRate < 45 && payoff != null && payoff.compareTo(BigDecimal.valueOf(1.4)) > 0) {
            results.add(AdviceCard.builder()
                    .id("coach-low-win-high-payoff")
                    .severity(AdviceSeverity.INFO)
                    .confidence(confidenceForCount(overall.count, dataQualityPenalty))
                    .title("Lower win rate, healthy payoff")
                    .message(List.of(
                            "Your losers are contained relative to winners.",
                            "Focus on selectivity to lift the win rate without shrinking payoff."
                    ))
                    .evidence(buildEvidence(overall))
                    .recommendedActions(List.of("Tighten entry filters", "Continue keeping losers small"))
                    .filters(AdviceFilters.builder().status("CLOSED").build())
                    .build());
        }
        if (overall.expectancy().compareTo(BigDecimal.ZERO) < 0 && overall.profitFactor() != null && overall.profitFactor() < 1) {
            results.add(AdviceCard.builder()
                    .id("coach-negative-edge")
                    .severity(AdviceSeverity.WARN)
                    .confidence(confidenceForCount(overall.count, dataQualityPenalty))
                    .title("Strategy edge is negative")
                    .message(List.of(
                            "Expectancy and profit factor are below breakeven.",
                            "Tighten criteria or reduce size until edge improves."
                    ))
                    .evidence(buildEvidence(overall))
                    .recommendedActions(List.of("Audit recent trades", "Reduce size on marginal setups"))
                    .filters(AdviceFilters.builder().status("CLOSED").build())
                    .build());
        }
        return results;
    }

    private List<AdviceCard> buildCostAdvice(List<TradeMetrics> metrics, boolean dataQualityPenalty) {
        GroupStats overall = summarize(metrics);
        if (overall.count < config.getMinTradesForFinding()) {
            return List.of();
        }
        BigDecimal grossProfit = metrics.stream()
                .map(TradeMetrics::pnlNet)
                .filter(pnl -> pnl.compareTo(BigDecimal.ZERO) > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalCosts = overall.totalCosts;
        BigDecimal avgCosts = overall.count == 0 ? BigDecimal.ZERO : totalCosts.divide(BigDecimal.valueOf(overall.count), 2, RoundingMode.HALF_UP);
        boolean costPctTriggered = grossProfit.compareTo(BigDecimal.ZERO) > 0 &&
                totalCosts.divide(grossProfit, 4, RoundingMode.HALF_UP).compareTo(BigDecimal.valueOf(config.getCostDragPct())) > 0;
        boolean costAvgTriggered = avgCosts.compareTo(BigDecimal.valueOf(config.getCostDragAvg())) > 0;
        if (!costPctTriggered && !costAvgTriggered) {
            return List.of();
        }
        return List.of(AdviceCard.builder()
                .id("coach-costs-drag")
                .severity(AdviceSeverity.WARN)
                .confidence(confidenceForCount(overall.count, dataQualityPenalty))
                .title("Costs are a material drag")
                .message(List.of(
                        "Trading costs are eating into profits.",
                        "Reduce churn or focus on higher-quality setups."
                ))
                .evidence(List.of(
                        AdviceEvidence.builder().label("Trades").value((double) overall.count).kind("number").build(),
                        AdviceEvidence.builder().label("Avg costs").value(avgCosts.doubleValue()).kind("currency").build(),
                        AdviceEvidence.builder().label("Total costs").value(totalCosts.doubleValue()).kind("currency").build()
                ))
                .recommendedActions(List.of("Avoid low edge trades", "Batch entries to reduce fees"))
                .filters(AdviceFilters.builder().status("CLOSED").build())
                .build());
    }

    private List<AdviceCard> buildOvertradingAdvice(List<TradeMetrics> metrics, DateMode mode, boolean dataQualityPenalty) {
        if (metrics.size() < config.getMinTradesForFinding()) {
            return List.of();
        }
        Map<LocalDate, List<TradeMetrics>> byDay = metrics.stream()
                .filter(m -> m.eventTime != null)
                .collect(Collectors.groupingBy(m -> toLocalDate(m.eventTime)));
        List<Integer> counts = byDay.values().stream().map(List::size).sorted().toList();
        if (counts.isEmpty()) {
            return List.of();
        }
        int threshold = percentile(counts, 75);
        List<TradeMetrics> highVolumeTrades = byDay.values().stream()
                .filter(list -> list.size() >= threshold)
                .flatMap(List::stream)
                .toList();
        GroupStats highVolumeStats = summarize(highVolumeTrades);
        List<AdviceCard> results = new ArrayList<>();
        if (highVolumeStats.count >= config.getMinTradesForFinding() && highVolumeStats.expectancy().compareTo(BigDecimal.ZERO) < 0) {
            results.add(AdviceCard.builder()
                    .id("coach-overtrading-days")
                    .severity(AdviceSeverity.WARN)
                    .confidence(confidenceForCount(highVolumeStats.count, dataQualityPenalty))
                    .title("High-volume days lose money")
                    .message(List.of(
                            "Your busiest days are net negative.",
                            "Cap daily trades or pause after a drawdown."
                    ))
                    .evidence(buildEvidence(highVolumeStats))
                    .recommendedActions(List.of("Set a daily trade limit", "Pause after 2 consecutive losses"))
                    .filters(AdviceFilters.builder().dateMode(mode.name()).status("CLOSED").build())
                    .build());
        }

        List<TradeMetrics> clusterTrades = findClusterTrades(metrics);
        GroupStats clusterStats = summarize(clusterTrades);
        if (clusterStats.count >= config.getMinTradesForFinding() && clusterStats.expectancy().compareTo(BigDecimal.ZERO) < 0) {
            results.add(AdviceCard.builder()
                    .id("coach-overtrading-clusters")
                    .severity(AdviceSeverity.WARN)
                    .confidence(confidenceForCount(clusterStats.count, dataQualityPenalty))
                    .title("Rapid-fire trades are dragging results")
                    .message(List.of(
                            "Trades placed within minutes of each other are net negative.",
                            "Slow down to avoid reactive decisions."
                    ))
                    .evidence(buildEvidence(clusterStats))
                    .recommendedActions(List.of("Pause 10 minutes after a trade", "Review triggers before re-entry"))
                    .filters(AdviceFilters.builder().dateMode(mode.name()).status("CLOSED").build())
                    .build());
        }
        return results;
    }

    private List<AdviceCard> buildDataQualityAdvice(CoachDataQuality dataQuality, int sampleSize, DateMode mode) {
        boolean hasIssues = dataQuality.getMissingClosedAtCount() > 0
                || dataQuality.getMissingPnlNetCount() > 0
                || dataQuality.getMissingEntryExitCount() > 0
                || dataQuality.getInconsistentPnlCount() > 0;
        if (!hasIssues) {
            return List.of();
        }
        List<String> bullets = new ArrayList<>();
        if (dataQuality.getMissingClosedAtCount() > 0) {
            bullets.add("Closed trades are missing close timestamps.");
        }
        if (dataQuality.getMissingPnlNetCount() > 0) {
            bullets.add("Some closed trades are missing net P&L.");
        }
        if (dataQuality.getMissingEntryExitCount() > 0) {
            bullets.add("Entry/exit/quantity fields are incomplete.");
        }
        if (dataQuality.getInconsistentPnlCount() > 0) {
            bullets.add("Some P&L values do not match price math.");
        }
        AdviceCard card = AdviceCard.builder()
                .id("coach-data-quality")
                .severity(AdviceSeverity.WARN)
                .confidence(confidenceForCount(Math.max(sampleSize, dataQuality.getClosedTrades()), false))
                .title("Improve trade logging quality")
                .message(bullets)
                .evidence(List.of(
                        AdviceEvidence.builder().label("Missing close time").value((double) dataQuality.getMissingClosedAtCount()).kind("number").build(),
                        AdviceEvidence.builder().label("Missing P&L").value((double) dataQuality.getMissingPnlNetCount()).kind("number").build(),
                        AdviceEvidence.builder().label("Missing prices/qty").value((double) dataQuality.getMissingEntryExitCount()).kind("number").build(),
                        AdviceEvidence.builder().label("Inconsistent P&L").value((double) dataQuality.getInconsistentPnlCount()).kind("number").build()
                ))
                .recommendedActions(List.of("Fill in missing trade fields", "Recalculate P&L after import"))
                .filters(AdviceFilters.builder().dateMode(mode.name()).build())
                .build();
        return List.of(card);
    }

    private List<TradeMetrics> findClusterTrades(List<TradeMetrics> metrics) {
        List<TradeMetrics> sorted = metrics.stream()
                .filter(m -> m.eventTime != null)
                .sorted(Comparator.comparing(m -> m.eventTime))
                .toList();
        if (sorted.size() < 2) return List.of();
        List<TradeMetrics> clusters = new ArrayList<>();
        for (int i = 1; i < sorted.size(); i++) {
            TradeMetrics prev = sorted.get(i - 1);
            TradeMetrics current = sorted.get(i);
            long minutes = Duration.between(prev.eventTime, current.eventTime).toMinutes();
            if (minutes < config.getOvertradingClusterMinutes()) {
                if (clusters.isEmpty() || clusters.get(clusters.size() - 1).id != prev.id) {
                    clusters.add(prev);
                }
                clusters.add(current);
            }
        }
        return clusters;
    }

    private GroupStats summarize(List<TradeMetrics> metrics) {
        GroupStats stats = new GroupStats();
        metrics.forEach(stats::add);
        return stats;
    }

    private <K> Map<K, GroupStats> groupBy(List<TradeMetrics> metrics, java.util.function.Function<TradeMetrics, K> keyExtractor) {
        Map<K, GroupStats> grouped = new HashMap<>();
        for (TradeMetrics metric : metrics) {
            K key = keyExtractor.apply(metric);
            if (key == null) continue;
            grouped.computeIfAbsent(key, k -> new GroupStats()).add(metric);
        }
        return grouped;
    }

    private List<AdviceEvidence> buildEvidence(GroupStats stats) {
        List<AdviceEvidence> evidence = new ArrayList<>();
        evidence.add(AdviceEvidence.builder().label("Trades").value((double) stats.count).kind("number").build());
        evidence.add(AdviceEvidence.builder().label("Expectancy").value(stats.expectancy().doubleValue()).kind("currency").build());
        evidence.add(AdviceEvidence.builder().label("Profit factor").value(stats.profitFactor()).kind("number").build());
        evidence.add(AdviceEvidence.builder().label("Win rate").value(stats.winRate()).kind("percent").build());
        evidence.add(AdviceEvidence.builder().label("Total net").value(stats.totalNet.doubleValue()).kind("currency").build());
        return evidence;
    }

    private AdviceConfidence confidenceForCount(int count, boolean penalize) {
        AdviceConfidence base;
        if (count < 10) {
            base = AdviceConfidence.LOW;
        } else if (count < 30) {
            base = AdviceConfidence.MEDIUM;
        } else {
            base = AdviceConfidence.HIGH;
        }
        if (!penalize) return base;
        return switch (base) {
            case HIGH -> AdviceConfidence.MEDIUM;
            case MEDIUM -> AdviceConfidence.LOW;
            default -> AdviceConfidence.LOW;
        };
    }

    private Long holdingMinutes(Trade trade) {
        if (trade.getOpenedAt() == null || trade.getClosedAt() == null) return null;
        return Duration.between(trade.getOpenedAt(), trade.getClosedAt()).toMinutes();
    }

    private String bucketHoldingTime(Trade trade) {
        Long minutes = holdingMinutes(trade);
        if (minutes == null) return null;
        if (minutes < 5) return "<5m";
        if (minutes < 15) return "5-15m";
        if (minutes < 60) return "15-60m";
        if (minutes < 240) return "1-4h";
        return ">4h";
    }

    private BigDecimal rEstimate(Trade trade, BigDecimal pnlNet) {
        if (trade.getRMultiple() != null) {
            return trade.getRMultiple();
        }
        if (trade.getRiskAmount() != null && trade.getRiskAmount().compareTo(BigDecimal.ZERO) != 0) {
            return pnlNet.divide(trade.getRiskAmount(), 4, RoundingMode.HALF_UP);
        }
        return null;
    }

    private OffsetDateTime getEventTime(Trade trade, DateMode mode) {
        return mode == DateMode.OPEN ? trade.getOpenedAt() : trade.getClosedAt();
    }

    private LocalDate toLocalDate(OffsetDateTime time) {
        return time.atZoneSameInstant(DISPLAY_ZONE).toLocalDate();
    }

    private Set<String> parseFilterValues(String value) {
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .map(s -> s.toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
    }

    private List<Trade> filterOutliers(List<Trade> trades) {
        List<BigDecimal> pnlValues = trades.stream()
                .map(t -> t.getPnlNet() == null ? BigDecimal.ZERO : t.getPnlNet())
                .sorted()
                .toList();
        if (pnlValues.isEmpty()) {
            return trades;
        }
        BigDecimal p1 = percentile(pnlValues, 1);
        BigDecimal p99 = percentile(pnlValues, 99);
        return trades.stream()
                .filter(t -> {
                    BigDecimal pnl = t.getPnlNet() == null ? BigDecimal.ZERO : t.getPnlNet();
                    return pnl.compareTo(p1) >= 0 && pnl.compareTo(p99) <= 0;
                })
                .toList();
    }

    private BigDecimal percentile(List<BigDecimal> values, int percentile) {
        if (values.isEmpty()) return BigDecimal.ZERO;
        int index = (int) Math.ceil(percentile / 100.0 * values.size()) - 1;
        index = Math.max(0, Math.min(index, values.size() - 1));
        return values.get(index);
    }

    private int percentile(List<Integer> values, int percentile) {
        if (values.isEmpty()) return 0;
        int index = (int) Math.ceil(percentile / 100.0 * values.size()) - 1;
        index = Math.max(0, Math.min(index, values.size() - 1));
        return values.get(index);
    }

    private record TradeMetrics(
            UUID id,
            BigDecimal pnlNet,
            BigDecimal costs,
            Long holdingMinutes,
            Integer hourOfDay,
            Integer dayOfWeek,
            BigDecimal rMultiple,
            String holdingBucket,
            OffsetDateTime eventTime,
            String symbol,
            String market,
            String direction,
            String strategyTag,
            String setup,
            String catalystTag
    ) {}

    private static class GroupStats {
        private int count = 0;
        private int wins = 0;
        private int losses = 0;
        private BigDecimal totalNet = BigDecimal.ZERO;
        private BigDecimal totalCosts = BigDecimal.ZERO;
        private BigDecimal sumWins = BigDecimal.ZERO;
        private BigDecimal sumLosses = BigDecimal.ZERO;
        private final List<BigDecimal> pnlValues = new ArrayList<>();
        private final List<BigDecimal> rValues = new ArrayList<>();

        void add(TradeMetrics metric) {
            if (metric == null) return;
            count++;
            BigDecimal pnl = metric.pnlNet == null ? BigDecimal.ZERO : metric.pnlNet;
            pnlValues.add(pnl);
            totalNet = totalNet.add(pnl);
            totalCosts = totalCosts.add(metric.costs == null ? BigDecimal.ZERO : metric.costs);
            if (pnl.compareTo(BigDecimal.ZERO) > 0) {
                wins++;
                sumWins = sumWins.add(pnl);
            } else if (pnl.compareTo(BigDecimal.ZERO) < 0) {
                losses++;
                sumLosses = sumLosses.add(pnl);
            }
            if (metric.rMultiple != null) {
                rValues.add(metric.rMultiple);
            }
        }

        double winRate() {
            if (count == 0) return 0;
            return (double) wins / count * 100;
        }

        BigDecimal expectancy() {
            if (count == 0) return BigDecimal.ZERO;
            return totalNet.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
        }

        BigDecimal averageWin() {
            if (wins == 0) return BigDecimal.ZERO;
            return sumWins.divide(BigDecimal.valueOf(wins), 2, RoundingMode.HALF_UP);
        }

        BigDecimal averageLoss() {
            if (losses == 0) return BigDecimal.ZERO;
            return sumLosses.divide(BigDecimal.valueOf(losses), 2, RoundingMode.HALF_UP);
        }

        Double profitFactor() {
            if (sumLosses.compareTo(BigDecimal.ZERO) == 0) return null;
            BigDecimal pf = sumWins.divide(sumLosses.abs(), 4, RoundingMode.HALF_UP);
            return pf.doubleValue();
        }

        BigDecimal payoffRatio() {
            BigDecimal avgLoss = averageLoss();
            if (avgLoss.compareTo(BigDecimal.ZERO) == 0) return null;
            return averageWin().divide(avgLoss.abs(), 2, RoundingMode.HALF_UP);
        }

        BigDecimal medianPnl() {
            if (pnlValues.isEmpty()) return BigDecimal.ZERO;
            List<BigDecimal> sorted = pnlValues.stream().sorted().toList();
            int mid = sorted.size() / 2;
            if (sorted.size() % 2 == 0) {
                return sorted.get(mid - 1).add(sorted.get(mid)).divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
            }
            return sorted.get(mid);
        }

        BigDecimal averageR() {
            if (rValues.isEmpty()) return null;
            BigDecimal total = rValues.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            return total.divide(BigDecimal.valueOf(rValues.size()), 4, RoundingMode.HALF_UP);
        }
    }

    private record GroupStatsEntry<K>(K key, GroupStats stats) {}
}
