package com.tradevault.service.notification;

import com.tradevault.domain.entity.NotificationEvent;
import com.tradevault.dto.notification.NotificationCreatedStreamPayload;
import com.tradevault.repository.NotificationEventRepository;
import com.tradevault.repository.UserNotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

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
public class NotificationDispatchService {
    private final NotificationEventRepository notificationEventRepository;
    private final UserNotificationRepository userNotificationRepository;
    private final NotificationJsonHelper notificationJsonHelper;
    private final NotificationStreamService notificationStreamService;

    public void dispatchAfterCommit(UUID eventId) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    dispatchEventAsync(eventId);
                }
            });
            return;
        }
        dispatchEventAsync(eventId);
    }

    @Async
    public void dispatchEventAsync(UUID eventId) {
        try {
            dispatchEvent(eventId);
        } catch (Exception ex) {
            log.error("Failed to dispatch notification event {}", eventId, ex);
        }
    }

    @Transactional
    public void dispatchPendingEvents(int batchSize) {
        int safeBatchSize = Math.max(1, batchSize);
        List<NotificationEvent> pending = notificationEventRepository
                .findTop200ByDispatchedAtIsNullAndEffectiveAtLessThanEqualOrderByEffectiveAtAsc(OffsetDateTime.now());
        if (pending.isEmpty()) {
            return;
        }
        pending.stream()
                .limit(safeBatchSize)
                .forEach(event -> dispatchEvent(event.getId()));
    }

    @Transactional
    public void dispatchEvent(UUID eventId) {
        NotificationEvent event = notificationEventRepository.findByIdForUpdate(eventId).orElse(null);
        if (event == null) {
            return;
        }
        if (event.getDispatchedAt() != null) {
            return;
        }

        OffsetDateTime now = OffsetDateTime.now();
        if (event.getEffectiveAt().isAfter(now)) {
            return;
        }

        OffsetDateTime notificationCreatedAt = OffsetDateTime.now();
        int inserted = userNotificationRepository.insertNotificationsForEvent(event.getId(), notificationCreatedAt);
        event.setDispatchedAt(now);
        notificationEventRepository.save(event);

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
}
