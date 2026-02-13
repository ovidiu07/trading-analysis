package com.tradevault.dto.notification;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class UserNotificationResponse {
    UUID id;
    OffsetDateTime createdAt;
    OffsetDateTime readAt;
    OffsetDateTime clickedAt;
    OffsetDateTime dismissedAt;
    NotificationEventSummaryResponse event;
}
