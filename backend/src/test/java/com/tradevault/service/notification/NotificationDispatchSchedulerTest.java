package com.tradevault.service.notification;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
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
    private JdbcTemplate jdbcTemplate;

    private NotificationDispatchScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new NotificationDispatchScheduler(notificationDispatchService, jdbcTemplate);
        ReflectionTestUtils.setField(scheduler, "batchSize", 50);
        ReflectionTestUtils.setField(scheduler, "advisoryLockKey", 42L);
    }

    @Test
    void dispatchDueEventsSkipsWhenAdvisoryLockNotAcquired() {
        when(jdbcTemplate.queryForObject(eq("SELECT pg_try_advisory_lock(?)"), eq(Boolean.class), anyLong()))
                .thenReturn(false);

        scheduler.dispatchDueEvents();

        verify(notificationDispatchService, never()).dispatchPendingEvents(50);
        verify(jdbcTemplate, never()).queryForObject(eq("SELECT pg_advisory_unlock(?)"), eq(Boolean.class), anyLong());
    }

    @Test
    void dispatchDueEventsDoesNotOverlapWithinSingleInstance() throws Exception {
        when(jdbcTemplate.queryForObject(eq("SELECT pg_try_advisory_lock(?)"), eq(Boolean.class), anyLong()))
                .thenReturn(true);
        when(jdbcTemplate.queryForObject(eq("SELECT pg_advisory_unlock(?)"), eq(Boolean.class), anyLong()))
                .thenReturn(true);

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
}
