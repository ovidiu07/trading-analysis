package com.tradevault.service.notification;

public record NotificationEventPayload(
        String slug,
        String titleEn,
        String titleRo,
        String summaryEn,
        String summaryRo
) {
}
