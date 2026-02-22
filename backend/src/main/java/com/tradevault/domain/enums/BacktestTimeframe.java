package com.tradevault.domain.enums;

import java.time.Duration;
import java.util.Locale;

public enum BacktestTimeframe {
    M1(Duration.ofMinutes(1)),
    M5(Duration.ofMinutes(5)),
    M15(Duration.ofMinutes(15)),
    H1(Duration.ofHours(1)),
    D1(Duration.ofDays(1));

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
        return BacktestTimeframe.valueOf(value.trim().toUpperCase(Locale.ROOT));
    }

    public boolean isIntradayFineGrain() {
        return this == M1 || this == M5;
    }
}
