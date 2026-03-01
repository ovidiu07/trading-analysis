package com.tradevault.domain.enums;

public enum BacktestCandidateState {
    DETECTED,
    QUALIFIED,
    REJECTED_BY_RULE,
    EXPIRED,
    ACCEPTED_BY_USER,
    REJECTED_BY_USER,
    CONVERTED_TO_TRADE
}
