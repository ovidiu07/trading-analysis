package com.tradevault.service.marketdata;

import com.tradevault.service.backtest.BacktestCandle;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Comparator;
import java.util.List;

/** TradeJAudit analysis windows; these are not exchange opening hours. */
public final class AnalysisWindowCalculator {
    public static final Window ASIA = new Window("ASIA", ZoneId.of("Asia/Tokyo"), LocalTime.of(9, 0), LocalTime.of(15, 0));
    public static final Window LONDON = new Window("LONDON", ZoneId.of("Europe/London"), LocalTime.of(8, 0), LocalTime.of(16, 0));

    private AnalysisWindowCalculator() {}

    public static WindowRange calculate(Window window, LocalDate date, List<BacktestCandle> candles, Instant now) {
        Instant start = window.start(date).toInstant();
        Instant end = window.end(date).toInstant();
        String state = now.isBefore(start) ? "UPCOMING" : now.isBefore(end) ? "IN_PROGRESS" : "COMPLETE";
        if (!"COMPLETE".equals(state)) return new WindowRange(window.name(), date, start, end, null, null, state, 0);

        List<BacktestCandle> completedBars = candles == null ? List.of() : candles.stream()
                .filter(candle -> candle.timestamp() != null)
                .filter(candle -> !candle.timestamp().toInstant().isBefore(start) && candle.timestamp().toInstant().isBefore(end))
                .filter(candle -> candle.high() != null && candle.low() != null)
                .toList();
        if (completedBars.isEmpty()) return new WindowRange(window.name(), date, start, end, null, null, "UNAVAILABLE", 0);
        BigDecimal high = completedBars.stream().map(BacktestCandle::high).max(Comparator.naturalOrder()).orElseThrow();
        BigDecimal low = completedBars.stream().map(BacktestCandle::low).min(Comparator.naturalOrder()).orElseThrow();
        return new WindowRange(window.name(), date, start, end, high, low, "COMPLETE", completedBars.size());
    }

    public static String currentWindow(Instant now) {
        ZonedDateTime tokyo = now.atZone(ASIA.zone());
        ZonedDateTime london = now.atZone(LONDON.zone());
        boolean asia = !tokyo.toLocalTime().isBefore(ASIA.start()) && tokyo.toLocalTime().isBefore(ASIA.end());
        boolean londonActive = !london.toLocalTime().isBefore(LONDON.start()) && london.toLocalTime().isBefore(LONDON.end());
        if (asia && londonActive) return "ASIA_AND_LONDON";
        if (asia) return "ASIA";
        if (londonActive) return "LONDON";
        return "OUTSIDE_ANALYSIS_WINDOWS";
    }

    public record Window(String name, ZoneId zone, LocalTime start, LocalTime end) {
        ZonedDateTime start(LocalDate date) { return date.atTime(start).atZone(zone); }
        ZonedDateTime end(LocalDate date) { return date.atTime(end).atZone(zone); }
    }

    public record WindowRange(String name, LocalDate observationDate, Instant startsAt, Instant endsAt,
                              BigDecimal high, BigDecimal low, String completionState, int completedBarCount) {}
}
