package com.tradevault.dto.content;

import com.tradevault.domain.enums.ContentPostStatus;
import com.tradevault.domain.enums.ContentPostType;
import lombok.Builder;
import lombok.Value;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class ContentPostResponse {
    UUID id;
    ContentPostType type;
    String title;
    String slug;
    String summary;
    String body;
    ContentPostStatus status;
    List<String> tags;
    List<String> symbols;
    OffsetDateTime visibleFrom;
    OffsetDateTime visibleUntil;
    LocalDate weekStart;
    LocalDate weekEnd;
    UUID createdBy;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
    OffsetDateTime publishedAt;
}
