package com.tradevault.service.notification;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.concurrent.atomic.AtomicBoolean;

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationDispatchScheduler {
    private final NotificationDispatchService notificationDispatchService;
    private final JdbcTemplate jdbcTemplate;
    private final AtomicBoolean running = new AtomicBoolean(false);

    @Value("${notifications.dispatch.batch-size:50}")
    private int batchSize;

    @Value("${notifications.dispatch.pg-lock-key:92100420260213}")
    private long advisoryLockKey;

    @Scheduled(fixedDelayString = "${notifications.dispatch.fixed-delay-ms:60000}")
    public void dispatchDueEvents() {
        if (!running.compareAndSet(false, true)) {
            log.debug("Skipping notification dispatch scan: previous run is still active");
            return;
        }

        boolean lockAcquired = false;
        try {
            lockAcquired = tryAcquireDistributedLock();
            if (!lockAcquired) {
                log.debug("Skipping notification dispatch scan: advisory lock is held by another instance");
                return;
            }
            int submitted = notificationDispatchService.dispatchPendingEvents(batchSize);
            log.debug("Notification dispatch scan completed submitted={} batchSize={}", submitted, batchSize);
        } finally {
            if (lockAcquired) {
                releaseDistributedLock();
            }
            running.set(false);
        }
    }

    private boolean tryAcquireDistributedLock() {
        Boolean acquired = jdbcTemplate.queryForObject(
                "SELECT pg_try_advisory_lock(?)",
                Boolean.class,
                advisoryLockKey
        );
        return Boolean.TRUE.equals(acquired);
    }

    private void releaseDistributedLock() {
        Boolean released = jdbcTemplate.queryForObject(
                "SELECT pg_advisory_unlock(?)",
                Boolean.class,
                advisoryLockKey
        );
        if (!Boolean.TRUE.equals(released)) {
            log.warn("Failed to release notification advisory lock key={}", advisoryLockKey);
        }
    }
}
