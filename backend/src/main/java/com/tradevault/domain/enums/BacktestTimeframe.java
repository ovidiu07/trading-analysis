package com.tradevault.domain.enums;

import java.time.Duration;
import java.util.Locale;

public enum BacktestTimeframe {
    M1(Duration.ofMinutes(1)),
    M5(Duration.ofMinutes(5)),
    M15(Duration.ofMinutes(15)),
    H1(Duration.ofHours(1)),
    H4(Duration.ofHours(4)),
    D1(Duration.ofDays(1)),
    W1(Duration.ofDays(7));

    private final Duration duration;

    BacktestTimeframe(Duration duration) {
        this.duration = duration;
    }

    public Duration duration() {
        return duration;
    }

    public static BacktestTimeframe from(String value) {
        if (value == null || value.isBlank()) {
            return M1;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "1", "M1", "1M", "MIN1", "MINUTE", "MIN" -> M1;
            case "5", "M5", "5M" -> M5;
            case "15", "M15", "15M" -> M15;
            case "60", "H1", "1H", "H60" -> H1;
            case "240", "H4", "4H", "H240" -> H4;
            case "D", "D1", "1D", "DAY", "DAILY", "24H", "1440" -> D1;
            case "W", "W1", "1W", "WEEK", "WEEKLY", "10080" -> W1;
            default -> BacktestTimeframe.valueOf(normalized);
        };
    }

    public boolean isIntradayFineGrain() {
        return this != D1 && this != W1;
    }
}
