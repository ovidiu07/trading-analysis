package com.tradevault.dto.session;

import lombok.Data;

import java.util.UUID;

@Data
public class StartSessionExecutionRequest {
    private String executionId;

    public UUID executionUuid() {
        if (executionId == null || executionId.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(executionId.trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
