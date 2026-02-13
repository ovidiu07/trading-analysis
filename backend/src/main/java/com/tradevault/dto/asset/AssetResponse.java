package com.tradevault.dto.asset;

import com.tradevault.domain.enums.AssetScope;
import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Value
@Builder
public class AssetResponse {
    UUID id;
    AssetScope scope;
    UUID contentId;
    UUID noteId;
    String originalFileName;
    String contentType;
    Long sizeBytes;
    String url;
    String downloadUrl;
    String viewUrl;
    String thumbnailUrl;
    boolean image;
    OffsetDateTime createdAt;
    Map<String, Object> metadata;
}
