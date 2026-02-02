package com.tradevault.analytics;

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
import java.time.temporal.WeekFields;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnalyticsService {
    private final TradeRepository tradeRepository;
    private final CurrentUserService currentUserService;
    private static final ZoneId DISPLAY_ZONE = ZoneId.of("Europe/Bucharest");
    private static final int LOW_SAMPLE_THRESHOLD = 20;

    public AnalyticsResponse summarize(OffsetDateTime from,
                                       OffsetDateTime to,
                                       String symbol,
                                       Direction direction,
                                       TradeStatus status,
                                       String strategy,
                                       String setup,
                                       String catalyst,
                                       String market,
                                       String dateMode,
                                       boolean excludeOutliers,
                                       String holdingBucket) {
        User user = currentUserService.getCurrentUser();
        List<Trade> trades = tradeRepository.findByUserId(user.getId());
        DateMode mode = DateMode.fromString(dateMode);
        List<Trade> filtered = filterTrades(trades, from, to, symbol, direction, status, strategy, setup, catalyst, market, mode, holdingBucket);
        FilterOptions filterOptions = buildFilterOptions(trades);

        List<Trade> closedTrades = filtered.stream()
                .filter(t -> t.getStatus() == TradeStatus.CLOSED && t.getClosedAt() != null)
                .toList();
        List<Trade> openTrades = filtered.stream()
                .filter(t -> t.getStatus() == TradeStatus.OPEN)
                .toList();

        OutlierResult outlierResult = calculateOutliers(closedTrades);
        List<Trade> closedForMetrics = excludeOutliers ? filterOutliers(closedTrades, outlierResult) : closedTrades;

        KpiSummary kpi = buildKpi(closedForMetrics, openTrades.size(), closedTrades.size());
        CostSummary costs = buildCosts(closedForMetrics);
        DrawdownResult drawdownResult = buildDrawdown(closedForMetrics);
        DistributionSummary distribution = buildDistribution(closedForMetrics, outlierResult);
        List<TimeSeriesPoint> equity = drawdownResult.equityCurve;
        List<TimeSeriesPoint> grouped = groupByDate(closedForMetrics, mode);
        List<TimeSeriesPoint> weekly = groupByWeek(closedForMetrics, mode);
        ConsistencySummary consistency = buildConsistency(closedForMetrics, grouped, weekly);
        TimeEdgeSummary timeEdge = buildTimeEdge(closedForMetrics, mode);
        AttributionSummary attribution = buildAttribution(closedForMetrics);
        RiskSummary risk = buildRisk(closedForMetrics);
        DataQualitySummary dataQuality = buildDataQuality(filtered);
        TraderReadSummary traderRead = buildTraderRead(attribution, timeEdge, drawdownResult, kpi, closedForMetrics.size());

        Map<String, Double> breakdown = closedForMetrics.stream().collect(Collectors.groupingBy(
                t -> Optional.ofNullable(t.getStrategyTag()).filter(s -> !s.isBlank()).orElse("Unspecified"),
                Collectors.summingDouble(t -> t.getPnlNet() == null ? 0 : t.getPnlNet().doubleValue())));

        return AnalyticsResponse.builder()
                .kpi(kpi)
                .costs(costs)
                .drawdown(drawdownResult.summary)
                .distribution(distribution)
                .consistency(consistency)
                .timeEdge(timeEdge)
                .attribution(attribution)
                .risk(risk)
                .dataQuality(dataQuality)
                .traderRead(traderRead)
                .filterOptions(filterOptions)
                .equityCurve(equity)
                .groupedPnl(grouped)
                .drawdownSeries(drawdownResult.drawdownSeries)
                .weeklyPnl(weekly)
                .rolling20(buildRolling(closedForMetrics, 20))
                .rolling50(buildRolling(closedForMetrics, 50))
                .breakdown(breakdown)
                .build();
    }

    public AnalyticsTimeseriesResponse timeseries(OffsetDateTime from,
                                                  OffsetDateTime to,
                                                  String symbol,
                                                  Direction direction,
                                                  TradeStatus status,
                                                  String strategy,
                                                  String setup,
                                                  String catalyst,
                                                  String market,
                                                  String dateMode,
                                                  String bucket,
                                                  Integer rollingWindow) {
        User user = currentUserService.getCurrentUser();
        List<Trade> trades = tradeRepository.findByUserId(user.getId());
        DateMode mode = DateMode.fromString(dateMode);
        List<Trade> filtered = filterTrades(trades, from, to, symbol, direction, status, strategy, setup, catalyst, market, mode, null);
        List<Trade> closedTrades = filtered.stream()
                .filter(t -> t.getStatus() == TradeStatus.CLOSED && t.getClosedAt() != null)
                .toList();
        DrawdownResult drawdown = buildDrawdown(closedTrades);
        List<TimeSeriesPoint> grouped = "week".equalsIgnoreCase(bucket) ? groupByWeek(closedTrades, mode) : groupByDate(closedTrades, mode);
        List<RollingMetricPoint> rolling = rollingWindow == null ? List.of() : buildRolling(closedTrades, rollingWindow);

        return AnalyticsTimeseriesResponse.builder()
                .equityCurve(drawdown.equityCurve)
                .groupedPnl(grouped)
                .drawdownSeries(drawdown.drawdownSeries)
                .weeklyPnl(groupByWeek(closedTrades, mode))
                .rolling(rolling)
                .build();
    }

    public AnalyticsBreakdownResponse breakdown(OffsetDateTime from,
                                                OffsetDateTime to,
                                                String symbol,
                                                Direction direction,
                                                TradeStatus status,
                                                String strategy,
                                                String setup,
                                                String catalyst,
                                                String market,
                                                String dateMode,
                                                String groupBy) {
        User user = currentUserService.getCurrentUser();
        List<Trade> trades = tradeRepository.findByUserId(user.getId());
        DateMode mode = DateMode.fromString(dateMode);
        List<Trade> filtered = filterTrades(trades, from, to, symbol, direction, status, strategy, setup, catalyst, market, mode, null);
        List<Trade> closedTrades = filtered.stream()
                .filter(t -> t.getStatus() == TradeStatus.CLOSED && t.getClosedAt() != null)
                .toList();

        List<BreakdownRow> rows = switch (String.valueOf(groupBy).toLowerCase(Locale.ROOT)) {
            case "symbol" -> buildBreakdown(closedTrades, Trade::getSymbol);
            case "strategy" -> buildBreakdown(closedTrades, Trade::getStrategyTag);
            case "setup" -> buildBreakdown(closedTrades, Trade::getSetup);
            case "catalyst" -> buildBreakdown(closedTrades, Trade::getCatalystTag);
            case "dow" -> buildBreakdownByDayOfWeek(closedTrades, mode);
            case "hour" -> buildBreakdownByHour(closedTrades, mode);
            case "holdingbucket" -> buildBreakdownByHoldingBucket(closedTrades);
            default -> List.of();
        };

        return AnalyticsBreakdownResponse.builder().rows(rows).build();
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
                                     DateMode mode,
                                     String holdingBucket) {
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
        if (holdingBucket != null && !holdingBucket.isBlank()) {
            filtered = filtered.stream()
                    .filter(t -> holdingBucket.equals(bucketHoldingTime(t)))
                    .toList();
        }
        return filtered;
    }

    private FilterOptions buildFilterOptions(List<Trade> trades) {
        List<String> symbols = trades.stream()
                .map(Trade::getSymbol)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .distinct()
                .sorted()
                .toList();
        List<String> markets = trades.stream()
                .map(Trade::getMarket)
                .filter(Objects::nonNull)
                .map(Enum::name)
                .distinct()
                .sorted()
                .toList();
        List<String> strategies = trades.stream()
                .map(Trade::getStrategyTag)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .distinct()
                .sorted()
                .toList();
        List<String> setups = trades.stream()
                .map(Trade::getSetup)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .distinct()
                .sorted()
                .toList();
        List<String> catalysts = trades.stream()
                .map(Trade::getCatalystTag)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .distinct()
                .sorted()
                .toList();
        return FilterOptions.builder()
                .symbols(symbols)
                .markets(markets)
                .strategies(strategies)
                .setups(setups)
                .catalysts(catalysts)
                .build();
    }

    private KpiSummary buildKpi(List<Trade> trades, int openTrades, int closedTrades) {
        BigDecimal totalNet = sum(trades, Trade::getPnlNet);
        BigDecimal totalGross = sum(trades, t -> t.getPnlGross() != null ? t.getPnlGross() : t.getPnlNet());
        List<BigDecimal> pnlValues = trades.stream()
                .map(t -> t.getPnlNet() == null ? BigDecimal.ZERO : t.getPnlNet())
                .toList();
        List<BigDecimal> wins = pnlValues.stream().filter(v -> v.compareTo(BigDecimal.ZERO) > 0).toList();
        List<BigDecimal> losses = pnlValues.stream().filter(v -> v.compareTo(BigDecimal.ZERO) < 0).toList();
        int flatTrades = (int) pnlValues.stream().filter(v -> v.compareTo(BigDecimal.ZERO) == 0).count();
        double winRate = trades.isEmpty() ? 0 : (double) wins.size() / trades.size() * 100;
        double lossRate = trades.isEmpty() ? 0 : (double) losses.size() / trades.size() * 100;
        BigDecimal avgWin = average(wins);
        BigDecimal avgLoss = average(losses);
        BigDecimal avgLossAbs = avgLoss.abs();
        BigDecimal expectancy = trades.isEmpty() ? BigDecimal.ZERO : totalNet.divide(BigDecimal.valueOf(trades.size()), 2, RoundingMode.HALF_UP);
        BigDecimal grossProfit = sumValues(wins);
        BigDecimal grossLoss = sumValues(losses).abs();
        BigDecimal profitFactor = grossLoss.compareTo(BigDecimal.ZERO) == 0 ? null : grossProfit.divide(grossLoss, 2, RoundingMode.HALF_UP);
        BigDecimal payoffRatio = avgLossAbs.compareTo(BigDecimal.ZERO) == 0 ? null : avgWin.divide(avgLossAbs, 2, RoundingMode.HALF_UP);

        return KpiSummary.builder()
                .totalPnlNet(totalNet)
                .totalPnlGross(totalGross)
                .grossProfit(grossProfit)
                .grossLoss(grossLoss)
                .winRate(winRate)
                .lossRate(lossRate)
                .averageWin(avgWin)
                .averageLoss(avgLossAbs)
                .medianPnl(median(pnlValues))
                .payoffRatio(payoffRatio)
                .expectancy(expectancy)
                .profitFactor(profitFactor)
                .totalTrades(trades.size())
                .winningTrades(wins.size())
                .losingTrades(losses.size())
                .flatTrades(flatTrades)
                .openTrades(openTrades)
                .closedTrades(closedTrades)
                .build();
    }

    private CostSummary buildCosts(List<Trade> trades) {
        BigDecimal totalFees = sum(trades, Trade::getFees);
        BigDecimal totalCommission = sum(trades, Trade::getCommission);
        BigDecimal totalSlippage = sum(trades, Trade::getSlippage);
        BigDecimal totalCosts = totalFees.add(totalCommission).add(totalSlippage);
        BigDecimal avgFees = averageValues(totalFees, trades.size());
        BigDecimal avgCommission = averageValues(totalCommission, trades.size());
        BigDecimal avgSlippage = averageValues(totalSlippage, trades.size());
        BigDecimal avgCosts = averageValues(totalCosts, trades.size());
        BigDecimal totalGross = sum(trades, t -> t.getPnlGross() != null ? t.getPnlGross() : t.getPnlNet());
        BigDecimal totalNet = sum(trades, Trade::getPnlNet);
        BigDecimal netVsGross = totalGross.subtract(totalNet);
        return CostSummary.builder()
                .totalFees(totalFees)
                .totalCommission(totalCommission)
                .totalSlippage(totalSlippage)
                .totalCosts(totalCosts)
                .avgFees(avgFees)
                .avgCommission(avgCommission)
                .avgSlippage(avgSlippage)
                .avgCosts(avgCosts)
                .netVsGrossDelta(netVsGross)
                .build();
    }

    private DrawdownResult buildDrawdown(List<Trade> trades) {
        List<Trade> ordered = trades.stream()
                .sorted(Comparator.comparing(Trade::getClosedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        BigDecimal equity = BigDecimal.ZERO;
        BigDecimal peak = BigDecimal.ZERO;
        BigDecimal maxDrawdown = BigDecimal.ZERO;
        BigDecimal maxDrawdownPercent = null;
        List<TimeSeriesPoint> equityCurve = new ArrayList<>();
        List<TimeSeriesPoint> drawdownSeries = new ArrayList<>();

        int currentDurationTrades = 0;
        int maxDurationTrades = 0;
        OffsetDateTime drawdownStart = null;
        long maxDurationDays = 0;

        List<Double> drawdownPercents = new ArrayList<>();

        for (Trade trade : ordered) {
            if (trade.getClosedAt() == null) continue;
            BigDecimal pnl = trade.getPnlNet() == null ? BigDecimal.ZERO : trade.getPnlNet();
            equity = equity.add(pnl);
            if (equity.compareTo(peak) >= 0) {
                peak = equity;
                currentDurationTrades = 0;
                drawdownStart = null;
            } else {
                currentDurationTrades++;
                if (drawdownStart == null) {
                    drawdownStart = trade.getClosedAt();
                }
                if (currentDurationTrades > maxDurationTrades) {
                    maxDurationTrades = currentDurationTrades;
                    if (drawdownStart != null) {
                        maxDurationDays = Duration.between(drawdownStart, trade.getClosedAt()).toDays();
                    }
                }
            }
            BigDecimal drawdown = equity.subtract(peak);
            if (drawdown.compareTo(maxDrawdown) < 0) {
                maxDrawdown = drawdown;
            }
            equityCurve.add(new TimeSeriesPoint(toLocalDate(trade.getClosedAt()), equity));
            drawdownSeries.add(new TimeSeriesPoint(toLocalDate(trade.getClosedAt()), drawdown));
            if (peak.compareTo(BigDecimal.ZERO) != 0) {
                double pct = drawdown.divide(peak, 6, RoundingMode.HALF_UP).doubleValue() * 100;
                drawdownPercents.add(pct);
            }
        }

        if (peak.compareTo(BigDecimal.ZERO) != 0 && maxDrawdown.compareTo(BigDecimal.ZERO) < 0) {
            maxDrawdownPercent = maxDrawdown.divide(peak, 6, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).abs();
        }
        BigDecimal recoveryFactor = maxDrawdown.compareTo(BigDecimal.ZERO) == 0 ? null : sum(trades, Trade::getPnlNet).divide(maxDrawdown.abs(), 4, RoundingMode.HALF_UP);
        Double ulcerIndex = drawdownPercents.isEmpty() ? null : Math.sqrt(drawdownPercents.stream().mapToDouble(p -> p * p).average().orElse(0));

        DrawdownSummary summary = DrawdownSummary.builder()
                .maxDrawdown(maxDrawdown.abs())
                .maxDrawdownPercent(maxDrawdownPercent)
                .maxDrawdownDurationTrades(maxDurationTrades)
                .maxDrawdownDurationDays(maxDurationDays)
                .recoveryFactor(recoveryFactor)
                .ulcerIndex(ulcerIndex)
                .build();

        return new DrawdownResult(summary, equityCurve, drawdownSeries);
    }

    private DistributionSummary buildDistribution(List<Trade> trades, OutlierResult outlierResult) {
        List<BigDecimal> pnlValues = trades.stream()
                .map(t -> t.getPnlNet() == null ? BigDecimal.ZERO : t.getPnlNet())
                .sorted()
                .toList();
        Double stdDev = pnlValues.isEmpty() ? null : standardDeviation(pnlValues);
        return DistributionSummary.builder()
                .standardDeviation(stdDev)
                .p10(percentile(pnlValues, 10))
                .p25(percentile(pnlValues, 25))
                .p50(percentile(pnlValues, 50))
                .p75(percentile(pnlValues, 75))
                .p90(percentile(pnlValues, 90))
                .pnlHistogram(buildHistogram(pnlValues, 8))
                .outlierLower(outlierResult.lowerThreshold)
                .outlierUpper(outlierResult.upperThreshold)
                .outlierCount(outlierResult.outlierCount)
                .build();
    }

    private ConsistencySummary buildConsistency(List<Trade> trades, List<TimeSeriesPoint> daily, List<TimeSeriesPoint> weekly) {
        int greenWeeks = (int) weekly.stream().filter(p -> p.getValue().compareTo(BigDecimal.ZERO) > 0).count();
        int redWeeks = (int) weekly.stream().filter(p -> p.getValue().compareTo(BigDecimal.ZERO) < 0).count();
        TimeSeriesPoint bestDay = daily.stream().max(Comparator.comparing(TimeSeriesPoint::getValue)).orElse(null);
        TimeSeriesPoint worstDay = daily.stream().min(Comparator.comparing(TimeSeriesPoint::getValue)).orElse(null);
        TimeSeriesPoint bestWeek = weekly.stream().max(Comparator.comparing(TimeSeriesPoint::getValue)).orElse(null);
        TimeSeriesPoint worstWeek = weekly.stream().min(Comparator.comparing(TimeSeriesPoint::getValue)).orElse(null);
        StreakSummary streaks = calculateStreaks(trades);
        return ConsistencySummary.builder()
                .greenWeeks(greenWeeks)
                .redWeeks(redWeeks)
                .bestDay(bestDay)
                .worstDay(worstDay)
                .bestWeek(bestWeek)
                .worstWeek(worstWeek)
                .streaks(streaks)
                .build();
    }

    private TimeEdgeSummary buildTimeEdge(List<Trade> trades, DateMode mode) {
        Map<String, List<Trade>> dayBuckets = new LinkedHashMap<>();
        Map<String, List<Trade>> hourBuckets = new LinkedHashMap<>();
        for (int day = 1; day <= 7; day++) {
            dayBuckets.put(String.valueOf(day), new ArrayList<>());
        }
        for (int hour = 0; hour < 24; hour++) {
            hourBuckets.put(String.format("%02d", hour), new ArrayList<>());
        }

        List<Long> holdingSeconds = new ArrayList<>();

        for (Trade trade : trades) {
            OffsetDateTime eventTime = getEventTime(trade, mode);
            if (eventTime != null) {
                ZonedDateTime zoned = eventTime.atZoneSameInstant(DISPLAY_ZONE);
                dayBuckets.get(String.valueOf(zoned.getDayOfWeek().getValue())).add(trade);
                hourBuckets.get(String.format("%02d", zoned.getHour())).add(trade);
            }
            if (trade.getOpenedAt() != null && trade.getClosedAt() != null) {
                long seconds = Duration.between(trade.getOpenedAt(), trade.getClosedAt()).getSeconds();
                if (seconds >= 0) {
                    holdingSeconds.add(seconds);
                }
            }
        }

        List<BucketStats> dayStats = dayBuckets.entrySet().stream()
                .map(entry -> buildBucketStats(dayLabel(entry.getKey()), entry.getValue()))
                .toList();
        List<BucketStats> hourStats = hourBuckets.entrySet().stream()
                .map(entry -> buildBucketStats(entry.getKey(), entry.getValue()))
                .toList();
        List<BucketStats> holdingBuckets = buildHoldingBuckets(trades);

        Long avgHolding = holdingSeconds.isEmpty() ? null : Math.round(holdingSeconds.stream().mapToLong(Long::longValue).average().orElse(0));
        Long medianHolding = holdingSeconds.isEmpty() ? null : holdingSeconds.stream().sorted().skip((holdingSeconds.size() - 1) / 2).findFirst().orElse(0L);

        return TimeEdgeSummary.builder()
                .averageHoldingSeconds(avgHolding)
                .medianHoldingSeconds(medianHolding)
                .holdingBuckets(holdingBuckets)
                .dayOfWeek(dayStats)
                .hourOfDay(hourStats)
                .build();
    }

    private AttributionSummary buildAttribution(List<Trade> trades) {
        List<BreakdownRow> symbols = buildBreakdown(trades, Trade::getSymbol);
        List<BreakdownRow> strategies = buildBreakdown(trades, Trade::getStrategyTag);
        List<BreakdownRow> setups = buildBreakdown(trades, Trade::getSetup);
        List<BreakdownRow> catalysts = buildBreakdown(trades, Trade::getCatalystTag);

        ConcentrationSummary concentration = buildConcentration(symbols, trades.size());
        List<BreakdownRow> bottomSymbols = symbols.stream()
                .sorted(Comparator.comparing(BreakdownRow::getNetPnl))
                .filter(row -> row.getTrades() >= 5)
                .limit(3)
                .toList();
        List<BreakdownRow> bottomTags = strategies.stream()
                .sorted(Comparator.comparing(BreakdownRow::getNetPnl))
                .filter(row -> row.getTrades() >= 5)
                .limit(3)
                .toList();

        return AttributionSummary.builder()
                .symbols(symbols)
                .strategies(strategies)
                .setups(setups)
                .catalysts(catalysts)
                .bottomSymbols(bottomSymbols)
                .bottomTags(bottomTags)
                .concentration(concentration)
                .build();
    }

    private RiskSummary buildRisk(List<Trade> trades) {
        List<BigDecimal> rMultiples = trades.stream()
                .map(Trade::getRMultiple)
                .filter(Objects::nonNull)
                .toList();
        List<BigDecimal> riskAmounts = trades.stream()
                .map(Trade::getRiskAmount)
                .filter(Objects::nonNull)
                .toList();
        List<BigDecimal> riskPercents = trades.stream()
                .map(Trade::getRiskPercent)
                .filter(Objects::nonNull)
                .toList();
        boolean available = !rMultiples.isEmpty() || !riskAmounts.isEmpty() || !riskPercents.isEmpty();
        if (!available) {
            return RiskSummary.builder().available(false).tradesWithRisk(0).build();
        }
        BigDecimal avgR = average(rMultiples);
        BigDecimal medR = median(rMultiples);
        double winRateR = rMultiples.isEmpty() ? 0 : (double) rMultiples.stream().filter(r -> r.compareTo(BigDecimal.ZERO) > 0).count() / rMultiples.size() * 100;
        BigDecimal expectancyR = rMultiples.isEmpty() ? BigDecimal.ZERO : sumValues(rMultiples).divide(BigDecimal.valueOf(rMultiples.size()), 2, RoundingMode.HALF_UP);
        return RiskSummary.builder()
                .available(available)
                .averageR(avgR)
                .medianR(medR)
                .expectancyR(expectancyR)
                .winRateR(winRateR)
                .averageRiskAmount(average(riskAmounts))
                .averageRiskPercent(average(riskPercents))
                .rDistribution(buildHistogram(rMultiples, 6))
                .tradesWithRisk(rMultiples.size())
                .build();
    }

    private DataQualitySummary buildDataQuality(List<Trade> trades) {
        int missingClosedAt = (int) trades.stream().filter(t -> t.getStatus() == TradeStatus.CLOSED && t.getClosedAt() == null).count();
        int inconsistentStatus = (int) trades.stream().filter(t -> t.getStatus() == TradeStatus.OPEN && t.getClosedAt() != null).count();
        int missingStrategy = (int) trades.stream().filter(t -> t.getStrategyTag() == null || t.getStrategyTag().isBlank()).count();
        int missingSetup = (int) trades.stream().filter(t -> t.getSetup() == null || t.getSetup().isBlank()).count();
        int missingCatalyst = (int) trades.stream().filter(t -> t.getCatalystTag() == null || t.getCatalystTag().isBlank()).count();
        int missingPnlPercent = (int) trades.stream().filter(t -> t.getPnlPercent() == null).count();
        int missingRisk = (int) trades.stream().filter(t -> t.getRiskAmount() == null && t.getRiskPercent() == null && t.getRMultiple() == null).count();
        return DataQualitySummary.builder()
                .missingClosedAtCount(missingClosedAt)
                .inconsistentStatusCount(inconsistentStatus)
                .missingStrategyCount(missingStrategy)
                .missingSetupCount(missingSetup)
                .missingCatalystCount(missingCatalyst)
                .missingPnlPercentCount(missingPnlPercent)
                .missingRiskCount(missingRisk)
                .timezoneNote("Stored in UTC, displayed in Europe/Bucharest")
                .build();
    }

    private TraderReadSummary buildTraderRead(AttributionSummary attribution,
                                              TimeEdgeSummary timeEdge,
                                              DrawdownResult drawdown,
                                              KpiSummary kpi,
                                              int tradeCount) {
        List<InsightItem> insights = new ArrayList<>();
        if (attribution != null && attribution.getSymbols() != null && !attribution.getSymbols().isEmpty()) {
            BreakdownRow top = attribution.getSymbols().get(0);
            if (top.getTrades() > 0 && kpi.getTotalPnlNet().compareTo(BigDecimal.ZERO) != 0) {
                BigDecimal total = kpi.getTotalPnlNet().abs();
                double share = total.compareTo(BigDecimal.ZERO) == 0 ? 0 : top.getNetPnl().abs().divide(total, 4, RoundingMode.HALF_UP).doubleValue() * 100;
                insights.add(InsightItem.builder()
                        .text(String.format("Most P&L comes from %s (%.1f%% of net P&L, N=%d).", top.getName(), share, top.getTrades()))
                        .build());
            }
        }
        if (timeEdge != null && timeEdge.getHourOfDay() != null) {
            timeEdge.getHourOfDay().stream()
                    .max(Comparator.comparing(BucketStats::getNetPnl))
                    .filter(bucket -> bucket.getTrades() > 0)
                    .ifPresent(bucket -> insights.add(InsightItem.builder()
                            .text(String.format("Best hour is %s:00–%s:59 (Net %s, Win rate %.1f%%, N=%d).",
                                    bucket.getBucket(),
                                    bucket.getBucket(),
                                    bucket.getNetPnl().setScale(2, RoundingMode.HALF_UP),
                                    bucket.getWinRate(),
                                    bucket.getTrades()))
                            .build()));
        }
        if (drawdown != null && drawdown.summary.getMaxDrawdown() != null) {
            insights.add(InsightItem.builder()
                    .text(String.format("Max drawdown is %s; recovery factor %s (N=%d).",
                            drawdown.summary.getMaxDrawdown().setScale(2, RoundingMode.HALF_UP),
                            drawdown.summary.getRecoveryFactor() == null ? "N/A" : drawdown.summary.getRecoveryFactor().setScale(2, RoundingMode.HALF_UP),
                            tradeCount))
                    .build());
        }
        return TraderReadSummary.builder().insights(insights).build();
    }

    private List<TimeSeriesPoint> groupByDate(List<Trade> trades, DateMode mode) {
        Map<LocalDate, BigDecimal> grouped = new TreeMap<>();
        for (Trade trade : trades) {
            OffsetDateTime time = getEventTime(trade, mode);
            if (time == null) continue;
            LocalDate date = toLocalDate(time);
            BigDecimal pnl = trade.getPnlNet() == null ? BigDecimal.ZERO : trade.getPnlNet();
            grouped.merge(date, pnl, BigDecimal::add);
        }
        return grouped.entrySet().stream().map(e -> new TimeSeriesPoint(e.getKey(), e.getValue())).toList();
    }

    private List<TimeSeriesPoint> groupByWeek(List<Trade> trades, DateMode mode) {
        Map<LocalDate, BigDecimal> grouped = new TreeMap<>();
        WeekFields weekFields = WeekFields.ISO;
        for (Trade trade : trades) {
            OffsetDateTime time = getEventTime(trade, mode);
            if (time == null) continue;
            LocalDate date = toLocalDate(time);
            LocalDate weekStart = date.with(weekFields.dayOfWeek(), 1);
            BigDecimal pnl = trade.getPnlNet() == null ? BigDecimal.ZERO : trade.getPnlNet();
            grouped.merge(weekStart, pnl, BigDecimal::add);
        }
        return grouped.entrySet().stream().map(e -> new TimeSeriesPoint(e.getKey(), e.getValue())).toList();
    }

    private List<RollingMetricPoint> buildRolling(List<Trade> trades, int window) {
        List<Trade> ordered = trades.stream()
                .sorted(Comparator.comparing(Trade::getClosedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        List<RollingMetricPoint> points = new ArrayList<>();
        for (int i = window - 1; i < ordered.size(); i++) {
            List<Trade> slice = ordered.subList(i - window + 1, i + 1);
            KpiSummary kpi = buildKpi(slice, 0, slice.size());
            OffsetDateTime date = ordered.get(i).getClosedAt();
            if (date == null) continue;
            points.add(RollingMetricPoint.builder()
                    .date(toLocalDate(date))
                    .winRate(kpi.getWinRate())
                    .profitFactor(kpi.getProfitFactor())
                    .expectancy(kpi.getExpectancy())
                    .averagePnl(kpi.getTotalPnlNet().divide(BigDecimal.valueOf(slice.size()), 2, RoundingMode.HALF_UP))
                    .build());
        }
        return points;
    }

    private List<BreakdownRow> buildBreakdown(List<Trade> trades, java.util.function.Function<Trade, String> keyExtractor) {
        Map<String, List<Trade>> grouped = trades.stream()
                .collect(Collectors.groupingBy(t -> Optional.ofNullable(keyExtractor.apply(t)).filter(s -> !s.isBlank()).orElse("Unspecified")));
        return grouped.entrySet().stream()
                .map(entry -> buildBreakdownRow(entry.getKey(), entry.getValue()))
                .sorted(Comparator.comparing(BreakdownRow::getNetPnl).reversed())
                .toList();
    }

    private BreakdownRow buildBreakdownRow(String name, List<Trade> trades) {
        List<BigDecimal> pnlValues = trades.stream().map(t -> t.getPnlNet() == null ? BigDecimal.ZERO : t.getPnlNet()).toList();
        int wins = (int) pnlValues.stream().filter(v -> v.compareTo(BigDecimal.ZERO) > 0).count();
        int losses = (int) pnlValues.stream().filter(v -> v.compareTo(BigDecimal.ZERO) < 0).count();
        BigDecimal grossProfit = sumValues(pnlValues.stream().filter(v -> v.compareTo(BigDecimal.ZERO) > 0).toList());
        BigDecimal grossLoss = sumValues(pnlValues.stream().filter(v -> v.compareTo(BigDecimal.ZERO) < 0).toList()).abs();
        BigDecimal pf = grossLoss.compareTo(BigDecimal.ZERO) == 0 ? null : grossProfit.divide(grossLoss, 2, RoundingMode.HALF_UP);
        return BreakdownRow.builder()
                .name(name)
                .trades(trades.size())
                .netPnl(sumValues(pnlValues))
                .winRate(trades.isEmpty() ? 0 : (double) wins / trades.size() * 100)
                .averagePnl(trades.isEmpty() ? BigDecimal.ZERO : sumValues(pnlValues).divide(BigDecimal.valueOf(trades.size()), 2, RoundingMode.HALF_UP))
                .profitFactor(pf)
                .lowSample(trades.size() < LOW_SAMPLE_THRESHOLD)
                .build();
    }

    private List<BreakdownRow> buildBreakdownByDayOfWeek(List<Trade> trades, DateMode mode) {
        Map<String, List<Trade>> grouped = new LinkedHashMap<>();
        for (int day = 1; day <= 7; day++) {
            grouped.put(dayLabel(String.valueOf(day)), new ArrayList<>());
        }
        for (Trade trade : trades) {
            OffsetDateTime time = getEventTime(trade, mode);
            if (time == null) continue;
            String label = dayLabel(String.valueOf(time.atZoneSameInstant(DISPLAY_ZONE).getDayOfWeek().getValue()));
            grouped.get(label).add(trade);
        }
        return grouped.entrySet().stream().map(entry -> buildBreakdownRow(entry.getKey(), entry.getValue())).toList();
    }

    private List<BreakdownRow> buildBreakdownByHour(List<Trade> trades, DateMode mode) {
        Map<String, List<Trade>> grouped = new LinkedHashMap<>();
        for (int hour = 0; hour < 24; hour++) {
            grouped.put(String.format("%02d", hour), new ArrayList<>());
        }
        for (Trade trade : trades) {
            OffsetDateTime time = getEventTime(trade, mode);
            if (time == null) continue;
            String label = String.format("%02d", time.atZoneSameInstant(DISPLAY_ZONE).getHour());
            grouped.get(label).add(trade);
        }
        return grouped.entrySet().stream().map(entry -> buildBreakdownRow(entry.getKey(), entry.getValue())).toList();
    }

    private List<BreakdownRow> buildBreakdownByHoldingBucket(List<Trade> trades) {
        Map<String, List<Trade>> grouped = new LinkedHashMap<>();
        List<String> buckets = List.of("<5m", "5-15m", "15-60m", "1-4h", ">4h");
        buckets.forEach(b -> grouped.put(b, new ArrayList<>()));
        for (Trade trade : trades) {
            String bucket = bucketHoldingTime(trade);
            if (bucket != null) {
                grouped.get(bucket).add(trade);
            }
        }
        return grouped.entrySet().stream().map(entry -> buildBreakdownRow(entry.getKey(), entry.getValue())).toList();
    }

    private ConcentrationSummary buildConcentration(List<BreakdownRow> symbols, int totalTrades) {
        if (symbols.isEmpty()) {
            return ConcentrationSummary.builder().build();
        }
        double totalPnl = symbols.stream().map(BreakdownRow::getNetPnl).mapToDouble(BigDecimal::doubleValue).sum();
        List<BreakdownRow> top3 = symbols.stream().limit(3).toList();
        double top1Pnl = symbols.get(0).getNetPnl().doubleValue();
        double top3Pnl = top3.stream().map(BreakdownRow::getNetPnl).mapToDouble(BigDecimal::doubleValue).sum();
        int top1Trades = symbols.get(0).getTrades();
        int top3Trades = top3.stream().mapToInt(BreakdownRow::getTrades).sum();
        return ConcentrationSummary.builder()
                .top1PnlShare(totalPnl == 0 ? null : top1Pnl / totalPnl * 100)
                .top3PnlShare(totalPnl == 0 ? null : top3Pnl / totalPnl * 100)
                .top1TradeShare(totalTrades == 0 ? null : (double) top1Trades / totalTrades * 100)
                .top3TradeShare(totalTrades == 0 ? null : (double) top3Trades / totalTrades * 100)
                .build();
    }

    private List<BucketStats> buildHoldingBuckets(List<Trade> trades) {
        Map<String, List<Trade>> grouped = new LinkedHashMap<>();
        grouped.put("<5m", new ArrayList<>());
        grouped.put("5-15m", new ArrayList<>());
        grouped.put("15-60m", new ArrayList<>());
        grouped.put("1-4h", new ArrayList<>());
        grouped.put(">4h", new ArrayList<>());

        for (Trade trade : trades) {
            String bucket = bucketHoldingTime(trade);
            if (bucket != null) {
                grouped.get(bucket).add(trade);
            }
        }
        return grouped.entrySet().stream()
                .map(entry -> buildBucketStats(entry.getKey(), entry.getValue()))
                .toList();
    }

    private BucketStats buildBucketStats(String label, List<Trade> trades) {
        int wins = (int) trades.stream().filter(t -> (t.getPnlNet() != null ? t.getPnlNet() : BigDecimal.ZERO).compareTo(BigDecimal.ZERO) > 0).count();
        BigDecimal net = sum(trades, Trade::getPnlNet);
        double winRate = trades.isEmpty() ? 0 : (double) wins / trades.size() * 100;
        return BucketStats.builder()
                .bucket(label)
                .trades(trades.size())
                .netPnl(net)
                .winRate(winRate)
                .build();
    }

    private String bucketHoldingTime(Trade trade) {
        if (trade.getOpenedAt() == null || trade.getClosedAt() == null) return null;
        long minutes = Duration.between(trade.getOpenedAt(), trade.getClosedAt()).toMinutes();
        if (minutes < 5) return "<5m";
        if (minutes < 15) return "5-15m";
        if (minutes < 60) return "15-60m";
        if (minutes < 240) return "1-4h";
        return ">4h";
    }

    private OffsetDateTime getEventTime(Trade trade, DateMode mode) {
        return mode == DateMode.OPEN ? trade.getOpenedAt() : trade.getClosedAt();
    }

    private LocalDate toLocalDate(OffsetDateTime time) {
        return time.atZoneSameInstant(DISPLAY_ZONE).toLocalDate();
    }

    private BigDecimal sum(List<Trade> trades, java.util.function.Function<Trade, BigDecimal> getter) {
        return trades.stream()
                .map(t -> {
                    BigDecimal value = getter.apply(t);
                    return value == null ? BigDecimal.ZERO : value;
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sumValues(List<BigDecimal> values) {
        return values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal average(List<BigDecimal> values) {
        if (values == null || values.isEmpty()) return BigDecimal.ZERO;
        return sumValues(values).divide(BigDecimal.valueOf(values.size()), 2, RoundingMode.HALF_UP);
    }

    private BigDecimal averageValues(BigDecimal total, int count) {
        if (count == 0) return BigDecimal.ZERO;
        return total.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
    }

    private BigDecimal median(List<BigDecimal> values) {
        if (values == null || values.isEmpty()) return BigDecimal.ZERO;
        List<BigDecimal> sorted = values.stream().sorted().toList();
        int mid = sorted.size() / 2;
        if (sorted.size() % 2 == 0) {
            return sorted.get(mid - 1).add(sorted.get(mid)).divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
        }
        return sorted.get(mid);
    }

    private BigDecimal percentile(List<BigDecimal> values, double percentile) {
        if (values == null || values.isEmpty()) return BigDecimal.ZERO;
        List<BigDecimal> sorted = values.stream().sorted().toList();
        int index = (int) Math.ceil(percentile / 100.0 * sorted.size()) - 1;
        index = Math.max(0, Math.min(index, sorted.size() - 1));
        return sorted.get(index);
    }

    private Double standardDeviation(List<BigDecimal> values) {
        if (values == null || values.isEmpty()) return null;
        double mean = values.stream().mapToDouble(BigDecimal::doubleValue).average().orElse(0);
        double variance = values.stream().mapToDouble(v -> Math.pow(v.doubleValue() - mean, 2)).average().orElse(0);
        return Math.sqrt(variance);
    }

    private List<HistogramBucket> buildHistogram(List<BigDecimal> values, int buckets) {
        if (values == null || values.isEmpty()) return List.of();
        BigDecimal min = values.stream().min(Comparator.naturalOrder()).orElse(BigDecimal.ZERO);
        BigDecimal max = values.stream().max(Comparator.naturalOrder()).orElse(BigDecimal.ZERO);
        if (min.compareTo(max) == 0) {
            return List.of(HistogramBucket.builder().label(min.toPlainString()).min(min).max(max).count(values.size()).build());
        }
        BigDecimal range = max.subtract(min);
        BigDecimal bucketSize = range.divide(BigDecimal.valueOf(buckets), 6, RoundingMode.HALF_UP);
        List<HistogramBucket> result = new ArrayList<>();
        for (int i = 0; i < buckets; i++) {
            BigDecimal start = min.add(bucketSize.multiply(BigDecimal.valueOf(i)));
            BigDecimal end = i == buckets - 1 ? max : start.add(bucketSize);
            int count = (int) values.stream()
                    .filter(v -> v.compareTo(start) >= 0 && (i == buckets - 1 ? v.compareTo(end) <= 0 : v.compareTo(end) < 0))
                    .count();
            result.add(HistogramBucket.builder()
                    .label(String.format("%s-%s", start.setScale(2, RoundingMode.HALF_UP), end.setScale(2, RoundingMode.HALF_UP)))
                    .min(start)
                    .max(end)
                    .count(count)
                    .build());
        }
        return result;
    }

    private OutlierResult calculateOutliers(List<Trade> trades) {
        List<BigDecimal> pnlValues = trades.stream()
                .map(t -> t.getPnlNet() == null ? BigDecimal.ZERO : t.getPnlNet())
                .toList();
        if (pnlValues.isEmpty()) {
            return new OutlierResult(null, null, 0);
        }
        double mean = pnlValues.stream().mapToDouble(BigDecimal::doubleValue).average().orElse(0);
        Double stdDevValue = standardDeviation(pnlValues);
        double stdDev = stdDevValue == null ? 0 : stdDevValue;
        BigDecimal lower = BigDecimal.valueOf(mean - 3 * stdDev);
        BigDecimal upper = BigDecimal.valueOf(mean + 3 * stdDev);
        int outliers = (int) pnlValues.stream().filter(v -> v.compareTo(lower) < 0 || v.compareTo(upper) > 0).count();
        return new OutlierResult(lower, upper, outliers);
    }

    private List<Trade> filterOutliers(List<Trade> trades, OutlierResult outlierResult) {
        if (outlierResult.lowerThreshold == null || outlierResult.upperThreshold == null) return trades;
        return trades.stream()
                .filter(t -> {
                    BigDecimal pnl = t.getPnlNet() == null ? BigDecimal.ZERO : t.getPnlNet();
                    return pnl.compareTo(outlierResult.lowerThreshold) >= 0 && pnl.compareTo(outlierResult.upperThreshold) <= 0;
                })
                .toList();
    }

    private StreakSummary calculateStreaks(List<Trade> trades) {
        int currentWin = 0;
        int currentLoss = 0;
        int maxWin = 0;
        int maxLoss = 0;
        String currentType = "NONE";
        for (Trade trade : trades.stream().sorted(Comparator.comparing(Trade::getClosedAt, Comparator.nullsLast(Comparator.naturalOrder()))).toList()) {
            BigDecimal pnl = trade.getPnlNet() == null ? BigDecimal.ZERO : trade.getPnlNet();
            if (pnl.compareTo(BigDecimal.ZERO) > 0) {
                currentWin++;
                currentLoss = 0;
                currentType = "WIN";
            } else if (pnl.compareTo(BigDecimal.ZERO) < 0) {
                currentLoss++;
                currentWin = 0;
                currentType = "LOSS";
            } else {
                currentLoss = 0;
                currentWin = 0;
                currentType = "FLAT";
            }
            maxWin = Math.max(maxWin, currentWin);
            maxLoss = Math.max(maxLoss, currentLoss);
        }
        int currentStreak = currentType.equals("WIN") ? currentWin : currentType.equals("LOSS") ? currentLoss : 0;
        return StreakSummary.builder()
                .maxWinStreak(maxWin)
                .maxLossStreak(maxLoss)
                .currentStreakType(currentType)
                .currentStreakCount(currentStreak)
                .build();
    }

    private String dayLabel(String day) {
        return switch (day) {
            case "1" -> "Mon";
            case "2" -> "Tue";
            case "3" -> "Wed";
            case "4" -> "Thu";
            case "5" -> "Fri";
            case "6" -> "Sat";
            default -> "Sun";
        };
    }

    private record DrawdownResult(DrawdownSummary summary, List<TimeSeriesPoint> equityCurve, List<TimeSeriesPoint> drawdownSeries) {}

    private record OutlierResult(BigDecimal lowerThreshold, BigDecimal upperThreshold, int outlierCount) {}

    private Set<String> parseFilterValues(String value) {
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .map(s -> s.toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
    }
}
