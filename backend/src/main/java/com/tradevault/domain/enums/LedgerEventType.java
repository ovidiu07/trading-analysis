package com.tradevault.domain.enums;

public enum LedgerEventType {
    INITIAL_CAPITAL,
    DEPOSIT,
    WITHDRAWAL,
    PAYOUT,
    COMMISSION,
    PLATFORM_FEE,
    DATA_FEE,
    RESET_FEE,
    SWAP,
    TAX,
    MANUAL_ADJUSTMENT,
    PROFIT_SPLIT,
    ACCOUNT_RESET,
    OTHER;

    public boolean isDebit() {
        return switch (this) {
            case WITHDRAWAL, PAYOUT, COMMISSION, PLATFORM_FEE, DATA_FEE,
                    RESET_FEE, SWAP, TAX, PROFIT_SPLIT -> true;
            default -> false;
        };
    }

    public boolean permitsSignedAmount() {
        return this == MANUAL_ADJUSTMENT || this == OTHER || this == ACCOUNT_RESET;
    }
}
