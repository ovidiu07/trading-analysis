package com.tradevault.service;

import com.tradevault.domain.entity.ContentPost;
import com.tradevault.domain.entity.ContentType;
import com.tradevault.domain.entity.ContentTypeTranslation;
import com.tradevault.domain.entity.NotificationEvent;
import com.tradevault.domain.entity.NotificationPreferences;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.NotificationDispatchStatus;
import com.tradevault.domain.enums.NotificationEventType;
import com.tradevault.domain.enums.NotificationMatchPolicy;
import com.tradevault.domain.enums.NotificationPreferenceMode;
import com.tradevault.domain.enums.Role;
import com.tradevault.dto.content.ContentPostRequest;
import com.tradevault.dto.content.ContentPostResponse;
import com.tradevault.dto.content.LocalizedContentRequest;
import com.tradevault.dto.content.LocalizedContentResponse;
import com.tradevault.dto.notification.NotificationCreatedStreamPayload;
import com.tradevault.repository.ContentPostRepository;
import com.tradevault.repository.ContentTypeRepository;
import com.tradevault.repository.NotificationEventRepository;
import com.tradevault.repository.NotificationPreferencesRepository;
import com.tradevault.repository.UserNotificationRepository;
import com.tradevault.repository.UserRepository;
import com.tradevault.service.notification.NotificationDispatchService;
import com.tradevault.service.notification.NotificationDispatchWorker;
import com.tradevault.service.notification.NotificationEventService;
import com.tradevault.service.notification.NotificationEventPayload;
import com.tradevault.service.notification.NotificationJsonHelper;
import com.tradevault.service.notification.NotificationPreferencesService;
import com.tradevault.service.notification.NotificationStreamService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class NotificationWorkflowIntegrationTest {

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
    }

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ContentTypeRepository contentTypeRepository;

    @Autowired
    private ContentPostRepository contentPostRepository;

    @Autowired
    private NotificationEventRepository notificationEventRepository;

    @Autowired
    private UserNotificationRepository userNotificationRepository;

    @Autowired
    private NotificationPreferencesRepository notificationPreferencesRepository;

    @Autowired
    private ContentPostService contentPostService;

    @Autowired
    private NotificationDispatchService notificationDispatchService;

    @Autowired
    private NotificationEventService notificationEventService;

    @Autowired
    private NotificationPreferencesService notificationPreferencesService;

    @Autowired
    private NotificationJsonHelper notificationJsonHelper;

    @SpyBean
    private NotificationDispatchWorker notificationDispatchWorker;

    @SpyBean
    private NotificationStreamService notificationStreamService;

    @AfterEach
    void cleanUp() {
        userNotificationRepository.deleteAll();
        notificationEventRepository.deleteAll();
        contentPostRepository.deleteAll();
        notificationPreferencesRepository.deleteAll();
        contentTypeRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void publishVisibleNowDispatchesOnlyToMatchingSubscribers() {
        User admin = createUser("admin@example.com", Role.ADMIN);
        User allUser = createUser("all-user@example.com", Role.USER);
        User selectedUser = createUser("selected-user@example.com", Role.USER);

        ContentType strategy = createType("STRATEGY", "Strategy", "Strategie");
        ContentType playbook = createType("PLAYBOOK", "Playbook", "Playbook");

        savePreferences(allUser, NotificationPreferenceMode.ALL, List.of());
        savePreferences(selectedUser, NotificationPreferenceMode.SELECTED, List.of(playbook.getId()));

        UUID postId = createDraft(strategy, "Momentum setup", null);

        contentPostService.publish(postId, "en");
        notificationDispatchService.dispatchPendingEvents(100);

        NotificationEvent event = waitForSingleEvent(postId, NotificationEventType.CONTENT_PUBLISHED, Duration.ofSeconds(5));
        NotificationEvent dispatched = waitForEventState(event.getId(), NotificationDispatchStatus.SENT, Duration.ofSeconds(5));
        assertThat(event.getType()).isEqualTo(NotificationEventType.CONTENT_PUBLISHED);
        assertThat(dispatched.getDispatchedAt()).isNotNull();
        assertThat(event.getContentVersion()).isEqualTo(1);

        assertThat(waitForUserNotificationCount(allUser.getId(), 1, Duration.ofSeconds(5))).isEqualTo(1);
        assertThat(userNotificationRepository.countByUser_Id(selectedUser.getId())).isEqualTo(0);
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void futureVisiblePublishDispatchesAfterSchedulerWindow() {
        createUser("admin@example.com", Role.ADMIN);
        User subscriber = createUser("subscriber@example.com", Role.USER);
        ContentType strategy = createType("STRATEGY", "Strategy", "Strategie");
        savePreferences(subscriber, NotificationPreferenceMode.ALL, List.of());

        OffsetDateTime visibleFrom = OffsetDateTime.now().plusHours(3);
        UUID postId = createDraft(strategy, "Scheduled insight", visibleFrom);

        contentPostService.publish(postId, "en");
        notificationDispatchService.dispatchPendingEvents(100);

        NotificationEvent event = notificationEventRepository.findAll().get(0);
        assertThat(event.getDispatchedAt()).isNull();
        assertThat(userNotificationRepository.countByUser_Id(subscriber.getId())).isEqualTo(0);

        event.setEffectiveAt(OffsetDateTime.now().minusMinutes(1));
        notificationEventRepository.save(event);

        notificationDispatchService.dispatchPendingEvents(100);

        NotificationEvent dispatched = waitForEventState(event.getId(), NotificationDispatchStatus.SENT, Duration.ofSeconds(5));
        assertThat(dispatched.getDispatchedAt()).isNotNull();
        assertThat(waitForUserNotificationCount(subscriber.getId(), 1, Duration.ofSeconds(5))).isEqualTo(1);
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void meaningfulPublishedUpdateCreatesUpdateEventWhenToggleOn() {
        createUser("admin@example.com", Role.ADMIN);
        User subscriber = createUser("subscriber@example.com", Role.USER);
        ContentType strategy = createType("STRATEGY", "Strategy", "Strategie");
        savePreferences(subscriber, NotificationPreferenceMode.ALL, List.of());

        UUID postId = createDraft(strategy, "Initial insight", null);
        contentPostService.publish(postId, "en");
        notificationDispatchService.dispatchPendingEvents(100);

        ContentPostRequest updateRequest = buildUpdateRequest(postId, "Updated insight title", true);
        contentPostService.update(postId, updateRequest, "en");
        notificationDispatchService.dispatchPendingEvents(100);

        ContentPost updatedPost = contentPostRepository.findById(postId).orElseThrow();
        assertThat(updatedPost.getContentVersion()).isEqualTo(2);
        assertThat(notificationEventRepository.countByContent_IdAndTypeAndContentVersion(
                postId,
                NotificationEventType.CONTENT_UPDATED,
                2
        )).isEqualTo(1);
        assertThat(waitForUserNotificationCount(subscriber.getId(), 2, Duration.ofSeconds(5))).isEqualTo(2);
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void meaningfulPublishedUpdateSkipsEventWhenToggleOff() {
        createUser("admin@example.com", Role.ADMIN);
        User subscriber = createUser("subscriber@example.com", Role.USER);
        ContentType strategy = createType("STRATEGY", "Strategy", "Strategie");
        savePreferences(subscriber, NotificationPreferenceMode.ALL, List.of());

        UUID postId = createDraft(strategy, "Initial insight", null);
        contentPostService.publish(postId, "en");
        notificationDispatchService.dispatchPendingEvents(100);

        ContentPostRequest updateRequest = buildUpdateRequest(postId, "Silent insight update", false);
        contentPostService.update(postId, updateRequest, "en");
        notificationDispatchService.dispatchPendingEvents(100);

        ContentPost updatedPost = contentPostRepository.findById(postId).orElseThrow();
        assertThat(updatedPost.getContentVersion()).isEqualTo(2);
        assertThat(notificationEventRepository.countByContent_IdAndTypeAndContentVersion(
                postId,
                NotificationEventType.CONTENT_UPDATED,
                2
        )).isEqualTo(0);
        assertThat(waitForUserNotificationCount(subscriber.getId(), 1, Duration.ofSeconds(5))).isEqualTo(1);
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void updateEventCreationIsDedupedPerContentVersion() {
        User admin = createUser("admin@example.com", Role.ADMIN);
        createUser("subscriber@example.com", Role.USER);
        ContentType strategy = createType("STRATEGY", "Strategy", "Strategie");

        UUID postId = createDraft(strategy, "Initial insight", null);
        contentPostService.publish(postId, "en");

        ContentPost post = contentPostRepository.findById(postId).orElseThrow();
        post.setContentVersion(2);
        contentPostRepository.save(post);

        notificationEventService.createUpdatedEvent(post, admin);
        notificationEventService.createUpdatedEvent(post, admin);

        assertThat(notificationEventRepository.countByContent_IdAndTypeAndContentVersion(
                postId,
                NotificationEventType.CONTENT_UPDATED,
                2
        )).isEqualTo(1);
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void concurrentAsyncDispatchClaimsSingleOwnerAndDeliversOnce() throws Exception {
        createUser("admin@example.com", Role.ADMIN);
        User subscriber = createUser("subscriber@example.com", Role.USER);
        ContentType strategy = createType("STRATEGY", "Strategy", "Strategie");
        savePreferences(subscriber, NotificationPreferenceMode.ALL, List.of());

        UUID postId = createDraft(strategy, "Concurrency insight", null);
        ContentPost post = contentPostRepository.findById(postId).orElseThrow();
        NotificationEvent event = notificationEventRepository.save(NotificationEvent.builder()
                .type(NotificationEventType.CONTENT_PUBLISHED)
                .content(post)
                .contentVersion(1)
                .category(post.getContentType())
                .tags(notificationJsonHelper.writeStringList(List.of("momentum")))
                .symbols(notificationJsonHelper.writeStringList(List.of("BTCUSD")))
                .effectiveAt(OffsetDateTime.now().minusMinutes(1))
                .status(NotificationDispatchStatus.PENDING)
                .payloadJson(notificationJsonHelper.writePayload(new NotificationEventPayload(
                        post.getSlug(),
                        "Concurrency insight",
                        "Concurenta insight",
                        null,
                        null
                )))
                .build());

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

        callers.add(new Thread(caller, "dispatch-caller-1"));
        callers.add(new Thread(caller, "dispatch-caller-2"));
        callers.forEach(Thread::start);
        assertThat(ready.await(2, TimeUnit.SECONDS)).isTrue();
        start.countDown();
        for (Thread thread : callers) {
            thread.join(2000);
        }

        NotificationEvent dispatched = waitForEventState(event.getId(), NotificationDispatchStatus.SENT, Duration.ofSeconds(5));
        assertThat(dispatched.getAttempts()).isEqualTo(1);
        assertThat(userNotificationRepository.countByEvent_Id(event.getId())).isEqualTo(1);
        verify(notificationStreamService, timeout(5000).times(1))
                .sendNotificationCreated(eq(subscriber.getId()), any(NotificationCreatedStreamPayload.class));
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void publishTriggersAfterCommitAsyncDispatchWithEventId() {
        createUser("admin@example.com", Role.ADMIN);
        User subscriber = createUser("subscriber@example.com", Role.USER);
        ContentType strategy = createType("STRATEGY", "Strategy", "Strategie");
        savePreferences(subscriber, NotificationPreferenceMode.ALL, List.of());

        UUID postId = createDraft(strategy, "After commit insight", null);
        contentPostService.publish(postId, "en");

        NotificationEvent event = waitForSingleEvent(postId, NotificationEventType.CONTENT_PUBLISHED, Duration.ofSeconds(5));
        verify(notificationDispatchWorker, timeout(5000).atLeastOnce()).dispatchOne(eq(event.getId()));

        NotificationEvent dispatched = waitForEventState(event.getId(), NotificationDispatchStatus.SENT, Duration.ofSeconds(5));
        assertThat(dispatched.getDispatchedAt()).isNotNull();
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void publishedContentUpdatePersistsTemplateFieldsAndRevisionNotes() {
        createUser("admin@example.com", Role.ADMIN);
        ContentType strategy = createType("STRATEGY", "Strategy", "Strategie");

        UUID postId = createDraft(strategy, "Structured strategy", null);
        contentPostService.publish(postId, "en");

        ContentPostRequest request = buildUpdateRequest(postId, "Structured strategy v2", false);
        Map<String, Object> templateFields = new LinkedHashMap<>();
        templateFields.put("what", "Liquidity sweep setup");
        templateFields.put("when", "London open and NY overlap");
        templateFields.put("filters", "HTF confluence and MSS confirmation");
        templateFields.put("entryModel", "Sweep + MSS + FVG");
        templateFields.put("invalidation", "Break below protected low");
        templateFields.put("targets", "PDH then external range liquidity");
        templateFields.put("riskModel", "0.5R risk per attempt");
        templateFields.put("failureModes", "Late entries during low liquidity");
        request.setTemplateFields(templateFields);
        request.setRevisionNotes("Added structured playbook fields.");

        ContentPostResponse updated = contentPostService.update(postId, request, "en");

        assertThat(updated.getTemplateFields()).containsEntry("entryModel", "Sweep + MSS + FVG");
        assertThat(updated.getRevisionNotes()).isEqualTo("Added structured playbook fields.");
        assertThat(updated.getContentVersion()).isEqualTo(2);
    }

    private User createUser(String email, Role role) {
        return userRepository.save(User.builder()
                .email(email)
                .passwordHash("hashed")
                .role(role)
                .build());
    }

    private ContentType createType(String key, String enDisplayName, String roDisplayName) {
        ContentType contentType = ContentType.builder()
                .key(key)
                .active(true)
                .sortOrder(10)
                .build();

        ContentTypeTranslation en = ContentTypeTranslation.builder()
                .contentType(contentType)
                .locale("en")
                .displayName(enDisplayName)
                .build();
        ContentTypeTranslation ro = ContentTypeTranslation.builder()
                .contentType(contentType)
                .locale("ro")
                .displayName(roDisplayName)
                .build();

        contentType.getTranslations().add(en);
        contentType.getTranslations().add(ro);
        return contentTypeRepository.save(contentType);
    }

    private UUID createDraft(ContentType contentType, String englishTitle, OffsetDateTime visibleFrom) {
        ContentPostRequest request = new ContentPostRequest();
        request.setContentTypeId(contentType.getId());
        request.setSlug(null);
        request.setTags(List.of("Breakout", "Momentum"));
        request.setSymbols(List.of("BTCUSD", "ETHUSD"));
        request.setVisibleFrom(visibleFrom);
        request.setVisibleUntil(null);
        request.setTranslations(buildTranslations(englishTitle));

        ContentPostResponse response = contentPostService.createDraft(request, "en");
        return response.getId();
    }

    private ContentPostRequest buildUpdateRequest(UUID postId, String updatedEnglishTitle, boolean notifySubscribers) {
        ContentPostResponse existing = contentPostService.adminGet(postId, "en");
        ContentPostRequest request = new ContentPostRequest();
        request.setContentTypeId(existing.getContentTypeId());
        request.setSlug(existing.getSlug());
        request.setTags(existing.getTags());
        request.setSymbols(existing.getSymbols());
        request.setVisibleFrom(existing.getVisibleFrom());
        request.setVisibleUntil(existing.getVisibleUntil());
        request.setWeekStart(existing.getWeekStart());
        request.setWeekEnd(existing.getWeekEnd());
        request.setNotifySubscribersAboutUpdate(notifySubscribers);

        Map<String, LocalizedContentRequest> translations = new LinkedHashMap<>();
        for (Map.Entry<String, LocalizedContentResponse> entry : existing.getTranslations().entrySet()) {
            LocalizedContentResponse value = entry.getValue();
            LocalizedContentRequest localized = new LocalizedContentRequest();
            localized.setTitle(value.getTitle());
            localized.setSummary(value.getSummary());
            localized.setBody(value.getBody());
            translations.put(entry.getKey(), localized);
        }
        translations.get("en").setTitle(updatedEnglishTitle);
        request.setTranslations(translations);
        return request;
    }

    private Map<String, LocalizedContentRequest> buildTranslations(String englishTitle) {
        LocalizedContentRequest en = new LocalizedContentRequest();
        en.setTitle(englishTitle);
        en.setSummary("English summary");
        en.setBody("English body content");

        LocalizedContentRequest ro = new LocalizedContentRequest();
        ro.setTitle("RO " + englishTitle);
        ro.setSummary("Rezumat");
        ro.setBody("Continut RO");

        Map<String, LocalizedContentRequest> translations = new LinkedHashMap<>();
        translations.put("en", en);
        translations.put("ro", ro);
        return translations;
    }

    private void savePreferences(User user, NotificationPreferenceMode mode, List<UUID> categories) {
        NotificationPreferences preferences = notificationPreferencesService.ensureForUser(user);
        preferences.setEnabled(true);
        preferences.setNotifyOnNew(true);
        preferences.setNotifyOnUpdates(true);
        preferences.setMode(mode);
        preferences.setCategoriesJson(notificationJsonHelper.writeUuidList(categories));
        preferences.setTagsJson(null);
        preferences.setSymbolsJson(null);
        preferences.setMatchPolicy(NotificationMatchPolicy.CATEGORY_ONLY);
        notificationPreferencesRepository.save(preferences);
    }

    private NotificationEvent waitForSingleEvent(UUID contentId, NotificationEventType type, Duration timeout) {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            List<NotificationEvent> events = notificationEventRepository.findByContent_IdAndType(contentId, type);
            if (!events.isEmpty()) {
                return events.get(0);
            }
            sleep(75);
        }
        throw new AssertionError("Timed out waiting for notification event contentId=" + contentId + " type=" + type);
    }

    private NotificationEvent waitForEventState(UUID eventId, NotificationDispatchStatus status, Duration timeout) {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            NotificationEvent event = notificationEventRepository.findById(eventId).orElse(null);
            if (event != null && event.getStatus() == status) {
                return event;
            }
            sleep(75);
        }
        throw new AssertionError("Timed out waiting for event " + eventId + " status " + status);
    }

    private long waitForUserNotificationCount(UUID userId, long expected, Duration timeout) {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            long count = userNotificationRepository.countByUser_Id(userId);
            if (count == expected) {
                return count;
            }
            sleep(75);
        }
        throw new AssertionError("Timed out waiting for user " + userId + " notification count " + expected);
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new AssertionError("Interrupted while waiting", ex);
        }
    }
}
