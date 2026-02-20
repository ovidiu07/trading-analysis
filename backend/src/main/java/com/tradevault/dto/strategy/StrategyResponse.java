package com.tradevault.dto.strategy;

import com.tradevault.dto.asset.AssetResponse;
import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class StrategyResponse {
    UUID id;
    String source;
    String name;
    String model;
    String entryConditionsRich;
    List<String> entryConditions;
    String invalidationLogic;
    String tpFramework;
    String noTradeRules;
    List<String> sessionSuitability;
    List<String> tags;
    UUID snapshotAssetId;
    AssetResponse snapshotAsset;
    List<AssetResponse> assets;
    boolean archived;
    String slug;
    OffsetDateTime updatedAt;
}
