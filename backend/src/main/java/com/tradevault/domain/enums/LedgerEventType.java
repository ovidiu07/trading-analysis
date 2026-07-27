package com.tradevault.domain.enums;

public enum LedgerEventType {
    INITIAL_CAPITAL,
    DEPOSIT,
    WITHDRAWAL,
    PAYOUT,
    PROP_FIRM_PAYOUT,
    PAYOUT_REQUEST,
    PAYOUT_RECEIVED,
    BROKER_FEE,
    COMMISSION,
    COMMISSION_ADJUSTMENT,
    FINANCING_ADJUSTMENT,
    PLATFORM_FEE,
    DATA_FEE,
    RESET_FEE,
    SWAP,
    SWAP_ADJUSTMENT,
    TAX,
    TAX_DEDUCTION,
    MANUAL_ADJUSTMENT,
    BALANCE_CORRECTION,
    PROFIT_SPLIT,
    ACCOUNT_RESET,
    REFUND,
    TRANSFER,
    OTHER;

    public boolean isDebit() {
        return switch (this) {
            case WITHDRAWAL, PAYOUT, PROP_FIRM_PAYOUT, BROKER_FEE, COMMISSION,
                    PLATFORM_FEE, DATA_FEE, RESET_FEE, SWAP, TAX, TAX_DEDUCTION,
                    PROFIT_SPLIT -> true;
            default -> false;
        };
    }

    public boolean permitsSignedAmount() {
        return this == MANUAL_ADJUSTMENT || this == BALANCE_CORRECTION
                || this == COMMISSION_ADJUSTMENT || this == FINANCING_ADJUSTMENT
                || this == SWAP_ADJUSTMENT || this == TRANSFER
                || this == OTHER || this == ACCOUNT_RESET;
    }
}
