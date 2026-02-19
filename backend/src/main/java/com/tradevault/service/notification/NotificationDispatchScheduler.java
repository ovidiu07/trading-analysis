package com.tradevault.service.notification;

import com.tradevault.config.DatabaseConnectivityProbe;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.dao.DataAccessException;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationDispatchScheduler {
    private final NotificationDispatchService notificationDispatchService;
    private final NotificationDispatchLockService notificationDispatchLockService;
    private final DatabaseConnectivityProbe databaseConnectivityProbe;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicBoolean databaseUnavailable = new AtomicBoolean(false);
    private final AtomicLong nextDatabaseProbeEpochMillis = new AtomicLong(0L);
    private final AtomicLong nextDatabaseWarningEpochMillis = new AtomicLong(0L);

    @Value("${notifications.dispatch.batch-size:50}")
    private int batchSize;

    @Value("${notifications.dispatch.db-unavailable-backoff-ms:60000}")
    private long dbUnavailableBackoffMillis;

    @Value("${notifications.dispatch.db-unavailable-log-window-ms:120000}")
    private long dbUnavailableLogWindowMillis;

    @Scheduled(fixedDelayString = "${notifications.dispatch.fixed-delay-ms:60000}")
    public void dispatchDueEvents() {
        if (!running.compareAndSet(false, true)) {
            log.debug("Skipping notification dispatch scan: previous run is still active");
            return;
        }

        boolean lockAcquired = false;
        try {
            long now = System.currentTimeMillis();
            if (isDatabaseBackoffActive(now)) {
                long remainingMillis = Math.max(0, nextDatabaseProbeEpochMillis.get() - now);
                log.debug("Skipping notification dispatch scan: DB backoff active remainingMs={}", remainingMillis);
                return;
            }

            DatabaseConnectivityProbe.ProbeResult probeResult = databaseConnectivityProbe.probeNow("notification-dispatch-scheduler");
            if (!probeResult.available()) {
                registerDatabaseUnavailable(
                        now,
                        probeResult.failureSummary(),
                        null
                );
                return;
            }
            markDatabaseRecoveredIfNeeded();

            lockAcquired = notificationDispatchLockService.tryAcquireDistributedLock();
            if (!lockAcquired) {
                log.debug("Skipping notification dispatch scan: advisory lock is held by another instance");
                return;
            }

            int submitted = notificationDispatchService.dispatchPendingEvents(batchSize);
            log.debug("Notification dispatch scan completed submitted={} batchSize={}", submitted, batchSize);
        } catch (DataAccessException ex) {
            registerDatabaseUnavailable(
                    System.currentTimeMillis(),
                    DatabaseConnectivityProbe.extractFailure(ex).summary(),
                    ex
            );
        } finally {
            if (lockAcquired) {
                try {
                    boolean released = notificationDispatchLockService.releaseDistributedLock();
                    if (!released) {
                        log.warn("Failed to release notification advisory lock");
                    }
                } catch (DataAccessException ex) {
                    registerDatabaseUnavailable(
                            System.currentTimeMillis(),
                            DatabaseConnectivityProbe.extractFailure(ex).summary(),
                            ex
                    );
                }
            }
            running.set(false);
        }
    }

    private boolean isDatabaseBackoffActive(long nowEpochMillis) {
        return nowEpochMillis < nextDatabaseProbeEpochMillis.get();
    }

    private void markDatabaseRecoveredIfNeeded() {
        nextDatabaseProbeEpochMillis.set(0L);
        if (databaseUnavailable.compareAndSet(true, false)) {
            log.info("Notification scheduler detected DB recovery and resumed dispatch polling");
        }
    }

    private void registerDatabaseUnavailable(long nowEpochMillis, String reason, Exception exception) {
        databaseUnavailable.set(true);
        long safeBackoffMillis = Math.max(1_000L, dbUnavailableBackoffMillis);
        nextDatabaseProbeEpochMillis.set(nowEpochMillis + safeBackoffMillis);

        long safeLogWindowMillis = Math.max(1_000L, dbUnavailableLogWindowMillis);
        boolean shouldWarn = nowEpochMillis >= nextDatabaseWarningEpochMillis.get();
        if (shouldWarn) {
            nextDatabaseWarningEpochMillis.set(nowEpochMillis + safeLogWindowMillis);
            if (exception != null) {
                log.warn(
                        "Skipping notification dispatch because DB is unavailable (reason={} nextAttemptInMs={})",
                        reason,
                        safeBackoffMillis,
                        exception
                );
            } else {
                log.warn(
                        "Skipping notification dispatch because DB is unavailable (reason={} nextAttemptInMs={})",
                        reason,
                        safeBackoffMillis
                );
            }
            return;
        }

        log.debug(
                "Skipping notification dispatch because DB is unavailable (reason={} nextAttemptInMs={})",
                reason,
                safeBackoffMillis
        );
    }
}
