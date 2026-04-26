package com.tradevault.dto.plan;

import com.tradevault.domain.enums.PlanScope;
import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Value
@Builder
public class PlanImageResponse {
    UUID id;
    UUID assetId;
    UUID planId;
    UUID todaySessionId;
    PlanScope planScope;
    String originalFileName;
    String contentType;
    Long sizeBytes;
    String url;
    String downloadUrl;
    String viewUrl;
    String thumbnailUrl;
    String caption;
    Integer sortOrder;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
    Map<String, Object> metadata;
}
