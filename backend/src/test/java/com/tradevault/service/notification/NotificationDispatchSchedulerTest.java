package com.tradevault.service.notification;

import com.tradevault.config.DatabaseConnectivityProbe;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationDispatchSchedulerTest {

    @Mock
    private NotificationDispatchService notificationDispatchService;

    @Mock
    private NotificationDispatchLockService notificationDispatchLockService;

    @Mock
    private DatabaseConnectivityProbe databaseConnectivityProbe;

    private NotificationDispatchScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new NotificationDispatchScheduler(
                notificationDispatchService,
                notificationDispatchLockService,
                databaseConnectivityProbe
        );
        ReflectionTestUtils.setField(scheduler, "batchSize", 50);
        ReflectionTestUtils.setField(scheduler, "dbUnavailableBackoffMillis", 60_000L);
        ReflectionTestUtils.setField(scheduler, "dbUnavailableLogWindowMillis", 120_000L);
    }

    @Test
    void dispatchDueEventsSkipsWhenAdvisoryLockNotAcquired() {
        when(databaseConnectivityProbe.probeNow(anyString()))
                .thenReturn(DatabaseConnectivityProbe.ProbeResult.up(Instant.now()));
        when(notificationDispatchLockService.tryAcquireDistributedLock()).thenReturn(false);

        scheduler.dispatchDueEvents();

        verify(notificationDispatchService, never()).dispatchPendingEvents(50);
        verify(notificationDispatchLockService, never()).releaseDistributedLock();
    }

    @Test
    void dispatchDueEventsDoesNotOverlapWithinSingleInstance() throws Exception {
        when(databaseConnectivityProbe.probeNow(anyString()))
                .thenReturn(DatabaseConnectivityProbe.ProbeResult.up(Instant.now()));
        when(notificationDispatchLockService.tryAcquireDistributedLock()).thenReturn(true);
        when(notificationDispatchLockService.releaseDistributedLock()).thenReturn(true);

        CountDownLatch serviceEntered = new CountDownLatch(1);
        CountDownLatch releaseService = new CountDownLatch(1);
        doAnswer(invocation -> {
            serviceEntered.countDown();
            releaseService.await(2, TimeUnit.SECONDS);
            return 10;
        }).when(notificationDispatchService).dispatchPendingEvents(50);

        Thread firstRun = new Thread(scheduler::dispatchDueEvents, "scheduler-run-1");
        firstRun.start();
        assertThat(serviceEntered.await(2, TimeUnit.SECONDS)).isTrue();

        scheduler.dispatchDueEvents();
        releaseService.countDown();
        firstRun.join(2_000);

        verify(notificationDispatchService, times(1)).dispatchPendingEvents(50);
    }

    @Test
    void dispatchDueEventsBacksOffWhenDbProbeFails() {
        when(databaseConnectivityProbe.probeNow(anyString()))
                .thenReturn(DatabaseConnectivityProbe.ProbeResult.down(
                        Instant.now(),
                        new DatabaseConnectivityProbe.FailureDetails(
                                "java.net.UnknownHostException",
                                "postgres",
                                "08001"
                        )
                ));

        scheduler.dispatchDueEvents();
        scheduler.dispatchDueEvents();

        verify(databaseConnectivityProbe, times(1)).probeNow(anyString());
        verify(notificationDispatchLockService, never()).tryAcquireDistributedLock();
        verify(notificationDispatchService, never()).dispatchPendingEvents(50);
    }
}
