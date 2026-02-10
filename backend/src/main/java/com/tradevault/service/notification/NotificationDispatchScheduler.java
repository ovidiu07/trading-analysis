package com.tradevault.service.notification;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class NotificationDispatchScheduler {
    private final NotificationDispatchService notificationDispatchService;

    @Scheduled(fixedDelayString = "${notifications.dispatch.fixed-delay-ms:60000}")
    public void dispatchDueEvents() {
        notificationDispatchService.dispatchPendingEvents(100);
    }
}
