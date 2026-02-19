package com.tradevault.service.notification;

import java.time.OffsetDateTime;

public record NotificationEventPayload(
        String slug,
        String titleEn,
        String titleRo,
        String summaryEn,
        String summaryRo,
        Integer contentVersion,
        OffsetDateTime updatedAt,
        String revisionNotes
) {
}
