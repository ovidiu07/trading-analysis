package com.tradevault.service.notification;

import com.tradevault.domain.entity.ContentPost;
import com.tradevault.domain.entity.ContentPostTranslation;
import com.tradevault.domain.entity.NotificationEvent;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.NotificationEventType;
import com.tradevault.repository.NotificationEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationEventService {
    private final NotificationEventRepository notificationEventRepository;
    private final NotificationDispatchService notificationDispatchService;
    private final NotificationJsonHelper notificationJsonHelper;

    @Transactional
    public void createPublishedEvent(ContentPost post, User actingAdmin) {
        createEvent(NotificationEventType.CONTENT_PUBLISHED, post, actingAdmin);
    }

    @Transactional
    public void createUpdatedEvent(ContentPost post, User actingAdmin) {
        createEvent(NotificationEventType.CONTENT_UPDATED, post, actingAdmin);
    }

    private void createEvent(NotificationEventType eventType, ContentPost post, User actingAdmin) {
        if (notificationEventRepository.existsByContent_IdAndTypeAndContentVersion(post.getId(), eventType, post.getContentVersion())) {
            return;
        }

        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime effectiveAt = resolveEffectiveAt(post, now);
        NotificationEventPayload payload = buildPayload(post);
        List<String> normalizedTags = notificationJsonHelper.normalizeTags(notificationJsonHelper.readStringList(post.getTags()));
        List<String> normalizedSymbols = notificationJsonHelper.normalizeSymbols(notificationJsonHelper.readStringList(post.getSymbols()));

        NotificationEvent event = NotificationEvent.builder()
                .type(eventType)
                .content(post)
                .contentVersion(post.getContentVersion())
                .category(post.getContentType())
                .tags(notificationJsonHelper.writeStringList(normalizedTags))
                .symbols(notificationJsonHelper.writeStringList(normalizedSymbols))
                .effectiveAt(effectiveAt)
                .createdByAdmin(actingAdmin)
                .payloadJson(notificationJsonHelper.writePayload(payload))
                .build();

        try {
            NotificationEvent saved = notificationEventRepository.save(event);
            if (!saved.getEffectiveAt().isAfter(now)) {
                notificationDispatchService.dispatchAfterCommit(saved.getId());
            }
        } catch (DataIntegrityViolationException ex) {
            // Two concurrent updates can attempt the same versioned event; unique index is the source of truth.
            log.debug("Skipped duplicate notification event for content={} type={} version={}",
                    post.getId(),
                    eventType,
                    post.getContentVersion());
        }
    }

    private OffsetDateTime resolveEffectiveAt(ContentPost post, OffsetDateTime now) {
        if (post.getVisibleFrom() != null && post.getVisibleFrom().isAfter(now)) {
            return post.getVisibleFrom();
        }
        return now;
    }

    private NotificationEventPayload buildPayload(ContentPost post) {
        Map<String, ContentPostTranslation> translationsByLocale = post.getTranslations().stream()
                .collect(Collectors.toMap(ContentPostTranslation::getLocale, Function.identity(), (first, second) -> first));
        ContentPostTranslation en = translationsByLocale.get("en");
        ContentPostTranslation ro = translationsByLocale.get("ro");

        return new NotificationEventPayload(
                post.getSlug(),
                en != null ? en.getTitle() : null,
                ro != null ? ro.getTitle() : null,
                en != null ? en.getSummary() : null,
                ro != null ? ro.getSummary() : null
        );
    }
}
