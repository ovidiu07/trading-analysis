package com.tradevault.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.ContentPost;
import com.tradevault.domain.entity.ContentPostTranslation;
import com.tradevault.domain.entity.ContentType;
import com.tradevault.domain.entity.ContentTypeTranslation;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.ContentPostStatus;
import com.tradevault.domain.enums.Role;
import com.tradevault.dto.asset.AssetResponse;
import com.tradevault.dto.content.ContentPostRequest;
import com.tradevault.dto.content.ContentPostResponse;
import com.tradevault.dto.content.LocalizedContentRequest;
import com.tradevault.dto.content.LocalizedContentResponse;
import com.tradevault.repository.ContentPostRepository;
import com.tradevault.repository.ContentPostTranslationRepository;
import com.tradevault.repository.ContentTypeRepository;
import com.tradevault.repository.ContentTypeTranslationRepository;
import com.tradevault.service.notification.NotificationEventService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ContentPostService {
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};
    private static final Pattern LOCALE_PATTERN = Pattern.compile("^[a-z]{2}(-[a-z]{2})?$");

    private final ContentPostRepository repository;
    private final ContentPostTranslationRepository contentPostTranslationRepository;
    private final ContentTypeRepository contentTypeRepository;
    private final ContentTypeTranslationRepository contentTypeTranslationRepository;
    private final CurrentUserService currentUserService;
    private final ObjectMapper objectMapper;
    private final TranslationResolver translationResolver;
    private final LocaleResolverService localeResolverService;
    private final AssetService assetService;
    private final NotificationEventService notificationEventService;

    @Transactional(readOnly = true)
    public Page<ContentPostResponse> adminList(UUID contentTypeId,
                                               ContentPostStatus status,
                                               String query,
                                               String locale,
                                               Pageable pageable) {
        Page<ContentPost> page = repository.searchAdmin(contentTypeId, status, query, locale, LocaleResolverService.DEFAULT_LOCALE, pageable);
        List<ContentPost> posts = page.getContent();
        if (posts.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, page.getTotalElements());
        }

        Map<UUID, Map<String, ContentPostTranslation>> postTranslations = fetchPostTranslations(posts, localeResolverService.getSupportedLocales(), false);
        Map<UUID, Map<String, ContentTypeTranslation>> typeTranslations = fetchTypeTranslations(posts, localeResolverService.getSupportedLocales(), false);
        Map<UUID, List<AssetResponse>> assetsByContent = assetService.mapByContentPosts(posts);

        List<ContentPostResponse> responses = posts.stream()
                .map(post -> toResponse(post,
                        locale,
                        postTranslations.getOrDefault(post.getId(), Map.of()),
                        typeTranslations.getOrDefault(post.getContentType().getId(), Map.of()),
                        assetsByContent.getOrDefault(post.getId(), List.of()),
                        false,
                        true))
                .toList();

        return new PageImpl<>(responses, pageable, page.getTotalElements());
    }

    @Transactional(readOnly = true)
    public ContentPostResponse adminGet(UUID id, String locale) {
        ContentPost post = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Content not found"));

        Map<String, ContentPostTranslation> postTranslations = fetchPostTranslations(List.of(post), null, true)
                .getOrDefault(post.getId(), Map.of());
        Map<String, ContentTypeTranslation> typeTranslations = fetchTypeTranslations(List.of(post), null, true)
                .getOrDefault(post.getContentType().getId(), Map.of());
        List<AssetResponse> assets = assetService.mapByContentPosts(List.of(post)).getOrDefault(post.getId(), List.of());

        return toResponse(post, locale, postTranslations, typeTranslations, assets, true, true);
    }

    @Transactional
    public ContentPostResponse createDraft(ContentPostRequest request, String locale) {
        User user = currentUserService.getCurrentUser();
        ContentPost post = new ContentPost();
        applyRequest(post, request, true);
        post.setCreatedBy(user);
        post.setStatus(ContentPostStatus.DRAFT);
        post.setPublishedAt(null);
        ContentPost saved = repository.save(post);
        return adminGet(saved.getId(), locale);
    }

    @Transactional
    public ContentPostResponse update(UUID id, ContentPostRequest request, String locale) {
        ContentPost post = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Content not found"));
        boolean wasPublished = post.getStatus() == ContentPostStatus.PUBLISHED;
        MeaningfulContentSnapshot before = wasPublished ? MeaningfulContentSnapshot.from(post, this::readList) : null;

        applyRequest(post, request, false);

        boolean meaningfulUpdate = false;
        if (wasPublished) {
            MeaningfulContentSnapshot after = MeaningfulContentSnapshot.from(post, this::readList);
            meaningfulUpdate = !after.equals(before);
            if (meaningfulUpdate) {
                post.setContentVersion(Math.max(0, post.getContentVersion()) + 1);
            }
        }

        repository.save(post);

        if (wasPublished && meaningfulUpdate && shouldNotifySubscribersOnUpdate(request)) {
            User actingAdmin = currentUserService.getCurrentUser();
            notificationEventService.createUpdatedEvent(post, actingAdmin);
        }
        return adminGet(id, locale);
    }

    @Transactional
    public ContentPostResponse publish(UUID id, String locale) {
        ContentPost post = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Content not found"));
        boolean wasPublished = post.getStatus() == ContentPostStatus.PUBLISHED;

        post.setStatus(ContentPostStatus.PUBLISHED);
        if (!wasPublished) {
            post.setContentVersion(Math.max(0, post.getContentVersion()) + 1);
        }
        if (post.getPublishedAt() == null) {
            post.setPublishedAt(OffsetDateTime.now());
        }
        repository.save(post);

        if (!wasPublished) {
            User actingAdmin = currentUserService.getCurrentUser();
            notificationEventService.createPublishedEvent(post, actingAdmin);
        }
        return adminGet(id, locale);
    }

    @Transactional
    public ContentPostResponse archive(UUID id, String locale) {
        ContentPost post = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Content not found"));
        post.setStatus(ContentPostStatus.ARCHIVED);
        repository.save(post);
        return adminGet(id, locale);
    }

    @Transactional
    public void delete(UUID id) {
        ContentPost post = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Content not found"));
        assetService.deleteAssetsForContent(id);
        repository.delete(post);
    }

    @Transactional(readOnly = true)
    public List<ContentPostResponse> listPublished(String contentTypeKey,
                                                   String query,
                                                   boolean activeOnly,
                                                   String locale) {
        OffsetDateTime now = OffsetDateTime.now();
        List<ContentPost> posts = repository.searchPublished(ContentPostStatus.PUBLISHED,
                normalizeTypeKey(contentTypeKey),
                query,
                locale,
                LocaleResolverService.DEFAULT_LOCALE,
                activeOnly,
                now);

        if (posts.isEmpty()) {
            return List.of();
        }

        Map<UUID, Map<String, ContentPostTranslation>> postTranslations = fetchPostTranslations(posts, localeResolverService.getSupportedLocales(), false);
        Map<UUID, Map<String, ContentTypeTranslation>> typeTranslations = fetchTypeTranslations(posts, List.of(locale, LocaleResolverService.DEFAULT_LOCALE), false);
        Map<UUID, List<AssetResponse>> assetsByContent = assetService.mapByContentPosts(posts);

        return posts.stream()
                .map(post -> toResponse(post,
                        locale,
                        postTranslations.getOrDefault(post.getId(), Map.of()),
                        typeTranslations.getOrDefault(post.getContentType().getId(), Map.of()),
                        assetsByContent.getOrDefault(post.getId(), List.of()),
                        true,
                        false))
                .toList();
    }

    @Transactional(readOnly = true)
    public ContentPostResponse getByIdOrSlug(String idOrSlug, String locale) {
        User user = currentUserService.getCurrentUser();
        boolean isAdmin = user.getRole() == Role.ADMIN;
        ContentPost post = findByIdOrSlug(idOrSlug);
        if (!isAdmin && !isVisibleToUsers(post, OffsetDateTime.now())) {
            throw new EntityNotFoundException("Content not found");
        }

        Map<String, ContentPostTranslation> postTranslations = fetchPostTranslations(List.of(post), localeResolverService.getSupportedLocales(), false)
                .getOrDefault(post.getId(), Map.of());
        Map<String, ContentTypeTranslation> typeTranslations = fetchTypeTranslations(List.of(post), List.of(locale, LocaleResolverService.DEFAULT_LOCALE), false)
                .getOrDefault(post.getContentType().getId(), Map.of());
        List<AssetResponse> assets = assetService.mapByContentPosts(List.of(post)).getOrDefault(post.getId(), List.of());
        return toResponse(post, locale, postTranslations, typeTranslations, assets, true, false);
    }

    private ContentPost findByIdOrSlug(String idOrSlug) {
        if (idOrSlug == null || idOrSlug.isBlank()) {
            throw new EntityNotFoundException("Content not found");
        }
        try {
            UUID id = UUID.fromString(idOrSlug);
            return repository.findById(id)
                    .orElseThrow(() -> new EntityNotFoundException("Content not found"));
        } catch (IllegalArgumentException ex) {
            return repository.findBySlug(idOrSlug)
                    .orElseThrow(() -> new EntityNotFoundException("Content not found"));
        }
    }

    private boolean isVisibleToUsers(ContentPost post, OffsetDateTime now) {
        if (post.getStatus() != ContentPostStatus.PUBLISHED) {
            return false;
        }
        if (post.getVisibleFrom() != null && post.getVisibleFrom().isAfter(now)) {
            return false;
        }
        if (post.getVisibleUntil() != null && post.getVisibleUntil().isBefore(now)) {
            return false;
        }
        return true;
    }

    private void applyRequest(ContentPost post, ContentPostRequest request, boolean isCreate) {
        if (request.getVisibleFrom() != null && request.getVisibleUntil() != null
                && request.getVisibleFrom().isAfter(request.getVisibleUntil())) {
            throw new IllegalArgumentException("visibleFrom must be before visibleUntil");
        }

        ContentType contentType = contentTypeRepository.findById(request.getContentTypeId())
                .orElseThrow(() -> new IllegalArgumentException("Invalid contentTypeId"));

        post.setContentType(contentType);
        post.setVisibleFrom(request.getVisibleFrom());
        post.setVisibleUntil(request.getVisibleUntil());

        if (isWeeklyPlan(contentType)) {
            if (request.getWeekStart() == null || request.getWeekEnd() == null) {
                throw new IllegalArgumentException("Weekly plans require weekStart and weekEnd");
            }
            if (request.getWeekStart().isAfter(request.getWeekEnd())) {
                throw new IllegalArgumentException("weekStart must be on or before weekEnd");
            }
            post.setWeekStart(request.getWeekStart());
            post.setWeekEnd(request.getWeekEnd());
        } else {
            post.setWeekStart(null);
            post.setWeekEnd(null);
        }

        post.setTags(writeList(request.getTags()));
        post.setSymbols(writeList(request.getSymbols()));

        Map<String, DraftTranslation> translations = normalizeTranslations(request.getTranslations());
        upsertPostTranslations(post, translations);

        String requestedSlug = normalizeBlank(request.getSlug());
        String resolvedSlug;
        if (requestedSlug == null) {
            String sourceTitle = resolveSlugSourceTitle(translations);
            if (isCreate) {
                resolvedSlug = normalizeSlug(sourceTitle);
            } else {
                resolvedSlug = post.getSlug() != null ? post.getSlug() : normalizeSlug(sourceTitle);
            }
        } else {
            resolvedSlug = normalizeSlug(requestedSlug);
        }

        if (resolvedSlug != null) {
            resolvedSlug = ensureUniqueSlug(resolvedSlug, post.getId());
        }
        post.setSlug(resolvedSlug);
    }

    private boolean isWeeklyPlan(ContentType contentType) {
        return contentType != null && "WEEKLY_PLAN".equalsIgnoreCase(contentType.getKey());
    }

    private String resolveSlugSourceTitle(Map<String, DraftTranslation> translations) {
        DraftTranslation english = translations.get(LocaleResolverService.DEFAULT_LOCALE);
        if (english != null) {
            return english.title();
        }
        return translations.values().stream()
                .map(DraftTranslation::title)
                .findFirst()
                .orElse("content");
    }

    private Map<String, DraftTranslation> normalizeTranslations(Map<String, LocalizedContentRequest> translations) {
        if (translations == null || translations.isEmpty()) {
            throw new IllegalArgumentException("At least one translation is required");
        }

        Map<String, DraftTranslation> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, LocalizedContentRequest> entry : translations.entrySet()) {
            String locale = normalizeTranslationLocale(entry.getKey());
            LocalizedContentRequest payload = entry.getValue();
            if (payload == null) {
                throw new IllegalArgumentException("Invalid translation payload for locale: " + locale);
            }
            String title = requireText(payload.getTitle(), "title", locale);
            String body = requireText(payload.getBody(), "body", locale);
            normalized.put(locale, new DraftTranslation(title, normalizeBlank(payload.getSummary()), body));
        }

        if (!normalized.containsKey(LocaleResolverService.DEFAULT_LOCALE)) {
            throw new IllegalArgumentException("English translation is required");
        }

        return normalized;
    }

    private String normalizeTranslationLocale(String rawLocale) {
        String normalizedSupported = localeResolverService.normalizeLocale(rawLocale);
        if (normalizedSupported != null) {
            return normalizedSupported;
        }

        if (rawLocale == null || rawLocale.isBlank()) {
            throw new IllegalArgumentException("Translation locale is required");
        }

        String normalized = rawLocale.trim().toLowerCase(Locale.ROOT).replace('_', '-');
        if (!LOCALE_PATTERN.matcher(normalized).matches()) {
            throw new IllegalArgumentException("Invalid locale key: " + rawLocale);
        }
        return normalized;
    }

    private String requireText(String value, String field, String locale) {
        if (value == null || value.trim().isBlank()) {
            throw new IllegalArgumentException(field + " is required for locale " + locale);
        }
        return value.trim();
    }

    private void upsertPostTranslations(ContentPost post, Map<String, DraftTranslation> translations) {
        Map<String, ContentPostTranslation> existing = post.getTranslations().stream()
                .collect(Collectors.toMap(ContentPostTranslation::getLocale, item -> item, (a, b) -> a));

        for (Map.Entry<String, DraftTranslation> entry : translations.entrySet()) {
            String locale = entry.getKey();
            DraftTranslation payload = entry.getValue();

            ContentPostTranslation target = existing.get(locale);
            if (target == null) {
                target = new ContentPostTranslation();
                target.setContentPost(post);
                target.setLocale(locale);
                post.getTranslations().add(target);
            }

            target.setTitle(payload.title());
            target.setSummary(payload.summary());
            target.setBodyMarkdown(payload.body());
        }
    }

    private String ensureUniqueSlug(String baseSlug, UUID currentId) {
        String candidate = baseSlug;
        int counter = 2;
        while (true) {
            Optional<ContentPost> existing = repository.findBySlug(candidate);
            if (existing.isEmpty() || (currentId != null && existing.get().getId().equals(currentId))) {
                return candidate;
            }
            candidate = baseSlug + "-" + counter;
            counter++;
        }
    }

    private String normalizeSlug(String value) {
        if (value == null) return null;
        String normalized = value.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        return normalized.isBlank() ? null : normalized;
    }

    private String normalizeBlank(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private String normalizeTypeKey(String value) {
        String normalized = normalizeBlank(value);
        if (normalized == null) {
            return null;
        }
        return normalized.toUpperCase(Locale.ROOT);
    }

    private boolean shouldNotifySubscribersOnUpdate(ContentPostRequest request) {
        return request.getNotifySubscribersAboutUpdate() == null || request.getNotifySubscribersAboutUpdate();
    }

    private String writeList(List<String> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(values);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid list payload");
        }
    }

    private List<String> readList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, STRING_LIST);
        } catch (Exception ex) {
            return List.of();
        }
    }

    private Map<UUID, Map<String, ContentPostTranslation>> fetchPostTranslations(Collection<ContentPost> posts,
                                                                                  Collection<String> locales,
                                                                                  boolean includeAllLocales) {
        List<UUID> postIds = posts.stream().map(ContentPost::getId).toList();
        if (postIds.isEmpty()) {
            return Map.of();
        }

        List<ContentPostTranslation> translations = includeAllLocales
                ? contentPostTranslationRepository.findByContentPostIdIn(postIds)
                : contentPostTranslationRepository.findByContentPostIdInAndLocaleIn(postIds, locales);

        return translations.stream().collect(Collectors.groupingBy(
                translation -> translation.getContentPost().getId(),
                Collectors.toMap(ContentPostTranslation::getLocale, item -> item, (a, b) -> a)
        ));
    }

    private Map<UUID, Map<String, ContentTypeTranslation>> fetchTypeTranslations(Collection<ContentPost> posts,
                                                                                  Collection<String> locales,
                                                                                  boolean includeAllLocales) {
        List<UUID> typeIds = posts.stream()
                .map(ContentPost::getContentType)
                .map(ContentType::getId)
                .distinct()
                .toList();

        if (typeIds.isEmpty()) {
            return Map.of();
        }

        List<ContentTypeTranslation> translations = includeAllLocales
                ? contentTypeTranslationRepository.findByContentTypeIdIn(typeIds)
                : contentTypeTranslationRepository.findByContentTypeIdInAndLocaleIn(typeIds, locales);

        return translations.stream().collect(Collectors.groupingBy(
                translation -> translation.getContentType().getId(),
                Collectors.toMap(ContentTypeTranslation::getLocale, item -> item, (a, b) -> a)
        ));
    }

    private ContentPostResponse toResponse(ContentPost post,
                                           String requestedLocale,
                                           Map<String, ContentPostTranslation> translations,
                                           Map<String, ContentTypeTranslation> typeTranslations,
                                           List<AssetResponse> assets,
                                           boolean includeAllTranslations,
                                           boolean includeMissingLocales) {
        TranslationResolver.ResolvedTranslation<ContentPostTranslation> resolvedContent = translationResolver.resolve(translations, requestedLocale);
        TranslationResolver.ResolvedTranslation<ContentTypeTranslation> resolvedType = translationResolver.resolve(typeTranslations, requestedLocale);

        ContentPostTranslation content = resolvedContent.value();
        ContentTypeTranslation type = resolvedType.value();

        return ContentPostResponse.builder()
                .id(post.getId())
                .contentTypeId(post.getContentType().getId())
                .contentTypeKey(post.getContentType().getKey())
                .contentTypeDisplayName(type != null && type.getDisplayName() != null ? type.getDisplayName() : post.getContentType().getKey())
                .title(content != null ? content.getTitle() : null)
                .slug(post.getSlug())
                .summary(content != null ? content.getSummary() : null)
                .body(content != null ? content.getBodyMarkdown() : null)
                .locale(requestedLocale)
                .resolvedLocale(resolvedContent.locale())
                .status(post.getStatus())
                .tags(readList(post.getTags()))
                .symbols(readList(post.getSymbols()))
                .visibleFrom(post.getVisibleFrom())
                .visibleUntil(post.getVisibleUntil())
                .weekStart(post.getWeekStart())
                .weekEnd(post.getWeekEnd())
                .createdBy(post.getCreatedBy() != null ? post.getCreatedBy().getId() : null)
                .createdAt(post.getCreatedAt())
                .updatedAt(post.getUpdatedAt())
                .publishedAt(post.getPublishedAt())
                .assets(assets == null ? List.of() : assets)
                .translations(includeAllTranslations ? toLocalizedResponses(translations) : null)
                .missingLocales(includeMissingLocales
                        ? translationResolver.missingLocales(localeResolverService.getSupportedLocales(), translations)
                        : List.of())
                .build();
    }

    private Map<String, LocalizedContentResponse> toLocalizedResponses(Map<String, ContentPostTranslation> translations) {
        if (translations == null || translations.isEmpty()) {
            return Map.of();
        }
        return translations.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        entry -> LocalizedContentResponse.builder()
                                .title(entry.getValue().getTitle())
                                .summary(entry.getValue().getSummary())
                                .body(entry.getValue().getBodyMarkdown())
                                .build(),
                        (a, b) -> a,
                        LinkedHashMap::new
                ));
    }

    private record DraftTranslation(String title, String summary, String body) {}

    private record ComparableTranslation(String title, String summary, String body) {
        static ComparableTranslation from(ContentPostTranslation translation) {
            return new ComparableTranslation(
                    normalizeText(translation.getTitle()),
                    normalizeText(translation.getSummary()),
                    normalizeText(translation.getBodyMarkdown())
            );
        }
    }

    private record MeaningfulContentSnapshot(UUID contentTypeId,
                                             List<String> normalizedTags,
                                             List<String> normalizedSymbols,
                                             Map<String, ComparableTranslation> translations) {
        static MeaningfulContentSnapshot from(ContentPost post, java.util.function.Function<String, List<String>> listReader) {
            List<String> tags = normalizeTags(listReader.apply(post.getTags()));
            List<String> symbols = normalizeSymbols(listReader.apply(post.getSymbols()));
            Map<String, ComparableTranslation> translations = post.getTranslations().stream()
                    .collect(Collectors.toMap(
                            ContentPostTranslation::getLocale,
                            ComparableTranslation::from,
                            (first, second) -> first
                    ));
            return new MeaningfulContentSnapshot(post.getContentType().getId(), tags, symbols, translations);
        }
    }

    private static List<String> normalizeTags(List<String> values) {
        return normalizeList(values, false);
    }

    private static List<String> normalizeSymbols(List<String> values) {
        return normalizeList(values, true);
    }

    private static List<String> normalizeList(List<String> values, boolean uppercase) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        Set<String> unique = values.stream()
                .filter(item -> item != null && !item.trim().isBlank())
                .map(item -> uppercase
                        ? item.trim().toUpperCase(Locale.ROOT)
                        : item.trim().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
        return unique.stream().sorted().toList();
    }

    private static String normalizeText(String value) {
        if (value == null) {
            return "";
        }
        return value.trim();
    }
}
