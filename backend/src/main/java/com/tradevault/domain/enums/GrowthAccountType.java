package com.tradevault.domain.enums;

public enum GrowthAccountType {
    PERSONAL,
    PROP_CHALLENGE,
    PROP_FUNDED,
    FUTURES_EVALUATION,
    FUTURES_FUNDED,
    DEMO,
    OTHER;

    public static GrowthAccountType from(String value) {
        if (value == null || value.isBlank()) {
            return OTHER;
        }
        try {
            return valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ignored) {
            return OTHER;
        }
    }
}
