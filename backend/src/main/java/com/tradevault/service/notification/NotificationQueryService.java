package com.tradevault.service.notification;

import com.tradevault.domain.entity.NotificationEvent;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.entity.UserNotification;
import com.tradevault.dto.notification.NotificationEventSummaryResponse;
import com.tradevault.dto.notification.NotificationFeedResponse;
import com.tradevault.dto.notification.UserNotificationResponse;
import com.tradevault.repository.UserNotificationRepository;
import com.tradevault.service.CurrentUserService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationQueryService {
    private static final int MIN_LIMIT = 1;
    private static final int MAX_LIMIT = 100;

    private final UserNotificationRepository userNotificationRepository;
    private final CurrentUserService currentUserService;
    private final NotificationJsonHelper notificationJsonHelper;
    private final NotificationStreamService notificationStreamService;

    @Transactional(readOnly = true)
    public NotificationFeedResponse listCurrentUserNotifications(String filter, int limit, String cursor) {
        User user = currentUserService.getCurrentUser();
        boolean unreadOnly = "unread".equalsIgnoreCase(filter);
        int normalizedLimit = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, limit));

        FeedCursor feedCursor = parseCursor(cursor);
        List<UserNotification> notifications = userNotificationRepository.findForFeed(
                user.getId(),
                unreadOnly,
                feedCursor == null ? null : feedCursor.createdAt(),
                feedCursor == null ? null : feedCursor.id(),
                PageRequest.of(0, normalizedLimit + 1)
        );

        boolean hasMore = notifications.size() > normalizedLimit;
        List<UserNotification> pageItems = hasMore
                ? notifications.subList(0, normalizedLimit)
                : notifications;
        String nextCursor = hasMore
                ? encodeCursor(pageItems.get(pageItems.size() - 1))
                : null;

        return NotificationFeedResponse.builder()
                .items(pageItems.stream().map(this::toResponse).toList())
                .nextCursor(nextCursor)
                .build();
    }

    @Transactional(readOnly = true)
    public long getCurrentUserUnreadCount() {
        User user = currentUserService.getCurrentUser();
        return userNotificationRepository.countUnreadByUserId(user.getId());
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(UUID userId) {
        return userNotificationRepository.countUnreadByUserId(userId);
    }

    @Transactional
    public void markCurrentUserNotificationRead(UUID notificationId) {
        User user = currentUserService.getCurrentUser();
        int updated = userNotificationRepository.markRead(notificationId, user.getId(), OffsetDateTime.now());
        if (updated == 0) {
            throw new EntityNotFoundException("Notification not found");
        }
        long unread = userNotificationRepository.countUnreadByUserId(user.getId());
        notificationStreamService.sendUnreadCount(user.getId(), unread);
    }

    @Transactional
    public void markAllCurrentUserNotificationsRead() {
        User user = currentUserService.getCurrentUser();
        userNotificationRepository.markAllRead(user.getId(), OffsetDateTime.now());
        notificationStreamService.sendUnreadCount(user.getId(), 0);
    }

    private UserNotificationResponse toResponse(UserNotification notification) {
        NotificationEvent event = notification.getEvent();
        NotificationEventPayload payload = notificationJsonHelper.readPayload(event.getPayloadJson());

        NotificationEventSummaryResponse eventResponse = NotificationEventSummaryResponse.builder()
                .type(event.getType())
                .effectiveAt(event.getEffectiveAt())
                .contentId(event.getContent().getId())
                .categoryId(event.getCategory().getId())
                .slug(payload.slug() != null ? payload.slug() : event.getContent().getSlug())
                .titleEn(payload.titleEn())
                .titleRo(payload.titleRo())
                .summaryEn(payload.summaryEn())
                .summaryRo(payload.summaryRo())
                .build();

        return UserNotificationResponse.builder()
                .id(notification.getId())
                .createdAt(notification.getCreatedAt())
                .readAt(notification.getReadAt())
                .clickedAt(notification.getClickedAt())
                .dismissedAt(notification.getDismissedAt())
                .event(eventResponse)
                .build();
    }

    private FeedCursor parseCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }
        String[] parts = cursor.split("\\|", 2);
        if (parts.length != 2) {
            throw new IllegalArgumentException("Invalid notification cursor");
        }
        try {
            OffsetDateTime createdAt = OffsetDateTime.parse(parts[0]);
            UUID id = UUID.fromString(parts[1]);
            return new FeedCursor(createdAt, id);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid notification cursor");
        }
    }

    private String encodeCursor(UserNotification notification) {
        return notification.getCreatedAt() + "|" + notification.getId();
    }

    private record FeedCursor(OffsetDateTime createdAt, UUID id) {}
}
