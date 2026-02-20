package com.tradevault.dto.strategy;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class StrategyRequest {
    @NotBlank
    private String name;

    @NotBlank
    private String model;

    private String entryConditionsRich;

    private List<String> entryConditions;

    @NotBlank
    private String invalidationLogic;

    @NotBlank
    private String tpFramework;

    private String noTradeRules;

    private List<String> sessionSuitability;

    private List<String> tags;

    private UUID snapshotAssetId;

    private List<UUID> assetIds;

    private Boolean archived;
}
