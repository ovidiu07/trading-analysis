package com.tradevault.dto.analytics;

import com.fasterxml.jackson.annotation.JsonValue;

public enum AdviceSeverity {
    INFO("info"),
    WARN("warn"),
    CRITICAL("critical");

    private final String value;

    AdviceSeverity(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }
}
