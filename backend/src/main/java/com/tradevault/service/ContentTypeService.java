package com.tradevault.service;

import com.tradevault.domain.entity.ContentType;
import com.tradevault.domain.entity.ContentTypeTranslation;
import com.tradevault.dto.content.ContentTypeRequest;
import com.tradevault.dto.content.ContentTypeResponse;
import com.tradevault.dto.content.LocalizedContentTypeRequest;
import com.tradevault.dto.content.LocalizedContentTypeResponse;
import com.tradevault.repository.ContentTypeRepository;
import com.tradevault.repository.ContentTypeTranslationRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ContentTypeService {
    private static final Pattern KEY_PATTERN = Pattern.compile("^[A-Z0-9_]+$");

    private final ContentTypeRepository contentTypeRepository;
    private final ContentTypeTranslationRepository contentTypeTranslationRepository;
    private final TranslationResolver translationResolver;
    private final LocaleResolverService localeResolverService;

    @Transactional(readOnly = true)
    public List<ContentTypeResponse> listActive(String locale) {
        List<ContentType> types = contentTypeRepository.findByActiveTrueOrderBySortOrderAscKeyAsc();
        Map<UUID, Map<String, ContentTypeTranslation>> translations = fetchTranslations(types, localeResolverService.getSupportedLocales(), false);
        return types.stream()
                .map(type -> toResponse(type,
                        locale,
                        translations.getOrDefault(type.getId(), Map.of()),
                        true,
                        false))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ContentTypeResponse> adminList(String locale, boolean includeInactive) {
        List<ContentType> types = includeInactive
                ? contentTypeRepository.findByOrderBySortOrderAscKeyAsc()
                : contentTypeRepository.findByActiveTrueOrderBySortOrderAscKeyAsc();
        Map<UUID, Map<String, ContentTypeTranslation>> translations = fetchTranslations(types, null, true);
        return types.stream()
                .map(type -> toResponse(type,
                        locale,
                        translations.getOrDefault(type.getId(), Map.of()),
                        true,
                        true))
                .toList();
    }

    @Transactional
    public ContentTypeResponse create(ContentTypeRequest request, String locale) {
        String key = normalizeKey(request.getKey());
        if (contentTypeRepository.existsByKey(key)) {
            throw new IllegalArgumentException("Content type key already exists");
        }

        ContentType contentType = new ContentType();
        contentType.setKey(key);
        contentType.setActive(Boolean.TRUE.equals(request.getActive()));
        contentType.setSortOrder(request.getSortOrder());

        Map<String, DraftTypeTranslation> translations = normalizeTranslations(request.getTranslations());
        upsertTranslations(contentType, translations);

        ContentType saved = contentTypeRepository.save(contentType);
        return adminGet(saved.getId(), locale);
    }

    @Transactional
    public ContentTypeResponse update(UUID id, ContentTypeRequest request, String locale) {
        ContentType contentType = contentTypeRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Content type not found"));

        String key = normalizeKey(request.getKey());
        if (!contentType.getKey().equals(key) && contentTypeRepository.existsByKey(key)) {
            throw new IllegalArgumentException("Content type key already exists");
        }

        contentType.setKey(key);
        contentType.setActive(Boolean.TRUE.equals(request.getActive()));
        contentType.setSortOrder(request.getSortOrder());

        Map<String, DraftTypeTranslation> translations = normalizeTranslations(request.getTranslations());
        upsertTranslations(contentType, translations);

        contentTypeRepository.save(contentType);
        return adminGet(contentType.getId(), locale);
    }

    @Transactional(readOnly = true)
    public ContentTypeResponse adminGet(UUID id, String locale) {
        ContentType type = contentTypeRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Content type not found"));
        Map<String, ContentTypeTranslation> translations = fetchTranslations(List.of(type), null, true)
                .getOrDefault(type.getId(), Map.of());
        return toResponse(type, locale, translations, true, true);
    }

    private String normalizeKey(String raw) {
        if (raw == null || raw.trim().isBlank()) {
            throw new IllegalArgumentException("key is required");
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        if (!KEY_PATTERN.matcher(normalized).matches()) {
            throw new IllegalArgumentException("key must match [A-Z0-9_]+");
        }
        return normalized;
    }

    private Map<String, DraftTypeTranslation> normalizeTranslations(Map<String, LocalizedContentTypeRequest> translations) {
        if (translations == null || translations.isEmpty()) {
            throw new IllegalArgumentException("translations are required");
        }

        Map<String, DraftTypeTranslation> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, LocalizedContentTypeRequest> entry : translations.entrySet()) {
            String locale = normalizeTranslationLocale(entry.getKey());
            LocalizedContentTypeRequest payload = entry.getValue();
            if (payload == null || payload.getDisplayName() == null || payload.getDisplayName().trim().isBlank()) {
                throw new IllegalArgumentException("displayName is required for locale " + locale);
            }
            normalized.put(locale, new DraftTypeTranslation(payload.getDisplayName().trim(), normalizeBlank(payload.getDescription())));
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
        return rawLocale.trim().toLowerCase(Locale.ROOT).replace('_', '-');
    }

    private void upsertTranslations(ContentType contentType, Map<String, DraftTypeTranslation> translations) {
        Map<String, ContentTypeTranslation> existing = contentType.getTranslations().stream()
                .collect(Collectors.toMap(ContentTypeTranslation::getLocale, item -> item, (a, b) -> a));

        for (Map.Entry<String, DraftTypeTranslation> entry : translations.entrySet()) {
            String locale = entry.getKey();
            DraftTypeTranslation payload = entry.getValue();

            ContentTypeTranslation target = existing.get(locale);
            if (target == null) {
                target = new ContentTypeTranslation();
                target.setContentType(contentType);
                target.setLocale(locale);
                contentType.getTranslations().add(target);
            }

            target.setDisplayName(payload.displayName());
            target.setDescription(payload.description());
        }
    }

    private Map<UUID, Map<String, ContentTypeTranslation>> fetchTranslations(Collection<ContentType> types,
                                                                              Collection<String> locales,
                                                                              boolean includeAllLocales) {
        List<UUID> typeIds = types.stream().map(ContentType::getId).toList();
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

    private ContentTypeResponse toResponse(ContentType type,
                                           String requestedLocale,
                                           Map<String, ContentTypeTranslation> translations,
                                           boolean includeAllTranslations,
                                           boolean includeMissingLocales) {
        TranslationResolver.ResolvedTranslation<ContentTypeTranslation> resolved = translationResolver.resolve(translations, requestedLocale);
        ContentTypeTranslation resolvedTranslation = resolved.value();

        return ContentTypeResponse.builder()
                .id(type.getId())
                .key(type.getKey())
                .sortOrder(type.getSortOrder())
                .active(type.isActive())
                .displayName(resolvedTranslation != null ? resolvedTranslation.getDisplayName() : type.getKey())
                .description(resolvedTranslation != null ? resolvedTranslation.getDescription() : null)
                .locale(requestedLocale)
                .resolvedLocale(resolved.locale())
                .translations(includeAllTranslations ? toLocalizedResponses(translations) : null)
                .missingLocales(includeMissingLocales ? translationResolver.missingLocales(localeResolverService.getSupportedLocales(), translations) : List.of())
                .build();
    }

    private Map<String, LocalizedContentTypeResponse> toLocalizedResponses(Map<String, ContentTypeTranslation> translations) {
        if (translations == null || translations.isEmpty()) {
            return Map.of();
        }

        return translations.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        entry -> LocalizedContentTypeResponse.builder()
                                .displayName(entry.getValue().getDisplayName())
                                .description(entry.getValue().getDescription())
                                .build(),
                        (a, b) -> a,
                        LinkedHashMap::new
                ));
    }

    private String normalizeBlank(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private record DraftTypeTranslation(String displayName, String description) {}
}
