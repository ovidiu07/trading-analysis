package com.tradevault.dto.notification;

import com.tradevault.domain.enums.NotificationEventType;
import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class NotificationCreatedStreamPayload {
    UUID notificationId;
    NotificationEventType eventType;
    String slug;
    String titleEn;
    String titleRo;
    Integer contentVersion;
    OffsetDateTime updatedAt;
    String revisionNotes;
    OffsetDateTime createdAt;
}
