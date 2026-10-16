package com.tradevault.service;

import static com.tradevault.service.strategy.StudioDefinitionValidator.require;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.domain.entity.*;
import com.tradevault.domain.enums.BacktestingTradeScope;
import com.tradevault.domain.enums.BacktestingTradeSource;
import com.tradevault.dto.backtesting.BacktestingTradeResponse;
import com.tradevault.dto.strategy.*;
import com.tradevault.repository.*;
import com.tradevault.service.strategy.StudioDefinitionValidator;

import jakarta.persistence.EntityNotFoundException;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class StrategyStudioService {
    private final UserStrategyRepository strategies;
    private final StrategyVersionRepository versions;
    private final StrategyChecklistExecutionRepository executions;
    private final BacktestingWorkspaceRepository workspaces;
    private final BacktestingTradeRepository trades;
    private final CurrentUserService currentUser;
    private final StrategyService strategyService;
    private final AssetService assets;
    private final StudioDefinitionValidator validator;
    private final BacktestingResearchService research;
    private final ObjectMapper mapper;

    public record StudioResponse(StrategyResponse strategy, JsonNode definition, Long revision) {}

    public record VersionSummary(
            UUID id,
            int versionNumber,
            String name,
            String changeDescription,
            OffsetDateTime createdAt) {}

    public record VersionDetail(VersionSummary version, JsonNode snapshot) {}

    public record CheckpointRequest(Long expectedRevision, String name, String description) {}

    public record RestoreRequest(Long expectedRevision) {}

    public record ExecutionRequest(
            Long expectedRevision,
            String checklistId,
            UUID versionId,
            Map<String, Boolean> answers) {}

    public record ExecutionResponse(
            UUID id,
            UUID versionId,
            JsonNode template,
            JsonNode answers,
            OffsetDateTime createdAt) {}

    public record TradeLinkRequest(List<UUID> tradeIds, UUID versionId, String sample) {}

    public record WorkspaceLink(UUID id, String title, String symbol) {}

    public record EvidenceResponse(
            List<BacktestingTradeResponse> trades, List<WorkspaceLink> workspaces) {}

    public record PortableDefinition(
            int schemaVersion, StrategyRequest strategy, JsonNode definition) {}

    @Transactional(readOnly = true)
    public StudioResponse get(UUID id) {
        return response(owned(id, false));
    }

    @Transactional
    public StudioResponse create(StudioWriteRequest request) {
        ObjectNode doc = validator.validate(request.definition());
        validateBase(request.strategy());
        request.strategy()
                .setArchived(doc.path("metadata").path("status").asText().equals("Archived"));
        StrategyResponse base = strategyService.createMyStrategyDraft(request.strategy());
        UserStrategy row = owned(base.getId(), true);
        validateRelationships(doc, row);
        row.setStudioJson(doc);
        strategies.saveAndFlush(row);
        checkpoint(row, "Initial studio configuration", "Editable strategy definition");
        return response(row);
    }

    @Transactional
    public StudioResponse save(UUID id, StudioWriteRequest request) {
        UserStrategy row = owned(id, true);
        revision(row, request.expectedRevision());
        ObjectNode doc = validator.validate(request.definition());
        validateBase(request.strategy());
        row.setStudioJson(doc);
        request.strategy()
                .setArchived(doc.path("metadata").path("status").asText().equals("Archived"));
        strategyService.updateMyStrategyDraft(id, request.strategy());
        validateRelationships(doc, row);
        strategies.flush();
        return response(row);
    }

    @Transactional(readOnly = true)
    public List<VersionSummary> history(UUID id) {
        UserStrategy row = owned(id, false);
        return versions.findSummaries(id, row.getUser().getId()).stream()
                .map(
                        v ->
                                new VersionSummary(
                                        v.getId(),
                                        v.getVersionNumber(),
                                        v.getName(),
                                        v.getChangeDescription(),
                                        v.getCreatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public VersionDetail version(UUID id, UUID versionId) {
        StrategyVersion v = ownedVersion(owned(id, false), versionId);
        return new VersionDetail(summary(v), v.getSnapshotJson());
    }

    @Transactional
    public VersionDetail checkpoint(UUID id, CheckpointRequest request) {
        UserStrategy row = owned(id, true);
        revision(row, request.expectedRevision());
        require(
                request.name() != null
                        && !request.name().isBlank()
                        && request.name().length() <= 120,
                "Checkpoint name is required (120 characters maximum)");
        require(
                request.description() == null || request.description().length() <= 10000,
                "Change description is too long");
        row.setUpdatedAt(OffsetDateTime.now());
        strategies.flush();
        StrategyVersion v = checkpoint(row, request.name().trim(), request.description());
        return new VersionDetail(summary(v), v.getSnapshotJson());
    }

    @Transactional
    public StudioResponse restore(UUID id, UUID versionId, RestoreRequest request) {
        UserStrategy row = owned(id, true);
        revision(row, request.expectedRevision());
        StrategyVersion v = ownedVersion(row, versionId);
        JsonNode snap = v.getSnapshotJson();
        StrategyRequest base = fromSnapshot(snap);
        JsonNode definition = snap.hasNonNull("studio") ? snap.path("studio") : validator.empty();
        if (!snap.hasNonNull("studio") && snap.path("archived").asBoolean())
            ((ObjectNode) definition.path("metadata")).put("status", "Archived");
        save(id, new StudioWriteRequest(row.getRevision(), base, definition));
        row.setSnapshotAssetId(base.getSnapshotAssetId());
        strategies.flush();
        checkpoint(
                row,
                "Restored v" + v.getVersionNumber(),
                "New checkpoint based on "
                        + (v.getName() == null ? "v" + v.getVersionNumber() : v.getName()));
        return response(row);
    }

    @Transactional
    public StudioResponse duplicate(UUID id) {
        UserStrategy row = owned(id, false);
        StrategyRequest base = fromSnapshot(snapshot(row));
        String name = row.getName();
        base.setName(name.substring(0, Math.min(name.length(), 112)) + " (copy)");
        base.setArchived(false);
        ObjectNode doc = definition(row).deepCopy();
        ((ObjectNode) doc.path("metadata")).put("status", "Draft").put("favorite", false);
        return create(new StudioWriteRequest(null, base, doc));
    }

    @Transactional(readOnly = true)
    public PortableDefinition export(UUID id) {
        UserStrategy row = owned(id, false);
        return new PortableDefinition(1, fromSnapshot(snapshot(row)), definition(row));
    }

    @Transactional
    public StudioResponse importJson(JsonNode raw) {
        require(
                raw != null
                        && raw.isObject()
                        && raw.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length
                                <= 2 * StudioDefinitionValidator.MAX_BYTES,
                "Import must be a JSON object up to 4 MB");
        Set<String> envelope = Set.of("schemaVersion", "strategy", "definition");
        raw.fieldNames()
                .forEachRemaining(
                        key -> require(envelope.contains(key), "Unsupported import field: " + key));
        require(
                raw.path("schemaVersion").isIntegralNumber()
                        && raw.path("schemaVersion").asInt() == 1,
                "Unsupported export schema version");
        require(raw.path("strategy").isObject(), "Strategy metadata is required");
        Set<String> fields =
                Set.of(
                        "name",
                        "model",
                        "entryConditionsRich",
                        "entryConditions",
                        "invalidationLogic",
                        "tpFramework",
                        "noTradeRules",
                        "sessionSuitability",
                        "tags",
                        "snapshotAssetId",
                        "assetIds",
                        "archived");
        raw.path("strategy")
                .fieldNames()
                .forEachRemaining(
                        key ->
                                require(
                                        fields.contains(key),
                                        "Unsupported strategy import field: " + key));
        for (String key :
                List.of(
                        "name",
                        "model",
                        "entryConditionsRich",
                        "invalidationLogic",
                        "tpFramework",
                        "noTradeRules",
                        "snapshotAssetId")) {
            JsonNode value = raw.path("strategy").path(key);
            require(
                    value.isMissingNode() || value.isNull() || value.isTextual(),
                    "Strategy import field must be text: " + key);
        }
        for (String key : List.of("entryConditions", "sessionSuitability", "tags", "assetIds")) {
            JsonNode values = raw.path("strategy").path(key);
            if (!values.isMissingNode() && !values.isNull()) {
                require(values.isArray(), "Strategy import field must be an array: " + key);
                for (JsonNode value : values)
                    require(
                            value.isTextual(),
                            "Strategy import array requires text values: " + key);
            }
        }
        require(
                !raw.path("strategy").has("archived")
                        || raw.path("strategy").path("archived").isBoolean(),
                "Archived must be a boolean");
        try {
            return importDefinition(
                    new PortableDefinition(
                            1,
                            mapper.treeToValue(raw.path("strategy"), StrategyRequest.class),
                            raw.path("definition")));
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new IllegalArgumentException("Malformed strategy metadata");
        }
    }

    @Transactional
    public StudioResponse importDefinition(PortableDefinition data) {
        require(data.schemaVersion() == 1, "Unsupported export schema version");
        require(
                data.strategy() != null && data.definition() != null,
                "Strategy and definition are required");
        return create(new StudioWriteRequest(null, data.strategy(), data.definition()));
    }

    @Transactional(readOnly = true)
    public List<ExecutionResponse> executions(UUID id) {
        UserStrategy row = owned(id, false);
        return executions
                .findTop100ByStrategy_IdAndUser_IdOrderByCreatedAtDesc(id, row.getUser().getId())
                .stream()
                .map(this::executionResponse)
                .toList();
    }

    @Transactional
    public ExecutionResponse execute(UUID id, ExecutionRequest request) {
        UserStrategy row = owned(id, true);
        revision(row, request.expectedRevision());
        JsonNode template = null;
        for (JsonNode item : definition(row).path("checklists"))
            if (item.path("id").asText().equals(request.checklistId())) template = item;
        require(template != null, "Checklist not found");
        require(
                request.answers() != null && request.answers().size() <= 200,
                "Invalid checklist answers");
        Set<String> ids = new HashSet<>();
        for (JsonNode item : template.path("items")) {
            String key = item.path("id").asText();
            ids.add(key);
            require(
                    !item.path("mandatory").asBoolean()
                            || Boolean.TRUE.equals(request.answers().get(key)),
                    "Complete every mandatory checklist item before saving an execution");
        }
        require(
                ids.containsAll(request.answers().keySet())
                        && request.answers().values().stream().noneMatch(Objects::isNull),
                "Unknown checklist item or invalid answer");
        if (request.versionId() != null) ownedVersion(row, request.versionId());
        ObjectNode capture = mapper.createObjectNode();
        capture.set("template", template.deepCopy());
        capture.put("strategyRevision", row.getRevision());
        // Capture the full current definition; a checkpoint selection alone may predate this run.
        capture.set("definition", definition(row).deepCopy());
        StrategyChecklistExecution saved =
                executions.save(
                        StrategyChecklistExecution.builder()
                                .id(UUID.randomUUID())
                                .strategy(row)
                                .user(row.getUser())
                                .strategyVersionId(request.versionId())
                                .snapshotJson(capture)
                                .answersJson(mapper.valueToTree(request.answers()))
                                .createdAt(OffsetDateTime.now())
                                .build());
        return executionResponse(saved);
    }

    @Transactional(readOnly = true)
    public EvidenceResponse evidence(UUID id) {
        UserStrategy row = owned(id, false);
        List<BacktestingTradeResponse> selected = new ArrayList<>();
        List<WorkspaceLink> linked = new ArrayList<>();
        for (BacktestingWorkspace workspace : workspaces.findForStudio(row.getUser().getId(), id)) {
            List<BacktestingTradeResponse> rows =
                    research.listTrades(workspace.getId()).stream()
                            .filter(
                                    t ->
                                            t.getTradeScope() != BacktestingTradeScope.LIVE
                                                    && t.getSource() != BacktestingTradeSource.LIVE)
                            .filter(
                                    t ->
                                            id.equals(t.getStrategyId())
                                                            && (t.getStrategySource() == null
                                                                    || "MY"
                                                                            .equals(
                                                                                    t
                                                                                            .getStrategySource()))
                                                    || t.getStrategyId() == null
                                                            && workspace.getStrategy() != null
                                                            && id.equals(
                                                                    workspace
                                                                            .getStrategy()
                                                                            .getId()))
                            .filter(t -> t.isIncludedInAnalytics())
                            .toList();
            if (!rows.isEmpty()
                    || workspace.getStrategy() != null
                            && id.equals(workspace.getStrategy().getId())) {
                linked.add(
                        new WorkspaceLink(
                                workspace.getId(), workspace.getTitle(), workspace.getSymbol()));
                selected.addAll(rows);
            }
        }
        return new EvidenceResponse(selected, linked);
    }

    @Transactional
    public void linkTrades(UUID id, TradeLinkRequest request) {
        UserStrategy row = owned(id, false);
        require(
                request.tradeIds() != null
                        && !request.tradeIds().isEmpty()
                        && request.tradeIds().size() <= 500,
                "Select 1 to 500 research trades");
        if (request.versionId() != null) ownedVersion(row, request.versionId());
        require(
                request.sample() == null
                        || Set.of("IN_SAMPLE", "OUT_OF_SAMPLE").contains(request.sample()),
                "Invalid research sample");
        Set<UUID> ids = new HashSet<>(request.tradeIds());
        List<BacktestingTrade> selected = trades.findAllById(ids);
        require(
                selected.size() == ids.size()
                        && selected.stream()
                                .allMatch(
                                        t ->
                                                t.getUser().getId().equals(row.getUser().getId())
                                                        && t.getTradeScope()
                                                                != BacktestingTradeScope.LIVE
                                                        && t.getSource()
                                                                != BacktestingTradeSource.LIVE),
                "Research trade not found or not owned");
        for (BacktestingTrade trade : selected) {
            trade.setStrategyId(id);
            trade.setStrategySource("MY");
            trade.setStrategyNameSnapshot(row.getName());
            trade.setStrategyVersionId(request.versionId());
            trade.setResearchSample(request.sample());
        }
        trades.saveAll(selected);
    }

    private UserStrategy owned(UUID id, boolean lock) {
        UUID userId = currentUser.getCurrentUser().getId();
        return (lock ? strategies.lockOwned(id, userId) : strategies.findByIdAndUser_Id(id, userId))
                .orElseThrow(() -> new EntityNotFoundException("Strategy not found"));
    }

    private StrategyVersion ownedVersion(UserStrategy row, UUID versionId) {
        return versions.findByIdAndUser_Id(versionId, row.getUser().getId())
                .filter(v -> v.getStrategy().getId().equals(row.getId()))
                .orElseThrow(() -> new EntityNotFoundException("Strategy version not found"));
    }

    private void revision(UserStrategy row, Long expected) {
        if (expected == null || !expected.equals(row.getRevision()))
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Strategy changed in another tab. Your draft is retained; reload the server"
                            + " copy before merging.");
    }

    private JsonNode definition(UserStrategy row) {
        ObjectNode definition =
                (row.getStudioJson() == null || row.getStudioJson().isNull())
                        ? validator.empty()
                        : row.getStudioJson().deepCopy();
        ObjectNode metadata = (ObjectNode) definition.path("metadata");
        if (row.isArchived()) metadata.put("status", "Archived");
        else if (metadata.path("status").asText().equals("Archived"))
            metadata.put("status", "Draft");
        return definition;
    }

    private StudioResponse response(UserStrategy row) {
        return new StudioResponse(
                strategyService.toMyResponse(row, assets.listByStrategy(row.getId())),
                definition(row),
                row.getRevision());
    }

    private StrategyVersion checkpoint(UserStrategy row, String name, String description) {
        StrategyVersion v = strategyService.createStrategyVersion(row, row.getUser());
        v.setName(name);
        v.setChangeDescription(description);
        return versions.save(v);
    }

    private VersionSummary summary(StrategyVersion v) {
        return new VersionSummary(
                v.getId(),
                v.getVersionNumber(),
                v.getName(),
                v.getChangeDescription(),
                v.getCreatedAt());
    }

    private ExecutionResponse executionResponse(StrategyChecklistExecution e) {
        return new ExecutionResponse(
                e.getId(),
                e.getStrategyVersionId(),
                e.getSnapshotJson().path("template"),
                e.getAnswersJson(),
                e.getCreatedAt());
    }

    private JsonNode snapshot(UserStrategy row) {
        ObjectNode s =
                mapper.valueToTree(
                        strategyService.toMyResponse(row, assets.listByStrategy(row.getId())));
        s.put("entryConditionsJson", row.getEntryConditionsJson());
        s.put("sessionSuitabilityJson", row.getSessionSuitabilityJson());
        s.put("tagsJson", row.getTagsJson());
        s.set(
                "assetIds",
                mapper.valueToTree(
                        assets.listByStrategy(row.getId()).stream().map(a -> a.getId()).toList()));
        return s;
    }

    private StrategyRequest fromSnapshot(JsonNode s) {
        StrategyRequest r = new StrategyRequest();
        r.setName(s.path("name").asText());
        r.setModel(s.path("model").asText());
        r.setEntryConditionsRich(s.path("entryConditionsRich").asText("<p></p>"));
        r.setInvalidationLogic(s.path("invalidationLogic").asText());
        r.setTpFramework(s.path("tpFramework").asText());
        r.setNoTradeRules(s.path("noTradeRules").asText(null));
        r.setEntryConditions(readList(s, "entryConditionsJson", "entryConditions"));
        r.setSessionSuitability(readList(s, "sessionSuitabilityJson", "sessionSuitability"));
        r.setTags(readList(s, "tagsJson", "tags"));
        r.setArchived(s.path("archived").asBoolean(false));
        if (s.hasNonNull("snapshotAssetId"))
            r.setSnapshotAssetId(UUID.fromString(s.path("snapshotAssetId").asText()));
        if (s.has("assetIds"))
            r.setAssetIds(
                    mapper.convertValue(s.path("assetIds"), new TypeReference<List<UUID>>() {}));
        return r;
    }

    private List<String> readList(JsonNode s, String old, String current) {
        try {
            return s.hasNonNull(old)
                    ? mapper.readValue(s.path(old).asText(), new TypeReference<List<String>>() {})
                    : mapper.convertValue(s.path(current), new TypeReference<List<String>>() {});
        } catch (Exception ex) {
            return List.of();
        }
    }

    private void validateRelationships(JsonNode doc, UserStrategy row) {
        Set<UUID> linked =
                new HashSet<>(
                        assets.listByStrategy(row.getId()).stream()
                                .filter(a -> a.isImage())
                                .map(a -> a.getId())
                                .toList());
        for (String collection : List.of("notebook", "evidence"))
            for (JsonNode item : doc.path(collection)) {
                if (item.hasNonNull("assetId"))
                    require(
                            linked.contains(UUID.fromString(item.path("assetId").asText())),
                            "Image is not linked to this strategy; upload or attach it first");
                if (item.hasNonNull("workspaceId"))
                    require(
                            workspaces
                                    .findByIdAndUser_Id(
                                            UUID.fromString(item.path("workspaceId").asText()),
                                            row.getUser().getId())
                                    .isPresent(),
                            "Backtest workspace not found");
            }
    }

    private void validateBase(StrategyRequest r) {
        require(
                r != null
                        && r.getName() != null
                        && !r.getName().isBlank()
                        && r.getName().length() <= 120,
                "Strategy name is required (120 characters maximum)");
        require(
                r.getModel() != null && !r.getModel().isBlank() && r.getModel().length() <= 255,
                "Strategy model is required (255 characters maximum)");
        require(
                r.getInvalidationLogic() != null
                        && !r.getInvalidationLogic().isBlank()
                        && r.getInvalidationLogic().length() <= 200000,
                "Invalidation is required");
        require(
                r.getTpFramework() != null
                        && !r.getTpFramework().isBlank()
                        && r.getTpFramework().length() <= 200000,
                "Exit framework is required");
        require(
                r.getEntryConditionsRich() == null || r.getEntryConditionsRich().length() <= 200000,
                "Entry content is too large");
        require(
                r.getNoTradeRules() == null || r.getNoTradeRules().length() <= 200000,
                "No-trade content is too large");
        for (List<String> list :
                List.of(
                        r.getTags() == null ? List.<String>of() : r.getTags(),
                        r.getSessionSuitability() == null
                                ? List.<String>of()
                                : r.getSessionSuitability()))
            require(
                    list.size() <= 100
                            && list.stream().allMatch(t -> t != null && t.length() <= 180),
                    "Invalid strategy tags or sessions");
        require(
                r.getEntryConditions() == null
                        || r.getEntryConditions().size() <= 500
                                && r.getEntryConditions().stream()
                                        .allMatch(item -> item != null && item.length() <= 4000),
                "Entry conditions exceed the allowed size");
        require(
                r.getAssetIds() == null || r.getAssetIds().size() <= 500,
                "Too many strategy attachments");
        r.setInvalidationLogic(StudioDefinitionValidator.cleanHtml(r.getInvalidationLogic()));
        r.setTpFramework(StudioDefinitionValidator.cleanHtml(r.getTpFramework()));
        if (r.getNoTradeRules() != null)
            r.setNoTradeRules(StudioDefinitionValidator.cleanHtml(r.getNoTradeRules()));
    }
}
