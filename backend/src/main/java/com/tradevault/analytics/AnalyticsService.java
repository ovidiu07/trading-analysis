package com.tradevault.analytics;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.dto.analytics.AnalyticsResponse;
import com.tradevault.dto.analytics.KpiSummary;
import com.tradevault.dto.analytics.TimeSeriesPoint;
import com.tradevault.repository.TradeRepository;
import com.tradevault.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnalyticsService {
    private final TradeRepository tradeRepository;
    private final CurrentUserService currentUserService;

    public AnalyticsResponse summarize(OffsetDateTime from, OffsetDateTime to) {
        User user = currentUserService.getCurrentUser();
        List<Trade> trades = tradeRepository.findByUserId(user.getId());
        if (from != null) trades = trades.stream().filter(t -> t.getOpenedAt().isAfter(from) || t.getOpenedAt().isEqual(from)).collect(Collectors.toList());
        if (to != null) trades = trades.stream().filter(t -> t.getOpenedAt().isBefore(to) || t.getOpenedAt().isEqual(to)).collect(Collectors.toList());

        KpiSummary kpi = buildKpi(trades);
        List<TimeSeriesPoint> equity = buildEquity(trades);
        List<TimeSeriesPoint> grouped = groupByDate(trades);
        Map<String, Double> breakdown = trades.stream().collect(Collectors.groupingBy(Trade::getStrategyTag,
                Collectors.summingDouble(t -> t.getPnlNet() == null ? 0 : t.getPnlNet().doubleValue())));

        return AnalyticsResponse.builder()
                .kpi(kpi)
                .equityCurve(equity)
                .groupedPnl(grouped)
                .breakdown(breakdown)
                .build();
    }

    private KpiSummary buildKpi(List<Trade> trades) {
        BigDecimal totalNet = trades.stream().map(t -> t.getPnlNet() == null ? BigDecimal.ZERO : t.getPnlNet()).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalGross = trades.stream().map(t -> t.getPnlGross() == null ? BigDecimal.ZERO : t.getPnlGross()).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<BigDecimal> wins = trades.stream().map(t -> t.getPnlNet() == null ? BigDecimal.ZERO : t.getPnlNet()).filter(v -> v.compareTo(BigDecimal.ZERO) > 0).toList();
        List<BigDecimal> losses = trades.stream().map(t -> t.getPnlNet() == null ? BigDecimal.ZERO : t.getPnlNet()).filter(v -> v.compareTo(BigDecimal.ZERO) < 0).toList();
        double winRate = trades.isEmpty() ? 0 : (double) wins.size() / trades.size() * 100;
        double lossRate = trades.isEmpty() ? 0 : (double) losses.size() / trades.size() * 100;
        BigDecimal avgWin = wins.isEmpty() ? BigDecimal.ZERO : wins.stream().reduce(BigDecimal.ZERO, BigDecimal::add).divide(BigDecimal.valueOf(wins.size()), 2, RoundingMode.HALF_UP);
        BigDecimal avgLoss = losses.isEmpty() ? BigDecimal.ZERO : losses.stream().reduce(BigDecimal.ZERO, BigDecimal::add).divide(BigDecimal.valueOf(losses.size()), 2, RoundingMode.HALF_UP);
        BigDecimal expectancy = trades.isEmpty() ? BigDecimal.ZERO : totalNet.divide(BigDecimal.valueOf(trades.size()), 2, RoundingMode.HALF_UP);
        BigDecimal grossProfit = wins.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal grossLoss = losses.stream().map(BigDecimal::abs).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal profitFactor = grossLoss.compareTo(BigDecimal.ZERO) == 0 ? BigDecimal.ZERO : grossProfit.divide(grossLoss, 2, RoundingMode.HALF_UP);

        var streaks = calculateStreaks(trades);
        BigDecimal maxDrawdown = calculateDrawdown(trades);

        return KpiSummary.builder()
                .totalPnlNet(totalNet)
                .totalPnlGross(totalGross)
                .winRate(winRate)
                .lossRate(lossRate)
                .averageWin(avgWin)
                .averageLoss(avgLoss)
                .expectancy(expectancy)
                .profitFactor(profitFactor)
                .maxDrawdown(maxDrawdown)
                .maxWinStreak(streaks.maxWinStreak)
                .maxLossStreak(streaks.maxLossStreak)
                .build();
    }

    private List<TimeSeriesPoint> buildEquity(List<Trade> trades) {
        BigDecimal equity = BigDecimal.ZERO;
        List<TimeSeriesPoint> points = new ArrayList<>();
        trades.stream().sorted(Comparator.comparing(Trade::getClosedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .forEach(trade -> {
                    equity = equity.add(trade.getPnlNet() == null ? BigDecimal.ZERO : trade.getPnlNet());
                    LocalDate date = trade.getClosedAt() != null ? trade.getClosedAt().toLocalDate() : trade.getOpenedAt().toLocalDate();
                    points.add(new TimeSeriesPoint(date, equity));
                });
        return points;
    }

    private List<TimeSeriesPoint> groupByDate(List<Trade> trades) {
        Map<LocalDate, BigDecimal> grouped = new TreeMap<>();
        for (Trade trade : trades) {
            LocalDate date = trade.getOpenedAt().toLocalDate();
            BigDecimal pnl = trade.getPnlNet() == null ? BigDecimal.ZERO : trade.getPnlNet();
            grouped.merge(date, pnl, BigDecimal::add);
        }
        return grouped.entrySet().stream().map(e -> new TimeSeriesPoint(e.getKey(), e.getValue())).toList();
    }

    private BigDecimal calculateDrawdown(List<Trade> trades) {
        BigDecimal peak = BigDecimal.ZERO;
        BigDecimal equity = BigDecimal.ZERO;
        BigDecimal maxDrawdown = BigDecimal.ZERO;
        for (Trade trade : trades.stream().sorted(Comparator.comparing(Trade::getClosedAt, Comparator.nullsLast(Comparator.naturalOrder()))).toList()) {
            equity = equity.add(trade.getPnlNet() == null ? BigDecimal.ZERO : trade.getPnlNet());
            if (equity.compareTo(peak) > 0) {
                peak = equity;
            }
            BigDecimal drawdown = peak.subtract(equity);
            if (drawdown.compareTo(maxDrawdown) > 0) {
                maxDrawdown = drawdown;
            }
        }
        return maxDrawdown;
    }

    private StreakResult calculateStreaks(List<Trade> trades) {
        int currentWin = 0;
        int currentLoss = 0;
        int maxWin = 0;
        int maxLoss = 0;
        for (Trade trade : trades.stream().sorted(Comparator.comparing(Trade::getClosedAt, Comparator.nullsLast(Comparator.naturalOrder()))).toList()) {
            BigDecimal pnl = trade.getPnlNet() == null ? BigDecimal.ZERO : trade.getPnlNet();
            if (pnl.compareTo(BigDecimal.ZERO) > 0) {
                currentWin++;
                currentLoss = 0;
            } else if (pnl.compareTo(BigDecimal.ZERO) < 0) {
                currentLoss++;
                currentWin = 0;
            } else {
                currentLoss = 0;
                currentWin = 0;
            }
            maxWin = Math.max(maxWin, currentWin);
            maxLoss = Math.max(maxLoss, currentLoss);
        }
        return new StreakResult(maxWin, maxLoss);
    }

    private record StreakResult(int maxWinStreak, int maxLossStreak) {}
}
