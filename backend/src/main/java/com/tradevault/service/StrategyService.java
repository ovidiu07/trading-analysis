package com.tradevault.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.ContentPost;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.entity.UserStrategy;
import com.tradevault.dto.content.ContentPostResponse;
import com.tradevault.dto.strategy.StrategyListResponse;
import com.tradevault.dto.strategy.StrategyRequest;
import com.tradevault.dto.strategy.StrategyResponse;
import com.tradevault.repository.ContentPostRepository;
import com.tradevault.repository.UserStrategyRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StrategyService {
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};
    private static final String SOURCE_MY = "MY";
    private static final String SOURCE_MENTOR = "MENTOR";

    private final UserStrategyRepository userStrategyRepository;
    private final ContentPostService contentPostService;
    private final ContentPostRepository contentPostRepository;
    private final CurrentUserService currentUserService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public StrategyListResponse listStrategies(boolean includeArchived, String locale) {
        User user = currentUserService.getCurrentUser();
        List<UserStrategy> myStrategies = includeArchived
                ? userStrategyRepository.findByUser_IdOrderByUpdatedAtDesc(user.getId())
                : userStrategyRepository.findByUser_IdAndArchivedOrderByUpdatedAtDesc(user.getId(), false);

        List<ContentPostResponse> mentorStrategies = contentPostService.listPublished("STRATEGY", null, false, locale);

        return StrategyListResponse.builder()
                .myStrategies(myStrategies.stream().map(this::toMyResponse).toList())
                .mentorStrategies(mentorStrategies.stream()
                        .sorted(Comparator
                                .comparing((ContentPostResponse item) -> item.getUpdatedAt() == null ? OffsetDateTime.MIN : item.getUpdatedAt())
                                .reversed())
                        .map(this::toMentorResponse)
                        .toList())
                .build();
    }

    @Transactional
    public StrategyResponse createMyStrategy(StrategyRequest request) {
        User user = currentUserService.getCurrentUser();
        UserStrategy strategy = UserStrategy.builder()
                .user(user)
                .name(requireText(request.getName(), "name"))
                .model(requireText(request.getModel(), "model"))
                .entryConditionsJson(writeList(normalizeList(request.getEntryConditions())))
                .invalidationLogic(requireText(request.getInvalidationLogic(), "invalidationLogic"))
                .tpFramework(requireText(request.getTpFramework(), "tpFramework"))
                .noTradeRules(normalizeOptionalText(request.getNoTradeRules()))
                .sessionSuitabilityJson(writeList(normalizeList(request.getSessionSuitability())))
                .tagsJson(writeList(normalizeList(request.getTags())))
                .archived(Boolean.TRUE.equals(request.getArchived()))
                .build();
        return toMyResponse(userStrategyRepository.save(strategy));
    }

    @Transactional
    public StrategyResponse updateMyStrategy(UUID strategyId, StrategyRequest request) {
        User user = currentUserService.getCurrentUser();
        UserStrategy strategy = userStrategyRepository.findByIdAndUser_Id(strategyId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Strategy not found"));

        strategy.setName(requireText(request.getName(), "name"));
        strategy.setModel(requireText(request.getModel(), "model"));
        strategy.setEntryConditionsJson(writeList(normalizeList(request.getEntryConditions())));
        strategy.setInvalidationLogic(requireText(request.getInvalidationLogic(), "invalidationLogic"));
        strategy.setTpFramework(requireText(request.getTpFramework(), "tpFramework"));
        strategy.setNoTradeRules(normalizeOptionalText(request.getNoTradeRules()));
        strategy.setSessionSuitabilityJson(writeList(normalizeList(request.getSessionSuitability())));
        strategy.setTagsJson(writeList(normalizeList(request.getTags())));
        strategy.setArchived(Boolean.TRUE.equals(request.getArchived()));

        return toMyResponse(userStrategyRepository.save(strategy));
    }

    @Transactional
    public void archiveMyStrategy(UUID strategyId) {
        User user = currentUserService.getCurrentUser();
        UserStrategy strategy = userStrategyRepository.findByIdAndUser_Id(strategyId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Strategy not found"));
        strategy.setArchived(true);
        userStrategyRepository.save(strategy);
    }

    @Transactional(readOnly = true)
    public ContentPost requireMentorStrategy(UUID strategyId) {
        return contentPostRepository.findById(strategyId)
                .filter(post -> post.getContentType() != null && "STRATEGY".equalsIgnoreCase(post.getContentType().getKey()))
                .orElseThrow(() -> new EntityNotFoundException("Mentor strategy not found"));
    }

    private StrategyResponse toMyResponse(UserStrategy item) {
        return StrategyResponse.builder()
                .id(item.getId())
                .source(SOURCE_MY)
                .name(item.getName())
                .model(item.getModel())
                .entryConditions(readList(item.getEntryConditionsJson()))
                .invalidationLogic(item.getInvalidationLogic())
                .tpFramework(item.getTpFramework())
                .noTradeRules(item.getNoTradeRules())
                .sessionSuitability(readList(item.getSessionSuitabilityJson()))
                .tags(readList(item.getTagsJson()))
                .archived(item.isArchived())
                .updatedAt(item.getUpdatedAt())
                .build();
    }

    private StrategyResponse toMentorResponse(ContentPostResponse item) {
        Map<String, Object> template = item.getTemplateFields() == null ? Map.of() : item.getTemplateFields();
        String model = firstNonBlank(
                readText(template.get("entryModel")),
                readText(template.get("what")),
                item.getSummary(),
                item.getTitle()
        );
        List<String> entryConditions = firstNonEmptyList(
                readList(template.get("filters")),
                readList(template.get("checklist"))
        );
        String invalidation = firstNonBlank(readText(template.get("invalidation")), "");
        String targets = firstNonBlank(readText(template.get("targets")), "");
        String noTradeRules = normalizeOptionalText(readText(template.get("failureModes")));

        return StrategyResponse.builder()
                .id(item.getId())
                .source(SOURCE_MENTOR)
                .name(item.getTitle())
                .slug(item.getSlug())
                .model(model)
                .entryConditions(entryConditions)
                .invalidationLogic(invalidation)
                .tpFramework(targets)
                .noTradeRules(noTradeRules)
                .sessionSuitability(extractSessionSuitability(item.getTags()))
                .tags(item.getTags() == null ? List.of() : item.getTags())
                .archived(false)
                .updatedAt(item.getUpdatedAt())
                .build();
    }

    private List<String> extractSessionSuitability(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return List.of();
        }
        List<String> sessions = new ArrayList<>();
        for (String rawTag : tags) {
            if (rawTag == null) continue;
            String tag = rawTag.toUpperCase(Locale.ROOT);
            if (tag.contains("ASIA") && !sessions.contains("Asia")) sessions.add("Asia");
            if (tag.contains("LONDON") && !sessions.contains("London")) sessions.add("London");
            if ((tag.contains("NEW YORK") || tag.contains("NY")) && !sessions.contains("NY")) sessions.add("NY");
        }
        return sessions;
    }

    private List<String> firstNonEmptyList(List<String>... options) {
        for (List<String> option : options) {
            if (option != null && !option.isEmpty()) {
                return option;
            }
        }
        return List.of();
    }

    private String requireText(String value, String fieldName) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return normalized;
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String normalized = normalizeOptionalText(value);
            if (normalized != null) {
                return normalized;
            }
        }
        return "";
    }

    private List<String> normalizeList(Collection<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        return values.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .distinct()
                .toList();
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

    private String readText(Object value) {
        if (value == null) return null;
        if (value instanceof String text) {
            return normalizeOptionalText(text);
        }
        return normalizeOptionalText(String.valueOf(value));
    }

    private List<String> readList(Object value) {
        if (value == null) {
            return List.of();
        }
        if (value instanceof Collection<?> collection) {
            return collection.stream()
                    .map(item -> item == null ? null : String.valueOf(item))
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(item -> !item.isEmpty())
                    .toList();
        }
        if (value instanceof String rawString) {
            if (rawString.isBlank()) {
                return List.of();
            }
            try {
                List<String> parsed = objectMapper.readValue(rawString, STRING_LIST);
                return parsed == null ? List.of() : parsed.stream()
                        .filter(Objects::nonNull)
                        .map(String::trim)
                        .filter(item -> !item.isEmpty())
                        .toList();
            } catch (Exception ignored) {
                return rawString.lines()
                        .map(String::trim)
                        .map(line -> line.replaceFirst("^[-*]\\s*", ""))
                        .filter(line -> !line.isBlank())
                        .toList();
            }
        }
        return List.of();
    }
}
