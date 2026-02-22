package com.tradevault.service.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.BacktestDataset;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;
import com.tradevault.dto.backtest.BacktestDatasetResponse;
import com.tradevault.exception.BacktestDomainException;
import com.tradevault.exception.BacktestErrorCodes;
import com.tradevault.repository.BacktestDatasetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
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
        String normalizedSourceId = normalizeSourceId(sourceId);
        BacktestDataset dataset = backtestDatasetRepository
                .findFirstByUser_IdAndProviderAndSourceIdOrderByCreatedAtDesc(user.getId(), source, normalizedSourceId)
                .filter(item -> item.getTimeframe() == timeframe && item.getSymbolCanonical().equalsIgnoreCase(symbolCanonical))
                .orElseGet(() -> BacktestDataset.builder()
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

        JsonNode metadata = objectMapper.createObjectNode()
                .putPOJO("warnings", warnings == null ? List.of() : warnings);
        dataset.setMetadataJson(metadata);

        return backtestDatasetRepository.save(dataset);
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
                .warnings(readWarnings(dataset.getMetadataJson()))
                .build();
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
        return sourceId.trim().toUpperCase(Locale.ROOT);
    }
}
