package com.tradevault.dto.analytics;

public enum DateMode {
    OPEN,
    CLOSE;

    public static DateMode fromString(String value) {
        if (value == null) return CLOSE;
        for (DateMode mode : values()) {
            if (mode.name().equalsIgnoreCase(value)) {
                return mode;
            }
        }
        return CLOSE;
    }
}
