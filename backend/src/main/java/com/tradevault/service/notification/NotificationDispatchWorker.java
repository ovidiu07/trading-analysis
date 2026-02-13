package com.tradevault.service.notification;

import com.tradevault.domain.entity.NotificationEvent;
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
    private static final int BASE_BACKOFF_SECONDS = 30;
    private static final int MAX_BACKOFF_SECONDS = 10 * 60;

    private final NotificationEventRepository notificationEventRepository;
    private final UserNotificationRepository userNotificationRepository;
    private final NotificationJsonHelper notificationJsonHelper;
    private final NotificationStreamService notificationStreamService;

    @Async("notificationExecutor")
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void dispatchOne(UUID eventId) {
        OffsetDateTime now = OffsetDateTime.now();
        int claimed = notificationEventRepository.claimEvent(eventId, now);
        if (claimed == 0) {
            log.debug("Skipped notification event claim eventId={} reason=not_due_or_already_claimed", eventId);
            return;
        }

        NotificationEvent event = notificationEventRepository.findByIdWithContentAndCategory(eventId).orElse(null);
        if (event == null) {
            OffsetDateTime retryAt = now.plusSeconds(BASE_BACKOFF_SECONDS);
            int failedUpdated = notificationEventRepository.markFailed(
                    eventId,
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
            int inserted = userNotificationRepository.insertNotificationsForEvent(eventId, now);
            int sentUpdated = notificationEventRepository.markSent(eventId, OffsetDateTime.now());
            if (sentUpdated == 0) {
                throw new IllegalStateException("Notification event was not in PROCESSING state when marking SENT");
            }
            streamDispatchResults(event, inserted);

            log.info(
                    "Notification event dispatched eventId={} articleId={} attempts={} inserted={}",
                    eventId,
                    event.getContent().getId(),
                    event.getAttempts(),
                    inserted
            );
        } catch (Exception ex) {
            OffsetDateTime retryAt = OffsetDateTime.now().plusSeconds(calculateBackoffSeconds(event.getAttempts()));
            int failedUpdated = notificationEventRepository.markFailed(
                    eventId,
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

    private void streamDispatchResults(NotificationEvent event, int inserted) {
        UUID eventId = event.getId();
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
            try {
                notificationStreamService.sendNotificationCreated(notification.getUserId(), streamPayload);
                notificationStreamService.sendUnreadCount(notification.getUserId(), unreadByUser.getOrDefault(notification.getUserId(), 0L));
            } catch (Exception streamEx) {
                log.warn(
                        "Notification stream push failed eventId={} userId={} reason={}",
                        eventId,
                        notification.getUserId(),
                        streamEx.getMessage()
                );
            }
        }
    }

    private long calculateBackoffSeconds(int attempts) {
        int safeAttempts = Math.max(1, attempts);
        long exponential = 1L << Math.min(safeAttempts - 1, 20);
        long delay = BASE_BACKOFF_SECONDS * exponential;
        return Math.min(delay, MAX_BACKOFF_SECONDS);
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
