package com.tradevault.service.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.domain.entity.BacktestDataset;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;
import com.tradevault.dto.backtest.BacktestDatasetResponse;
import com.tradevault.dto.backtest.BacktestDatasetSummaryResponse;
import com.tradevault.exception.BacktestDomainException;
import com.tradevault.exception.BacktestErrorCodes;
import com.tradevault.repository.BacktestDatasetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BacktestDatasetService {
    private final BacktestDatasetRepository backtestDatasetRepository;
    private final CandleChunkStoreService candleChunkStoreService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<BacktestDatasetResponse> listDatasets(UUID userId) {
        return backtestDatasetRepository.findByUser_IdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public BacktestDataset requireDataset(UUID userId, UUID datasetId) {
        return backtestDatasetRepository.findByIdAndUser_Id(datasetId, userId)
                .orElseThrow(() -> new BacktestDomainException(
                        BacktestErrorCodes.DATASET_NOT_FOUND,
                        "Backtest dataset not found",
                        "Choose another dataset or ingest a new one first.",
                        HttpStatus.NOT_FOUND
                ));
    }

    @Transactional(readOnly = true)
    public BacktestDatasetResponse getDataset(UUID userId, UUID datasetId) {
        return toResponse(requireDataset(userId, datasetId));
    }

    @Transactional
    public BacktestDataset upsertDataset(User user,
                                         BacktestCandleSource source,
                                         String sourceId,
                                         String name,
                                         String symbolCanonical,
                                         String symbolDisplay,
                                         BacktestTimeframe timeframe,
                                         OffsetDateTime from,
                                         OffsetDateTime to,
                                         int rowCount,
                                         List<String> warnings) {
        return upsertDataset(
                user,
                source,
                sourceId,
                name,
                symbolCanonical,
                symbolDisplay,
                timeframe,
                from,
                to,
                rowCount,
                warnings,
                null,
                null
        );
    }

    @Transactional
    public BacktestDataset upsertDataset(User user,
                                         BacktestCandleSource source,
                                         String sourceId,
                                         String name,
                                         String symbolCanonical,
                                         String symbolDisplay,
                                         BacktestTimeframe timeframe,
                                         OffsetDateTime from,
                                         OffsetDateTime to,
                                         int rowCount,
                                         List<String> warnings,
                                         UUID preferredDatasetId) {
        return upsertDataset(
                user,
                source,
                sourceId,
                name,
                symbolCanonical,
                symbolDisplay,
                timeframe,
                from,
                to,
                rowCount,
                warnings,
                preferredDatasetId,
                null
        );
    }

    @Transactional
    public BacktestDataset upsertDataset(User user,
                                         BacktestCandleSource source,
                                         String sourceId,
                                         String name,
                                         String symbolCanonical,
                                         String symbolDisplay,
                                         BacktestTimeframe timeframe,
                                         OffsetDateTime from,
                                         OffsetDateTime to,
                                         int rowCount,
                                         List<String> warnings,
                                         UUID preferredDatasetId,
                                         JsonNode metadata) {
        String normalizedSourceId = normalizeSourceId(sourceId);
        BacktestDataset dataset = backtestDatasetRepository
                .findFirstByUser_IdAndProviderAndSourceIdOrderByCreatedAtDesc(user.getId(), source, normalizedSourceId)
                .filter(item -> item.getTimeframe() == timeframe && item.getSymbolCanonical().equalsIgnoreCase(symbolCanonical))
                .orElseGet(() -> BacktestDataset.builder()
                        .id(preferredDatasetId)
                        .user(user)
                        .provider(source)
                        .sourceId(normalizedSourceId)
                        .build());

        dataset.setName(normalizeDatasetName(name, source, symbolDisplay, timeframe));
        dataset.setSymbolCanonical(symbolCanonical);
        dataset.setSymbolDisplay(symbolDisplay);
        dataset.setTimeframe(timeframe);
        dataset.setDataFrom(from);
        dataset.setDataTo(to);
        dataset.setRowCount(rowCount);
        dataset.setMetadataJson(mergeMetadata(metadata, warnings));

        return backtestDatasetRepository.save(dataset);
    }

    @Transactional(readOnly = true)
    public BacktestDatasetSummaryResponse getDatasetSummary(UUID userId, UUID datasetId) {
        BacktestDataset dataset = requireDataset(userId, datasetId);
        BacktestTimeframe timeframe = dataset.getTimeframe() == null ? BacktestTimeframe.M1 : dataset.getTimeframe();
        CandleChunkStoreService.SourceCoverage coverage = candleChunkStoreService.summarizeSource(
                userId,
                dataset.getProvider(),
                dataset.getSourceId(),
                dataset.getSymbolCanonical(),
                timeframe
        );

        OffsetDateTime dataFrom = dataset.getDataFrom() != null ? dataset.getDataFrom() : coverage.dataFromUtc();
        OffsetDateTime dataTo = dataset.getDataTo() != null ? dataset.getDataTo() : coverage.dataToUtc();
        BacktestRangeResolver.EffectiveRange defaultRange = BacktestRangeResolver.resolveDatasetRange(
                dataset.getProvider(),
                timeframe,
                dataFrom,
                dataTo,
                null,
                null,
                OffsetDateTime.now(ZoneOffset.UTC)
        );

        long count = dataset.getRowCount() == null || dataset.getRowCount() <= 0
                ? coverage.candleCount()
                : dataset.getRowCount();
        List<String> warnings = readWarnings(dataset.getMetadataJson());

        return BacktestDatasetSummaryResponse.builder()
                .datasetId(dataset.getId())
                .provider(dataset.getProvider().name())
                .symbolDisplay(dataset.getSymbolDisplay())
                .symbolCanonical(dataset.getSymbolCanonical())
                .timeframe(timeframe.name())
                .dataFromUtc(dataFrom)
                .dataToUtc(dataTo)
                .candleCount(count)
                .timezoneHint(readTimezoneHint(dataset.getMetadataJson()))
                .defaultFromUtc(defaultRange.fromUtc())
                .defaultToUtc(defaultRange.toUtc())
                .recommendedDefaultFromUtc(defaultRange.fromUtc())
                .recommendedDefaultToUtc(defaultRange.toUtc())
                .defaultWindowDays(BacktestRangeResolver.defaultWindowDays(timeframe))
                .warnings(warnings)
                .build();
    }

    @Transactional
    public void deleteDataset(UUID userId, UUID datasetId) {
        BacktestDataset dataset = requireDataset(userId, datasetId);
        candleChunkStoreService.deleteSource(userId, dataset.getProvider(), dataset.getSourceId());
        backtestDatasetRepository.delete(dataset);
    }

    public BacktestDatasetResponse toResponse(BacktestDataset dataset) {
        return BacktestDatasetResponse.builder()
                .id(dataset.getId())
                .provider(dataset.getProvider().name())
                .sourceId(dataset.getSourceId())
                .name(dataset.getName())
                .symbolCanonical(dataset.getSymbolCanonical())
                .symbolDisplay(dataset.getSymbolDisplay())
                .timeframe(dataset.getTimeframe().name())
                .dataFrom(dataset.getDataFrom())
                .dataTo(dataset.getDataTo())
                .rowCount(dataset.getRowCount() == null ? 0 : dataset.getRowCount())
                .originalFileName(readOriginalFileName(dataset.getMetadataJson()))
                .detectedMappingJson(readDetectedMapping(dataset.getMetadataJson()))
                .createdAt(dataset.getCreatedAt())
                .warnings(readWarnings(dataset.getMetadataJson()))
                .build();
    }

    private JsonNode mergeMetadata(JsonNode metadata, List<String> warnings) {
        ObjectNode node = objectMapper.createObjectNode();
        if (metadata != null && metadata.isObject()) {
            node.setAll((ObjectNode) metadata);
        }
        node.putPOJO("warnings", warnings == null ? List.of() : warnings);
        return node;
    }

    private List<String> readWarnings(JsonNode metadata) {
        if (metadata == null || metadata.isNull()) {
            return List.of();
        }
        JsonNode warnings = metadata.get("warnings");
        if (warnings == null || !warnings.isArray()) {
            return List.of();
        }
        List<String> rows = new ArrayList<>();
        for (JsonNode item : warnings) {
            if (item != null && item.isTextual() && !item.asText().isBlank()) {
                rows.add(item.asText());
            }
        }
        return rows;
    }

    private String readTimezoneHint(JsonNode metadata) {
        if (metadata == null || metadata.isNull()) {
            return "UTC";
        }
        JsonNode timezoneHint = metadata.get("timezoneHint");
        if (timezoneHint != null && timezoneHint.isTextual() && !timezoneHint.asText().isBlank()) {
            return timezoneHint.asText();
        }
        JsonNode timezone = metadata.get("timezone");
        if (timezone != null && timezone.isTextual() && !timezone.asText().isBlank()) {
            return timezone.asText();
        }
        return "UTC";
    }

    private String readOriginalFileName(JsonNode metadata) {
        if (metadata == null || metadata.isNull()) {
            return null;
        }
        JsonNode fileName = metadata.get("originalFileName");
        if (fileName == null || !fileName.isTextual() || fileName.asText().isBlank()) {
            return null;
        }
        return fileName.asText();
    }

    private JsonNode readDetectedMapping(JsonNode metadata) {
        if (metadata == null || metadata.isNull()) {
            return null;
        }
        JsonNode detected = metadata.get("detectedMappingJson");
        if (detected == null || detected.isNull()) {
            return null;
        }
        return detected;
    }

    private String normalizeDatasetName(String requested,
                                        BacktestCandleSource source,
                                        String symbolDisplay,
                                        BacktestTimeframe timeframe) {
        if (requested != null && !requested.isBlank()) {
            return requested.trim();
        }
        return "%s %s (%s)".formatted(source.name(), symbolDisplay, timeframe.name());
    }

    private String normalizeSourceId(String sourceId) {
        if (sourceId == null || sourceId.isBlank()) {
            return UUID.randomUUID().toString();
        }
        return sourceId.trim();
    }
}
