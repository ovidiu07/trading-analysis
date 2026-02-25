package com.tradevault.domain;

import java.math.BigDecimal;

public final class TodaySessionDefaults {
    public static final BigDecimal AUTO_JOURNAL_TOLERANCE_PIPS = new BigDecimal("0.0000");
    public static final int AUTO_JOURNAL_TIMEOUT_MINUTES = 30;

    private TodaySessionDefaults() {
    }
}
