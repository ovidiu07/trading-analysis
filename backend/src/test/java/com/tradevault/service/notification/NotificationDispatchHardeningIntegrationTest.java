package com.tradevault.service.notification;

import com.tradevault.domain.entity.ContentPost;
import com.tradevault.domain.entity.ContentType;
import com.tradevault.domain.entity.NotificationEvent;
import com.tradevault.domain.entity.NotificationPreferences;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.ContentPostStatus;
import com.tradevault.domain.enums.NotificationDispatchStatus;
import com.tradevault.domain.enums.NotificationEventType;
import com.tradevault.domain.enums.NotificationMatchPolicy;
import com.tradevault.domain.enums.NotificationPreferenceMode;
import com.tradevault.domain.enums.Role;
import com.tradevault.repository.ContentPostRepository;
import com.tradevault.repository.ContentTypeRepository;
import com.tradevault.repository.NotificationEventRepository;
import com.tradevault.repository.NotificationPreferencesRepository;
import com.tradevault.repository.UserNotificationRepository;
import com.tradevault.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

@SpringBootTest
@Testcontainers
class NotificationDispatchHardeningIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("tradevault")
            .withUsername("tradevault")
            .withPassword("tradevault");

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("notifications.dispatch.fixed-delay-ms", () -> "3600000");
    }

    @Autowired
    private NotificationDispatchService notificationDispatchService;

    @Autowired
    private NotificationDispatchScheduler notificationDispatchScheduler;

    @Autowired
    private NotificationDispatchWorker notificationDispatchWorker;

    @Autowired
    private NotificationJsonHelper notificationJsonHelper;

    @Autowired
    private NotificationEventRepository notificationEventRepository;

    @Autowired
    private UserNotificationRepository userNotificationRepository;

    @Autowired
    private NotificationPreferencesRepository notificationPreferencesRepository;

    @Autowired
    private ContentPostRepository contentPostRepository;

    @Autowired
    private ContentTypeRepository contentTypeRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    @Qualifier("notificationExecutor")
    private ThreadPoolTaskExecutor notificationExecutor;

    @AfterEach
    void cleanUp() {
        userNotificationRepository.deleteAll();
        notificationEventRepository.deleteAll();
        contentPostRepository.deleteAll();
        notificationPreferencesRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void dispatchPendingEventsProcessesFixedBatchAndNextBatch() {
        User admin = createUser("admin-batch-" + UUID.randomUUID() + "@example.com", Role.ADMIN);
        ContentType category = resolveCategory();
        for (int i = 0; i < 200; i++) {
            createPendingEvent(admin, category, "batch-" + i);
        }

        int firstBatch = notificationDispatchService.dispatchPendingEvents(50);
        assertThat(firstBatch).isEqualTo(50);
        waitForStatusCount(NotificationDispatchStatus.SENT, 50, Duration.ofSeconds(10));

        int secondBatch = notificationDispatchService.dispatchPendingEvents(50);
        assertThat(secondBatch).isEqualTo(50);
        waitForStatusCount(NotificationDispatchStatus.SENT, 100, Duration.ofSeconds(10));
    }

    @Test
    void concurrentDispatchClaimsSingleOwnerAndDeliversOnce() throws Exception {
        User admin = createUser("admin-conc-" + UUID.randomUUID() + "@example.com", Role.ADMIN);
        User subscriber = createUser("subscriber-conc-" + UUID.randomUUID() + "@example.com", Role.USER);
        saveAllNotificationsPreference(subscriber);

        ContentType category = resolveCategory();
        NotificationEvent event = createPendingEvent(admin, category, "concurrency");

        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        List<Thread> callers = new ArrayList<>();
        Runnable caller = () -> {
            ready.countDown();
            try {
                if (!start.await(2, TimeUnit.SECONDS)) {
                    return;
                }
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                return;
            }
            notificationDispatchWorker.dispatchOne(event.getId());
        };
        callers.add(new Thread(caller, "claim-caller-1"));
        callers.add(new Thread(caller, "claim-caller-2"));
        callers.forEach(Thread::start);
        assertThat(ready.await(2, TimeUnit.SECONDS)).isTrue();
        start.countDown();
        for (Thread callerThread : callers) {
            callerThread.join(3_000);
        }

        NotificationEvent sent = waitForEventState(event.getId(), NotificationDispatchStatus.SENT, Duration.ofSeconds(10));
        assertThat(sent.getAttempts()).isEqualTo(1);
        assertThat(userNotificationRepository.countByEvent_Id(event.getId())).isEqualTo(1);
    }

    @Test
    void notificationExecutorIsBoundedAndAppliesBackpressure() throws Exception {
        assertThat(notificationExecutor.getCorePoolSize()).isEqualTo(4);
        assertThat(notificationExecutor.getMaxPoolSize()).isEqualTo(4);
        assertThat(notificationExecutor.getThreadPoolExecutor().getQueue().remainingCapacity()).isEqualTo(200);
        assertThat(notificationExecutor.getThreadPoolExecutor().getRejectedExecutionHandler())
                .isInstanceOf(ThreadPoolExecutor.CallerRunsPolicy.class);

        CountDownLatch activeWorkers = new CountDownLatch(4);
        CountDownLatch releaseWorkers = new CountDownLatch(1);
        for (int i = 0; i < 4; i++) {
            notificationExecutor.execute(() -> {
                activeWorkers.countDown();
                try {
                    releaseWorkers.await(2, TimeUnit.SECONDS);
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                }
            });
        }
        assertThat(activeWorkers.await(2, TimeUnit.SECONDS)).isTrue();

        for (int i = 0; i < 200; i++) {
            notificationExecutor.execute(() -> {
            });
        }

        String callerThread = Thread.currentThread().getName();
        final String[] executedThread = new String[1];
        notificationExecutor.execute(() -> executedThread[0] = Thread.currentThread().getName());
        assertThat(executedThread[0]).isEqualTo(callerThread);

        releaseWorkers.countDown();
    }

    @Test
    void schedulerTicksDoNotThrowDataAccessResourceFailureException() {
        User admin = createUser("admin-smoke-" + UUID.randomUUID() + "@example.com", Role.ADMIN);
        ContentType category = resolveCategory();
        for (int i = 0; i < 30; i++) {
            createPendingEvent(admin, category, "smoke-" + i);
        }

        assertThatCode(() -> {
            for (int i = 0; i < 3; i++) {
                notificationDispatchScheduler.dispatchDueEvents();
            }
        }).doesNotThrowAnyException();

        waitForStatusCount(NotificationDispatchStatus.SENT, 30, Duration.ofSeconds(10));
        assertThat(notificationEventRepository.countByStatus(NotificationDispatchStatus.FAILED)).isZero();
        assertThat(notificationEventRepository.countByStatus(NotificationDispatchStatus.PROCESSING)).isZero();
    }

    private User createUser(String email, Role role) {
        return userRepository.save(User.builder()
                .email(email)
                .passwordHash("hashed")
                .role(role)
                .build());
    }

    private void saveAllNotificationsPreference(User user) {
        notificationPreferencesRepository.save(NotificationPreferences.builder()
                .user(user)
                .enabled(true)
                .notifyOnNew(true)
                .notifyOnUpdates(true)
                .mode(NotificationPreferenceMode.ALL)
                .matchPolicy(NotificationMatchPolicy.CATEGORY_ONLY)
                .build());
    }

    private ContentType resolveCategory() {
        return contentTypeRepository.findByKey("STRATEGY")
                .orElseGet(() -> contentTypeRepository.save(ContentType.builder()
                        .key("STRATEGY-" + UUID.randomUUID())
                        .sortOrder(10)
                        .active(true)
                        .build()));
    }

    private NotificationEvent createPendingEvent(User admin, ContentType category, String slugPrefix) {
        ContentPost post = contentPostRepository.save(ContentPost.builder()
                .contentType(category)
                .slug(slugPrefix + "-" + UUID.randomUUID())
                .status(ContentPostStatus.PUBLISHED)
                .createdBy(admin)
                .contentVersion(1)
                .tags(notificationJsonHelper.writeStringList(List.of("momentum")))
                .symbols(notificationJsonHelper.writeStringList(List.of("BTCUSD")))
                .visibleFrom(OffsetDateTime.now().minusMinutes(2))
                .build());

        return notificationEventRepository.save(NotificationEvent.builder()
                .type(NotificationEventType.CONTENT_PUBLISHED)
                .content(post)
                .contentVersion(post.getContentVersion())
                .category(category)
                .tags(notificationJsonHelper.writeStringList(List.of("momentum")))
                .symbols(notificationJsonHelper.writeStringList(List.of("BTCUSD")))
                .effectiveAt(OffsetDateTime.now().minusMinutes(1))
                .status(NotificationDispatchStatus.PENDING)
                .payloadJson(notificationJsonHelper.writePayload(new NotificationEventPayload(
                        post.getSlug(),
                        "Title EN",
                        "Titlu RO",
                        "Summary EN",
                        "Rezumat RO"
                )))
                .build());
    }

    private void waitForStatusCount(NotificationDispatchStatus status, long expected, Duration timeout) {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            long count = notificationEventRepository.countByStatus(status);
            if (count >= expected) {
                return;
            }
            sleep(50);
        }
        throw new AssertionError("Timed out waiting for status=" + status + " expectedCount>=" + expected);
    }

    private NotificationEvent waitForEventState(UUID eventId, NotificationDispatchStatus status, Duration timeout) {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            NotificationEvent event = notificationEventRepository.findById(eventId).orElse(null);
            if (event != null && event.getStatus() == status) {
                return event;
            }
            sleep(50);
        }
        throw new AssertionError("Timed out waiting for eventId=" + eventId + " status=" + status);
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new AssertionError("Interrupted", ex);
        }
    }
}
