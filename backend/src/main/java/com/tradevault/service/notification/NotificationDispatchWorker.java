package com.tradevault.service.notification;

import com.tradevault.domain.entity.NotificationEvent;
import com.tradevault.domain.enums.NotificationDispatchStatus;
import com.tradevault.dto.notification.NotificationCreatedStreamPayload;
import com.tradevault.repository.NotificationEventRepository;
import com.tradevault.repository.UserNotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationDispatchWorker {
    private static final int MAX_ERROR_LENGTH = 4_000;
    private static final int MAX_BACKOFF_MINUTES = 60;

    private final NotificationEventRepository notificationEventRepository;
    private final UserNotificationRepository userNotificationRepository;
    private final NotificationJsonHelper notificationJsonHelper;
    private final NotificationStreamService notificationStreamService;

    @Async("taskExecutor")
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void dispatchEventAsync(UUID eventId) {
        OffsetDateTime now = OffsetDateTime.now();
        int claimed = notificationEventRepository.claimEvent(eventId, now);
        if (claimed == 0) {
            log.debug("Skipped notification event claim eventId={} reason=not_due_or_already_claimed", eventId);
            return;
        }

        NotificationEvent event = notificationEventRepository.findByIdWithContentAndCategory(eventId).orElse(null);
        if (event == null) {
            OffsetDateTime retryAt = now.plusMinutes(1);
            int failedUpdated = notificationEventRepository.markFailed(
                    eventId,
                    NotificationDispatchStatus.FAILED,
                    "Notification event disappeared after claim",
                    retryAt
            );
            if (failedUpdated == 0) {
                log.warn("Failed to persist FAILED state for missing notification event eventId={}", eventId);
            }
            log.warn("Notification event missing after successful claim eventId={} nextRetryAt={}", eventId, retryAt);
            return;
        }

        try {
            dispatchClaimedEvent(event);
        } catch (Exception ex) {
            OffsetDateTime retryAt = OffsetDateTime.now().plusMinutes(calculateBackoffMinutes(event.getAttempts()));
            int failedUpdated = notificationEventRepository.markFailed(
                    eventId,
                    NotificationDispatchStatus.FAILED,
                    truncateError(ex),
                    retryAt
            );
            if (failedUpdated == 0) {
                log.warn("Failed to persist FAILED state for notification event eventId={}", eventId);
            }
            log.error(
                    "Notification event dispatch failed eventId={} articleId={} attempts={} nextRetryAt={}",
                    eventId,
                    event.getContent().getId(),
                    event.getAttempts(),
                    retryAt,
                    ex
            );
        }
    }

    private void dispatchClaimedEvent(NotificationEvent event) {
        UUID eventId = event.getId();
        OffsetDateTime notificationCreatedAt = OffsetDateTime.now();
        int inserted = userNotificationRepository.insertNotificationsForEvent(eventId, notificationCreatedAt);

        int sentUpdated = notificationEventRepository.markSent(
                eventId,
                NotificationDispatchStatus.SENT,
                OffsetDateTime.now()
        );
        if (sentUpdated == 0) {
            throw new IllegalStateException("Notification event was not in PROCESSING state when marking SENT");
        }

        log.info(
                "Notification event dispatched eventId={} articleId={} status={} attempts={} inserted={}",
                eventId,
                event.getContent().getId(),
                NotificationDispatchStatus.SENT,
                event.getAttempts(),
                inserted
        );

        if (inserted <= 0) {
            return;
        }

        List<UserNotificationRepository.DispatchNotificationView> dispatchedNotifications =
                userNotificationRepository.findDispatchViewsByEventId(eventId);
        if (dispatchedNotifications.isEmpty()) {
            return;
        }

        Set<UUID> userIds = new HashSet<>();
        for (UserNotificationRepository.DispatchNotificationView notification : dispatchedNotifications) {
            userIds.add(notification.getUserId());
        }

        Map<UUID, Long> unreadByUser = new HashMap<>();
        for (UserNotificationRepository.UserUnreadCountView unreadCount : userNotificationRepository.countUnreadByUserIds(userIds)) {
            unreadByUser.put(unreadCount.getUserId(), unreadCount.getUnreadCount());
        }

        NotificationEventPayload payload = notificationJsonHelper.readPayload(event.getPayloadJson());
        for (UserNotificationRepository.DispatchNotificationView notification : dispatchedNotifications) {
            NotificationCreatedStreamPayload streamPayload = NotificationCreatedStreamPayload.builder()
                    .notificationId(notification.getNotificationId())
                    .eventType(event.getType())
                    .slug(payload.slug() != null ? payload.slug() : event.getContent().getSlug())
                    .titleEn(payload.titleEn())
                    .titleRo(payload.titleRo())
                    .createdAt(notification.getCreatedAt())
                    .build();
            notificationStreamService.sendNotificationCreated(notification.getUserId(), streamPayload);
            notificationStreamService.sendUnreadCount(notification.getUserId(), unreadByUser.getOrDefault(notification.getUserId(), 0L));
        }
    }

    private int calculateBackoffMinutes(int attempts) {
        int safeAttempts = Math.max(1, attempts);
        int exponential = 1 << Math.min(safeAttempts - 1, 10);
        return Math.min(exponential, MAX_BACKOFF_MINUTES);
    }

    private String truncateError(Throwable throwable) {
        StringWriter stringWriter = new StringWriter();
        throwable.printStackTrace(new PrintWriter(stringWriter));
        String stackTrace = stringWriter.toString();
        if (stackTrace.length() <= MAX_ERROR_LENGTH) {
            return stackTrace;
        }
        return stackTrace.substring(0, MAX_ERROR_LENGTH);
    }
}
