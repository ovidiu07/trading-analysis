package com.tradevault.service.notification;

import com.tradevault.domain.entity.ContentPost;
import com.tradevault.domain.entity.NotificationEvent;
import com.tradevault.domain.enums.NotificationDispatchStatus;
import com.tradevault.domain.enums.NotificationEventType;
import com.tradevault.dto.notification.NotificationCreatedStreamPayload;
import com.tradevault.repository.NotificationEventRepository;
import com.tradevault.repository.UserNotificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class NotificationDispatchWorkerTest {
    private NotificationEventRepository notificationEventRepository;
    private UserNotificationRepository userNotificationRepository;
    private NotificationJsonHelper notificationJsonHelper;
    private NotificationStreamService notificationStreamService;
    private NotificationDispatchWorker notificationDispatchWorker;

    @BeforeEach
    void setUp() {
        notificationEventRepository = mock(NotificationEventRepository.class);
        userNotificationRepository = mock(UserNotificationRepository.class);
        notificationJsonHelper = mock(NotificationJsonHelper.class);
        notificationStreamService = mock(NotificationStreamService.class);
        notificationDispatchWorker = new NotificationDispatchWorker(
                notificationEventRepository,
                userNotificationRepository,
                notificationJsonHelper,
                notificationStreamService
        );
    }

    @Test
    void dispatchOneNoOpsWhenClaimIsNotAcquired() {
        UUID eventId = UUID.randomUUID();
        when(notificationEventRepository.claimEvent(eq(eventId), any(OffsetDateTime.class))).thenReturn(0);

        notificationDispatchWorker.dispatchOne(eventId);

        verify(notificationEventRepository).claimEvent(eq(eventId), any(OffsetDateTime.class));
        verify(notificationEventRepository, never()).findByIdWithContentAndCategory(any(UUID.class));
        verifyNoInteractions(userNotificationRepository);
        verifyNoInteractions(notificationStreamService);
    }

    @Test
    void dispatchOneClaimsAndMarksSentAndStreamsOnce() {
        UUID eventId = UUID.randomUUID();
        UUID contentId = UUID.randomUUID();
        UUID notificationId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        OffsetDateTime notificationCreatedAt = OffsetDateTime.now();

        ContentPost content = ContentPost.builder()
                .id(contentId)
                .slug("btc-breakout")
                .build();
        NotificationEvent event = NotificationEvent.builder()
                .id(eventId)
                .type(NotificationEventType.CONTENT_PUBLISHED)
                .content(content)
                .effectiveAt(OffsetDateTime.now().minusMinutes(1))
                .attempts(1)
                .status(NotificationDispatchStatus.PROCESSING)
                .payloadJson("{\"slug\":\"btc-breakout\"}")
                .build();

        UserNotificationRepository.DispatchNotificationView dispatchView =
                mock(UserNotificationRepository.DispatchNotificationView.class);
        when(dispatchView.getNotificationId()).thenReturn(notificationId);
        when(dispatchView.getUserId()).thenReturn(userId);
        when(dispatchView.getCreatedAt()).thenReturn(notificationCreatedAt);

        UserNotificationRepository.UserUnreadCountView unreadCountView =
                mock(UserNotificationRepository.UserUnreadCountView.class);
        when(unreadCountView.getUserId()).thenReturn(userId);
        when(unreadCountView.getUnreadCount()).thenReturn(3L);

        when(notificationEventRepository.claimEvent(eq(eventId), any(OffsetDateTime.class))).thenReturn(1);
        when(notificationEventRepository.findByIdWithContentAndCategory(eventId)).thenReturn(Optional.of(event));
        when(userNotificationRepository.insertNotificationsForEvent(eq(eventId), any(OffsetDateTime.class))).thenReturn(1);
        when(notificationEventRepository.markSent(eq(eventId), any(OffsetDateTime.class)))
                .thenReturn(1);
        when(userNotificationRepository.findDispatchViewsByEventId(eventId)).thenReturn(List.of(dispatchView));
        when(userNotificationRepository.countUnreadByUserIds(anyCollection())).thenReturn(List.of(unreadCountView));
        when(notificationJsonHelper.readPayload(anyString()))
                .thenReturn(new NotificationEventPayload("btc-breakout", "EN Title", "RO Title", null, null));

        notificationDispatchWorker.dispatchOne(eventId);

        verify(notificationEventRepository).markSent(eq(eventId), any(OffsetDateTime.class));
        verify(notificationEventRepository, never())
                .markFailed(eq(eventId), anyString(), any(OffsetDateTime.class));
        verify(notificationStreamService).sendNotificationCreated(eq(userId), any(NotificationCreatedStreamPayload.class));
        verify(notificationStreamService).sendUnreadCount(userId, 3L);
    }
}
