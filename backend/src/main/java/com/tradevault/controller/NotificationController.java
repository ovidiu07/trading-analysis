package com.tradevault.controller;

import com.tradevault.domain.entity.User;
import com.tradevault.dto.notification.NotificationFeedResponse;
import com.tradevault.dto.notification.NotificationUnreadCountResponse;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.notification.NotificationQueryService;
import com.tradevault.service.notification.NotificationStreamService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Locale;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationQueryService notificationQueryService;
    private final NotificationStreamService notificationStreamService;
    private final CurrentUserService currentUserService;

    @GetMapping
    public NotificationFeedResponse list(@RequestParam(defaultValue = "all") String filter,
                                         @RequestParam(defaultValue = "20") int limit,
                                         @RequestParam(required = false) String cursor) {
        String normalizedFilter = normalizeFilter(filter);
        return notificationQueryService.listCurrentUserNotifications(normalizedFilter, limit, cursor);
    }

    @GetMapping("/unread-count")
    public NotificationUnreadCountResponse unreadCount() {
        return new NotificationUnreadCountResponse(notificationQueryService.getCurrentUserUnreadCount());
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<NotificationUnreadCountResponse> markRead(@PathVariable UUID id) {
        notificationQueryService.markCurrentUserNotificationRead(id);
        return ResponseEntity.ok(new NotificationUnreadCountResponse(notificationQueryService.getCurrentUserUnreadCount()));
    }

    @PostMapping("/read-all")
    public ResponseEntity<NotificationUnreadCountResponse> markAllRead() {
        notificationQueryService.markAllCurrentUserNotificationsRead();
        return ResponseEntity.ok(new NotificationUnreadCountResponse(0));
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        User user = currentUserService.getCurrentUser();
        SseEmitter emitter = notificationStreamService.subscribe(user.getId());
        long unread = notificationQueryService.getUnreadCount(user.getId());
        notificationStreamService.sendUnreadCount(user.getId(), unread);
        return emitter;
    }

    private String normalizeFilter(String filter) {
        if (filter == null || filter.isBlank()) {
            return "all";
        }
        String normalized = filter.trim().toLowerCase(Locale.ROOT);
        if (!"all".equals(normalized) && !"unread".equals(normalized)) {
            throw new IllegalArgumentException("filter must be one of: all, unread");
        }
        return normalized;
    }
}
