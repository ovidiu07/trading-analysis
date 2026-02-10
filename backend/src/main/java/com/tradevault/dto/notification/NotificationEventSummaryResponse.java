package com.tradevault.dto.notification;

import com.tradevault.domain.enums.NotificationEventType;
import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class NotificationEventSummaryResponse {
    NotificationEventType type;
    OffsetDateTime effectiveAt;
    UUID contentId;
    UUID categoryId;
    String slug;
    String titleEn;
    String titleRo;
    String summaryEn;
    String summaryRo;
}
