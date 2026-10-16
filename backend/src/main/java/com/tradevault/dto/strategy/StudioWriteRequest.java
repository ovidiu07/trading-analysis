package com.tradevault.dto.strategy;

import com.fasterxml.jackson.databind.JsonNode;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record StudioWriteRequest(
        Long expectedRevision,
        @Valid @NotNull StrategyRequest strategy,
        @NotNull JsonNode definition) {}
