package com.tradevault.domain.enums;

public enum BacktestingGapFillStatus {
    UNFILLED,
    PARTIALLY_FILLED,
    FILLED,
    REJECTED_FROM_GAP,
    RELIQUIDATED_GAP,
    UNKNOWN
}
