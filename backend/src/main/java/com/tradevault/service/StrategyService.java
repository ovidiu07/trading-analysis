package com.tradevault.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.domain.entity.Asset;
import com.tradevault.domain.entity.ContentPost;
import com.tradevault.domain.entity.StrategyVersion;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.entity.UserStrategy;
import com.tradevault.domain.enums.AssetScope;
import com.tradevault.dto.asset.AssetResponse;
import com.tradevault.dto.content.ContentPostResponse;
import com.tradevault.dto.strategy.StrategyListResponse;
import com.tradevault.dto.strategy.StrategyRequest;
import com.tradevault.dto.strategy.StrategyResponse;
import com.tradevault.repository.AssetRepository;
import com.tradevault.repository.ContentPostRepository;
import com.tradevault.repository.StrategyAssetRepository;
import com.tradevault.repository.StrategyVersionRepository;
import com.tradevault.repository.UserStrategyRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.safety.Safelist;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
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
    private static final String EMPTY_ENTRY_RICH = "<p></p>";
    private static final Safelist ENTRY_RICH_SAFE_LIST = Safelist.none()
            .addTags("p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li", "h3", "h4", "blockquote", "pre", "code");

    private final UserStrategyRepository userStrategyRepository;
    private final StrategyAssetRepository strategyAssetRepository;
    private final AssetRepository assetRepository;
    private final AssetService assetService;
    private final ContentPostService contentPostService;
    private final ContentPostRepository contentPostRepository;
    private final CurrentUserService currentUserService;
    private final ObjectMapper objectMapper;
    private final StrategyVersionRepository strategyVersionRepository;

    @Transactional(readOnly = true)
    public StrategyListResponse listStrategies(boolean includeArchived, String locale) {
        User user = currentUserService.getCurrentUser();
        List<UserStrategy> myStrategies = includeArchived
                ? userStrategyRepository.findByUser_IdOrderByUpdatedAtDesc(user.getId())
                : userStrategyRepository.findByUser_IdAndArchivedOrderByUpdatedAtDesc(user.getId(), false);
        Map<UUID, List<AssetResponse>> myAssetsByStrategy = assetService.mapByStrategies(myStrategies);

        List<ContentPostResponse> mentorStrategies = contentPostService.listPublished("STRATEGY", null, false, locale);

        return StrategyListResponse.builder()
                .myStrategies(myStrategies.stream()
                        .map(strategy -> toMyResponse(strategy, myAssetsByStrategy.getOrDefault(strategy.getId(), List.of())))
                        .toList())
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
        String entryConditionsRich = normalizeEntryConditionsRich(request.getEntryConditionsRich(), request.getEntryConditions());
        List<String> entryConditionsList = extractEntryConditions(entryConditionsRich, request.getEntryConditions());

        UserStrategy strategy = UserStrategy.builder()
                .user(user)
                .name(requireText(request.getName(), "name"))
                .model(requireText(request.getModel(), "model"))
                .entryConditionsJson(writeList(entryConditionsList))
                .entryConditionsRich(entryConditionsRich)
                .invalidationLogic(requireText(request.getInvalidationLogic(), "invalidationLogic"))
                .tpFramework(requireText(request.getTpFramework(), "tpFramework"))
                .noTradeRules(normalizeOptionalText(request.getNoTradeRules()))
                .sessionSuitabilityJson(writeList(normalizeList(request.getSessionSuitability())))
                .tagsJson(writeList(normalizeList(request.getTags())))
                .archived(Boolean.TRUE.equals(request.getArchived()))
                .build();

        UserStrategy saved = userStrategyRepository.save(strategy);
        syncStrategyAssets(saved, user, request.getAssetIds());
        if (request.getSnapshotAssetId() != null) {
            saved.setSnapshotAssetId(validateSnapshotAsset(saved.getId(), request.getSnapshotAssetId(), user));
            saved = userStrategyRepository.save(saved);
        }
        createStrategyVersion(saved, user);
        return toMyResponse(saved, assetService.listByStrategy(saved.getId()));
    }

    @Transactional
    public StrategyResponse updateMyStrategy(UUID strategyId, StrategyRequest request) {
        User user = currentUserService.getCurrentUser();
        UserStrategy strategy = userStrategyRepository.findByIdAndUser_Id(strategyId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Strategy not found"));
        UUID previousSnapshotAssetId = strategy.getSnapshotAssetId();
        String entryConditionsRich = normalizeEntryConditionsRich(request.getEntryConditionsRich(), request.getEntryConditions());
        List<String> entryConditionsList = extractEntryConditions(entryConditionsRich, request.getEntryConditions());

        strategy.setName(requireText(request.getName(), "name"));
        strategy.setModel(requireText(request.getModel(), "model"));
        strategy.setEntryConditionsJson(writeList(entryConditionsList));
        strategy.setEntryConditionsRich(entryConditionsRich);
        strategy.setInvalidationLogic(requireText(request.getInvalidationLogic(), "invalidationLogic"));
        strategy.setTpFramework(requireText(request.getTpFramework(), "tpFramework"));
        strategy.setNoTradeRules(normalizeOptionalText(request.getNoTradeRules()));
        strategy.setSessionSuitabilityJson(writeList(normalizeList(request.getSessionSuitability())));
        strategy.setTagsJson(writeList(normalizeList(request.getTags())));
        strategy.setArchived(Boolean.TRUE.equals(request.getArchived()));
        userStrategyRepository.save(strategy);

        syncStrategyAssets(strategy, user, request.getAssetIds());
        if (request.getSnapshotAssetId() != null) {
            strategy.setSnapshotAssetId(validateSnapshotAsset(strategy.getId(), request.getSnapshotAssetId(), user));
        } else if (request.getAssetIds() != null
                && previousSnapshotAssetId != null
                && !strategyAssetRepository.existsByStrategy_IdAndAsset_Id(strategy.getId(), previousSnapshotAssetId)) {
            strategy.setSnapshotAssetId(null);
        }

        UserStrategy saved = userStrategyRepository.save(strategy);
        createStrategyVersion(saved, user);
        return toMyResponse(saved, assetService.listByStrategy(saved.getId()));
    }

    @Transactional
    public void archiveMyStrategy(UUID strategyId) {
        User user = currentUserService.getCurrentUser();
        UserStrategy strategy = userStrategyRepository.findByIdAndUser_Id(strategyId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Strategy not found"));
        strategy.setArchived(true);
        userStrategyRepository.save(strategy);
    }

    @Transactional
    public StrategyResponse attachAsset(UUID strategyId, UUID assetId) {
        User user = currentUserService.getCurrentUser();
        UserStrategy strategy = requireOwnedStrategy(strategyId, user.getId());
        Asset asset = requireOwnedStrategyAsset(assetId, user.getId());
        if (!strategyAssetRepository.existsByStrategy_IdAndAsset_Id(strategy.getId(), asset.getId())) {
            int nextSortOrder = strategyAssetRepository.findByStrategy_IdOrderBySortOrderAscCreatedAtAsc(strategy.getId()).stream()
                    .map(item -> item.getSortOrder() == null ? 0 : item.getSortOrder())
                    .max(Comparator.naturalOrder())
                    .orElse(-1) + 1;
            strategyAssetRepository.save(com.tradevault.domain.entity.StrategyAsset.builder()
                    .strategy(strategy)
                    .asset(asset)
                    .sortOrder(nextSortOrder)
                    .build());
        }
        return toMyResponse(strategy, assetService.listByStrategy(strategy.getId()));
    }

    @Transactional
    public StrategyResponse removeAsset(UUID strategyId, UUID assetId) {
        User user = currentUserService.getCurrentUser();
        UserStrategy strategy = requireOwnedStrategy(strategyId, user.getId());
        boolean linked = strategyAssetRepository.existsByStrategy_IdAndAsset_Id(strategy.getId(), assetId);
        if (!linked) {
            throw new IllegalArgumentException("Asset is not linked to this strategy");
        }
        if (Objects.equals(strategy.getSnapshotAssetId(), assetId)) {
            strategy.setSnapshotAssetId(null);
            userStrategyRepository.save(strategy);
        }
        assetService.deleteAsset(assetId);
        return toMyResponse(strategy, assetService.listByStrategy(strategy.getId()));
    }

    @Transactional
    public StrategyResponse setSnapshotAsset(UUID strategyId, UUID assetId) {
        User user = currentUserService.getCurrentUser();
        UserStrategy strategy = requireOwnedStrategy(strategyId, user.getId());
        strategy.setSnapshotAssetId(validateSnapshotAsset(strategy.getId(), assetId, user));
        UserStrategy saved = userStrategyRepository.save(strategy);
        return toMyResponse(saved, assetService.listByStrategy(saved.getId()));
    }

    @Transactional
    public StrategyResponse clearSnapshotAsset(UUID strategyId) {
        User user = currentUserService.getCurrentUser();
        UserStrategy strategy = requireOwnedStrategy(strategyId, user.getId());
        strategy.setSnapshotAssetId(null);
        UserStrategy saved = userStrategyRepository.save(strategy);
        return toMyResponse(saved, assetService.listByStrategy(saved.getId()));
    }

    @Transactional(readOnly = true)
    public ContentPost requireMentorStrategy(UUID strategyId) {
        return contentPostRepository.findById(strategyId)
                .filter(post -> post.getContentType() != null && "STRATEGY".equalsIgnoreCase(post.getContentType().getKey()))
                .orElseThrow(() -> new EntityNotFoundException("Mentor strategy not found"));
    }

    private StrategyResponse toMyResponse(UserStrategy item, List<AssetResponse> assets) {
        List<String> entryConditions = readList(item.getEntryConditionsJson());
        if (entryConditions.isEmpty()) {
            entryConditions = extractEntryConditions(item.getEntryConditionsRich(), null);
        }
        String entryConditionsRich = normalizeOptionalText(item.getEntryConditionsRich());
        if (entryConditionsRich == null) {
            entryConditionsRich = toBulletHtml(entryConditions);
        }
        AssetResponse snapshotAsset = resolveSnapshotAsset(item.getSnapshotAssetId(), assets);

        return StrategyResponse.builder()
                .id(item.getId())
                .source(SOURCE_MY)
                .name(item.getName())
                .model(item.getModel())
                .entryConditionsRich(entryConditionsRich)
                .entryConditions(entryConditions)
                .invalidationLogic(item.getInvalidationLogic())
                .tpFramework(item.getTpFramework())
                .noTradeRules(item.getNoTradeRules())
                .sessionSuitability(readList(item.getSessionSuitabilityJson()))
                .tags(readList(item.getTagsJson()))
                .snapshotAssetId(item.getSnapshotAssetId())
                .snapshotAsset(snapshotAsset)
                .assets(assets == null ? List.of() : assets)
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
        String entryConditionsRich = normalizeEntryConditionsRich(readText(template.get("entryConditionsRich")), entryConditions);
        String invalidation = firstNonBlank(readText(template.get("invalidation")), "");
        String targets = firstNonBlank(readText(template.get("targets")), "");
        String noTradeRules = normalizeOptionalText(readText(template.get("failureModes")));
        List<AssetResponse> assets = item.getAssets() == null ? List.of() : item.getAssets();
        AssetResponse snapshotAsset = resolveSnapshotAsset(item.getSnapshotAssetId(), assets);

        return StrategyResponse.builder()
                .id(item.getId())
                .source(SOURCE_MENTOR)
                .name(item.getTitle())
                .slug(item.getSlug())
                .model(model)
                .entryConditionsRich(entryConditionsRich)
                .entryConditions(entryConditions)
                .invalidationLogic(invalidation)
                .tpFramework(targets)
                .noTradeRules(noTradeRules)
                .sessionSuitability(extractSessionSuitability(item.getTags()))
                .tags(item.getTags() == null ? List.of() : item.getTags())
                .snapshotAssetId(item.getSnapshotAssetId())
                .snapshotAsset(snapshotAsset)
                .assets(assets)
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

    private void createStrategyVersion(UserStrategy strategy, User user) {
        int nextVersion = strategyVersionRepository.findFirstByStrategy_IdOrderByVersionNumberDesc(strategy.getId())
                .map(item -> item.getVersionNumber() + 1)
                .orElse(1);
        ObjectNode snapshot = objectMapper.createObjectNode();
        snapshot.put("name", strategy.getName());
        snapshot.put("model", strategy.getModel());
        snapshot.put("entryConditionsJson", strategy.getEntryConditionsJson());
        snapshot.put("entryConditionsRich", strategy.getEntryConditionsRich());
        snapshot.put("invalidationLogic", strategy.getInvalidationLogic());
        snapshot.put("tpFramework", strategy.getTpFramework());
        snapshot.put("noTradeRules", strategy.getNoTradeRules());
        snapshot.put("sessionSuitabilityJson", strategy.getSessionSuitabilityJson());
        snapshot.put("tagsJson", strategy.getTagsJson());
        if (strategy.getSnapshotAssetId() != null) {
            snapshot.put("snapshotAssetId", strategy.getSnapshotAssetId().toString());
        }

        StrategyVersion version = StrategyVersion.builder()
                .strategy(strategy)
                .user(user)
                .versionNumber(nextVersion)
                .snapshotJson(snapshot)
                .build();
        strategyVersionRepository.save(version);
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

    private String normalizeEntryConditionsRich(String richValue, Collection<String> fallbackLines) {
        String rich = normalizeOptionalText(richValue);
        if (rich == null) {
            List<String> normalizedFallback = normalizeList(fallbackLines);
            if (normalizedFallback.isEmpty()) {
                return EMPTY_ENTRY_RICH;
            }
            return toBulletHtml(normalizedFallback);
        }
        String sanitized = Jsoup.clean(rich, ENTRY_RICH_SAFE_LIST);
        String normalized = normalizeOptionalText(sanitized);
        return normalized == null ? EMPTY_ENTRY_RICH : normalized;
    }

    private List<String> extractEntryConditions(String richValue, Collection<String> fallbackLines) {
        List<String> normalizedFallback = normalizeList(fallbackLines);
        if (!normalizedFallback.isEmpty()) {
            return normalizedFallback;
        }

        String normalizedRich = normalizeOptionalText(richValue);
        if (normalizedRich == null) {
            return List.of();
        }

        Document document = Jsoup.parseBodyFragment(normalizedRich);
        List<String> listItems = document.select("li").stream()
                .map(element -> normalizeOptionalText(element.text()))
                .filter(Objects::nonNull)
                .toList();
        if (!listItems.isEmpty()) {
            return listItems.stream().distinct().toList();
        }

        List<String> blocks = document.select("p, h3, h4, blockquote, pre, code").stream()
                .map(element -> normalizeOptionalText(element.text()))
                .filter(Objects::nonNull)
                .toList();
        if (!blocks.isEmpty()) {
            return blocks.stream().distinct().toList();
        }

        String plain = normalizeOptionalText(document.text());
        return plain == null ? List.of() : List.of(plain);
    }

    private String toBulletHtml(Collection<String> values) {
        List<String> normalized = normalizeList(values);
        if (normalized.isEmpty()) {
            return EMPTY_ENTRY_RICH;
        }
        StringBuilder html = new StringBuilder("<ul>");
        normalized.forEach(item -> html.append("<li>").append(Jsoup.clean(item, Safelist.none())).append("</li>"));
        html.append("</ul>");
        return html.toString();
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

    private UserStrategy requireOwnedStrategy(UUID strategyId, UUID userId) {
        return userStrategyRepository.findByIdAndUser_Id(strategyId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Strategy not found"));
    }

    private Asset requireOwnedStrategyAsset(UUID assetId, UUID userId) {
        Asset asset = assetRepository.findById(assetId)
                .orElseThrow(() -> new EntityNotFoundException("Asset not found"));
        if (asset.getScope() != AssetScope.STRATEGY) {
            throw new IllegalArgumentException("Asset must use STRATEGY scope");
        }
        if (asset.getOwnerUser() == null || !Objects.equals(asset.getOwnerUser().getId(), userId)) {
            throw new EntityNotFoundException("Asset not found");
        }
        return asset;
    }

    private UUID validateSnapshotAsset(UUID strategyId, UUID snapshotAssetId, User user) {
        requireOwnedStrategyAsset(snapshotAssetId, user.getId());
        boolean linked = strategyAssetRepository.existsByStrategy_IdAndAsset_Id(strategyId, snapshotAssetId);
        if (!linked) {
            throw new IllegalArgumentException("snapshotAssetId must reference an asset linked to this strategy");
        }
        String contentType = assetRepository.findById(snapshotAssetId)
                .map(Asset::getContentType)
                .orElse(null);
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new IllegalArgumentException("snapshotAssetId must reference an image asset");
        }
        return snapshotAssetId;
    }

    private void syncStrategyAssets(UserStrategy strategy, User user, List<UUID> requestedAssetIds) {
        if (requestedAssetIds == null) {
            return;
        }

        List<UUID> normalizedRequested = requestedAssetIds.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        List<com.tradevault.domain.entity.StrategyAsset> existingRelations = strategyAssetRepository
                .findByStrategy_IdOrderBySortOrderAscCreatedAtAsc(strategy.getId());
        LinkedHashSet<UUID> existingAssetIds = existingRelations.stream()
                .map(relation -> relation.getAsset().getId())
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

        for (com.tradevault.domain.entity.StrategyAsset relation : existingRelations) {
            UUID assetId = relation.getAsset().getId();
            if (!normalizedRequested.contains(assetId)) {
                strategyAssetRepository.deleteByStrategy_IdAndAsset_Id(strategy.getId(), assetId);
            }
        }

        int nextSortOrder = existingRelations.stream()
                .map(item -> item.getSortOrder() == null ? 0 : item.getSortOrder())
                .max(Comparator.naturalOrder())
                .orElse(-1) + 1;

        for (UUID assetId : normalizedRequested) {
            requireOwnedStrategyAsset(assetId, user.getId());
            if (existingAssetIds.contains(assetId)) {
                continue;
            }
            strategyAssetRepository.save(com.tradevault.domain.entity.StrategyAsset.builder()
                    .strategy(strategy)
                    .asset(assetRepository.getReferenceById(assetId))
                    .sortOrder(nextSortOrder++)
                    .build());
        }
    }

    private AssetResponse resolveSnapshotAsset(UUID snapshotAssetId, List<AssetResponse> assets) {
        if (snapshotAssetId == null || assets == null || assets.isEmpty()) {
            return null;
        }
        return assets.stream()
                .filter(asset -> Objects.equals(snapshotAssetId, asset.getId()))
                .findFirst()
                .orElse(null);
    }
}
