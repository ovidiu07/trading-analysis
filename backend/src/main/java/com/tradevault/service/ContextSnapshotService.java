package com.tradevault.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.ContextSnapshot;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.ContextSnapshotMode;
import com.tradevault.repository.ChecklistTemplateVersionRepository;
import com.tradevault.repository.ContextSnapshotRepository;
import com.tradevault.repository.StrategyVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ContextSnapshotService {
    private final ContextSnapshotRepository contextSnapshotRepository;
    private final StrategyVersionRepository strategyVersionRepository;
    private final ChecklistTemplateVersionRepository checklistTemplateVersionRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public ContextSnapshot createSnapshot(User user,
                                          ContextSnapshotMode mode,
                                          UUID strategyId,
                                          UUID prereqsTemplateId,
                                          String prereqsStateJson,
                                          UUID triggersTemplateId,
                                          String triggersStateJson,
                                          UUID selectedSweepLevelId,
                                          JsonNode levelsSnapshot,
                                          JsonNode lockInSnapshot,
                                          BigDecimal rrAtEntry,
                                          JsonNode qualityInputs) {
        JsonNode prereqsStates = parseJsonArrayOrFallback(prereqsStateJson);
        JsonNode triggersStates = parseJsonArrayOrFallback(triggersStateJson);

        UUID strategyVersionId = strategyId == null
                ? null
                : strategyVersionRepository.findFirstByStrategy_IdOrderByVersionNumberDesc(strategyId)
                .map(item -> item.getId())
                .orElse(null);

        UUID prereqsTemplateVersionId = prereqsTemplateId == null
                ? null
                : checklistTemplateVersionRepository.findFirstByTemplate_IdOrderByVersionNumberDesc(prereqsTemplateId)
                .map(item -> item.getId())
                .orElse(null);

        UUID triggersTemplateVersionId = triggersTemplateId == null
                ? null
                : checklistTemplateVersionRepository.findFirstByTemplate_IdOrderByVersionNumberDesc(triggersTemplateId)
                .map(item -> item.getId())
                .orElse(null);

        ContextSnapshot snapshot = ContextSnapshot.builder()
                .user(user)
                .mode(mode)
                .strategyId(strategyId)
                .strategyVersionId(strategyVersionId)
                .prereqsTemplateId(prereqsTemplateId)
                .prereqsTemplateVersionId(prereqsTemplateVersionId)
                .prereqsStatesJson(prereqsStates)
                .triggersTemplateId(triggersTemplateId)
                .triggersTemplateVersionId(triggersTemplateVersionId)
                .triggersStatesJson(triggersStates)
                .selectedSweepLevelId(selectedSweepLevelId)
                .levelsSnapshotJson(normalizeObjectOrArray(levelsSnapshot, true))
                .lockInSnapshotJson(normalizeObjectOrArray(lockInSnapshot, false))
                .rrAtEntry(rrAtEntry)
                .qualityScoreInputsJson(normalizeObjectOrArray(qualityInputs, false))
                .build();
        return contextSnapshotRepository.save(snapshot);
    }

    private JsonNode normalizeObjectOrArray(JsonNode value, boolean preferArray) {
        if (value == null || value.isNull()) {
            return preferArray ? objectMapper.createArrayNode() : objectMapper.createObjectNode();
        }
        return value;
    }

    private JsonNode parseJsonArrayOrFallback(String rawJson) {
        if (rawJson == null || rawJson.isBlank()) {
            return objectMapper.createArrayNode();
        }
        try {
            JsonNode parsed = objectMapper.readTree(rawJson);
            return parsed == null || parsed.isNull() ? objectMapper.createArrayNode() : parsed;
        } catch (Exception ex) {
            return objectMapper.createArrayNode();
        }
    }
}
