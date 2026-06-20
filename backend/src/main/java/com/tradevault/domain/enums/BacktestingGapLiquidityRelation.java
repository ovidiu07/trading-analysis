package com.tradevault.domain.enums;

public enum BacktestingGapLiquidityRelation {
    AFTER_EXTERNAL_LIQUIDITY_SWEEP,
    AFTER_INTERNAL_LIQUIDITY_SWEEP,
    INTO_SESSION_POI,
    AFTER_MSS,
    CONTINUATION_DISPLACEMENT,
    UNKNOWN
}
