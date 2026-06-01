package com.tradevault.dto.backtesting;

import com.tradevault.domain.enums.BacktestingScreenshotResult;
import com.tradevault.dto.asset.AssetResponse;
import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class BacktestingScreenshotResponse {
    UUID id;
    UUID workspaceId;
    UUID assetId;
    String originalFileName;
    String contentType;
    Long sizeBytes;
    String url;
    String viewUrl;
    String downloadUrl;
    String thumbnailUrl;
    UUID backtestingTradeId;
    String caption;
    BacktestingScreenshotResult tradeResult;
    String session;
    String timeframe;
    List<String> tags;
    Integer sortOrder;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
    AssetResponse asset;
}
