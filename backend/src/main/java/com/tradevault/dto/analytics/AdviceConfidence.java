package com.tradevault.dto.analytics;

import com.fasterxml.jackson.annotation.JsonValue;

public enum AdviceConfidence {
    LOW("low"),
    MEDIUM("medium"),
    HIGH("high");

    private final String value;

    AdviceConfidence(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }
}
