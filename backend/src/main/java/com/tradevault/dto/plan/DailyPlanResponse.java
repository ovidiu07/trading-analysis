package com.tradevault.dto.plan;

import com.tradevault.dto.asset.AssetResponse;
import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class DailyPlanResponse {
    UUID id;
    String slug;
    String title;
    String summary;
    String biasSummary;
    List<String> keyLevels;
    String primaryModel;
    String executionRules;
    String riskNote;
    String liquidityNarrative;
    String alternativeScenario;
    String context;
    String body;
    String tradingViewSymbol;
    String tradingViewInterval;
    String tradingViewTheme;
    Boolean tradingViewHideControls;
    Boolean tradingViewAllowSymbolChange;
    UUID snapshotAssetId;
    String snapshotCaption;
    AssetResponse snapshotAsset;
    OffsetDateTime visibleFrom;
    OffsetDateTime visibleUntil;
    OffsetDateTime updatedAt;
}
