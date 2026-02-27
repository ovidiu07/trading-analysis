package com.tradevault.service.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.domain.entity.BacktestDataset;
import com.tradevault.domain.entity.BacktestDatasetSet;
import com.tradevault.domain.entity.BacktestOptimizerRun;
import com.tradevault.domain.entity.BacktestRun;
import com.tradevault.domain.entity.BacktestRunReport;
import com.tradevault.domain.entity.BacktestSetup;
import com.tradevault.domain.entity.BacktestStrategyConfig;
import com.tradevault.domain.entity.BacktestTrade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.BacktestExitReason;
import com.tradevault.domain.enums.BacktestOrderType;
import com.tradevault.domain.enums.BacktestRunStatus;
import com.tradevault.domain.enums.BacktestTimeframe;
import com.tradevault.domain.enums.Direction;
import com.tradevault.dto.backtest.BacktestDatasetFileResponse;
import com.tradevault.dto.backtest.BacktestDatasetSetCreateRequest;
import com.tradevault.dto.backtest.BacktestDatasetSetDatasetsResponse;
import com.tradevault.dto.backtest.BacktestDatasetSetResponse;
import com.tradevault.dto.backtest.BacktestDatasetValidationIssueResponse;
import com.tradevault.dto.backtest.BacktestLabRunRequest;
import com.tradevault.dto.backtest.BacktestLabRunResponse;
import com.tradevault.dto.backtest.BacktestLabRunResultsResponse;
import com.tradevault.dto.backtest.BacktestLabSummaryResponse;
import com.tradevault.dto.backtest.BacktestLabTimelineEventResponse;
import com.tradevault.dto.backtest.BacktestLabTradeResultResponse;
import com.tradevault.dto.backtest.BacktestOptimizerGridRequest;
import com.tradevault.dto.backtest.BacktestOptimizerRunRequest;
import com.tradevault.dto.backtest.BacktestOptimizerRunResponse;
import com.tradevault.dto.backtest.BacktestOptimizerVariantResultResponse;
import com.tradevault.dto.backtest.BacktestRunReportResponse;
import com.tradevault.dto.backtest.BacktestSessionPreviewResponse;
import com.tradevault.dto.backtest.BacktestStrategyConfigResponse;
import com.tradevault.dto.backtest.BacktestStrategyConfigUpsertRequest;
import com.tradevault.dto.backtest.CsvIngestRequest;
import com.tradevault.dto.backtest.CsvUploadResponse;
import com.tradevault.repository.BacktestDatasetRepository;
import com.tradevault.repository.BacktestDatasetSetRepository;
import com.tradevault.repository.BacktestOptimizerRunRepository;
import com.tradevault.repository.BacktestRunReportRepository;
import com.tradevault.repository.BacktestRunRepository;
import com.tradevault.repository.BacktestSetupRepository;
import com.tradevault.repository.BacktestStrategyConfigRepository;
import com.tradevault.repository.BacktestTradeRepository;
import com.tradevault.service.CurrentUserService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

@Service
@RequiredArgsConstructor
@Slf4j
public class BacktestLabService {
    private static final String STRATEGY_DEFAULT_NAME = "SMC Rule Strategy";

    private final CurrentUserService currentUserService;
    private final BacktestDatasetSetRepository datasetSetRepository;
    private final BacktestDatasetRepository datasetRepository;
    private final BacktestStrategyConfigRepository strategyConfigRepository;
    private final BacktestRunRepository runRepository;
    private final BacktestSetupRepository setupRepository;
    private final BacktestTradeRepository tradeRepository;
    private final BacktestRunReportRepository reportRepository;
    private final BacktestOptimizerRunRepository optimizerRunRepository;
    private final BacktestCsvService backtestCsvService;
    private final CandleDataService candleDataService;
    private final ObjectMapper objectMapper;

    @Value("${backtest.lab.min-required-candles:30}")
    private int minRequiredCandles;

    @Transactional
    public BacktestDatasetSetResponse createDatasetSet(BacktestDatasetSetCreateRequest request) {
        User user = currentUserService.getCurrentUser();
        String instrument = normalizeInstrument(request == null ? null : request.getInstrument());
        String timezone = normalizeTimezoneBasis(request == null ? null : request.getTimezoneBasis());

        BacktestDatasetSet set = BacktestDatasetSet.builder()
                .user(user)
                .instrument(instrument)
                .timezoneBasis(timezone)
                .build();
        BacktestDatasetSet saved = datasetSetRepository.save(set);
        return toDatasetSetResponse(saved);
    }

    @Transactional
    public BacktestDatasetFileResponse uploadCsv(UUID datasetSetId, MultipartFile file) {
        User user = currentUserService.getCurrentUser();
        BacktestDatasetSet set = requireDatasetSet(datasetSetId, user.getId());

        CsvUploadResponse upload = backtestCsvService.upload(user, file);

        CsvIngestRequest ingestRequest = new CsvIngestRequest();
        if (upload.getSuggestedMapping() != null) {
            ingestRequest.setMapping(upload.getSuggestedMapping());
        }
        ingestRequest.setTimezone(set.getTimezoneBasis());
        ingestRequest.setDatasetName(file == null ? null : file.getOriginalFilename());
        if (set.getInstrument() != null && !set.getInstrument().equals("UNKNOWN")) {
            ingestRequest.setSymbol(set.getInstrument());
        }

        var ingest = backtestCsvService.ingest(user, upload.getFileId(), ingestRequest);
        UUID datasetId = ingest.getDataset().getId();
        BacktestDataset dataset = datasetRepository.findById(datasetId)
                .orElseThrow(() -> new EntityNotFoundException("Dataset not found after ingest"));
        List<BacktestCandle> persistedCandles = candleDataService.getCandles(
                user.getId(),
                dataset.getProvider().name(),
                dataset.getSourceId(),
                dataset.getSymbolDisplay(),
                dataset.getTimeframe().name(),
                dataset.getDataFrom(),
                dataset.getDataTo(),
                false
        );
        OffsetDateTime persistedMinUtc = persistedCandles.isEmpty() ? dataset.getDataFrom() : persistedCandles.get(0).timestamp();
        OffsetDateTime persistedMaxUtc = persistedCandles.isEmpty()
                ? dataset.getDataTo()
                : persistedCandles.get(persistedCandles.size() - 1).timestamp();

        dataset.setDatasetSet(set);
        dataset.setOriginalFilename(file == null ? dataset.getName() : file.getOriginalFilename());
        dataset.setMinTimeUtc(persistedMinUtc);
        dataset.setMaxTimeUtc(persistedMaxUtc);
        dataset.setCandleCount(persistedCandles.size());
        dataset.setParsedOk(!persistedCandles.isEmpty());
        dataset.setErrorMsg(persistedCandles.isEmpty() ? "No persisted candles found after ingest." : null);
        datasetRepository.save(dataset);

        if ("UNKNOWN".equals(set.getInstrument())) {
            String detected = detectInstrumentFromFileName(dataset.getOriginalFilename());
            if (detected != null) {
                set.setInstrument(detected);
                datasetSetRepository.save(set);
            }
        }

        return toDatasetFileResponse(dataset);
    }

    @Transactional(readOnly = true)
    public BacktestDatasetSetDatasetsResponse listDatasets(UUID datasetSetId) {
        User user = currentUserService.getCurrentUser();
        BacktestDatasetSet set = requireDatasetSet(datasetSetId, user.getId());
        List<BacktestDataset> datasets = datasetRepository.findByDatasetSet_IdOrderByCreatedAtAsc(datasetSetId);

        return BacktestDatasetSetDatasetsResponse.builder()
                .datasetSetId(set.getId())
                .instrument(set.getInstrument())
                .timezoneBasis(set.getTimezoneBasis())
                .datasets(datasets.stream().map(this::toDatasetFileResponse).toList())
                .sessionPreview(buildSessionPreview(set, datasets))
                .build();
    }

    @Transactional
    public BacktestStrategyConfigResponse saveStrategyConfig(UUID datasetSetId, BacktestStrategyConfigUpsertRequest request) {
        User user = currentUserService.getCurrentUser();
        BacktestDatasetSet set = requireDatasetSet(datasetSetId, user.getId());
        String name = normalizeName(request == null ? null : request.getName(), STRATEGY_DEFAULT_NAME);

        BacktestStrategyConfig config = BacktestStrategyConfig.builder()
                .datasetSet(set)
                .name(name)
                .configJson(request == null || request.getConfigJson() == null
                        ? defaultStrategyConfigNode(set)
                        : request.getConfigJson())
                .build();
        BacktestStrategyConfig saved = strategyConfigRepository.save(config);
        return toStrategyResponse(saved);
    }

    @Transactional(readOnly = true)
    public BacktestStrategyConfigResponse getStrategyConfig(UUID strategyConfigId) {
        User user = currentUserService.getCurrentUser();
        BacktestStrategyConfig config = strategyConfigRepository.findByIdAndDatasetSet_User_Id(strategyConfigId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Backtest strategy config not found"));
        return toStrategyResponse(config);
    }

    @Transactional
    public BacktestLabRunResponse run(UUID datasetSetId, BacktestLabRunRequest request) {
        User user = currentUserService.getCurrentUser();
        BacktestDatasetSet set = requireDatasetSet(datasetSetId, user.getId());
        BacktestStrategyConfig strategyConfig = resolveStrategyConfig(set, user.getId(), request == null ? null : request.getStrategyConfigId());
        ParsedConfig parsedConfig = parseConfig(strategyConfig, set);

        RangeResolution range = resolveRunRange(
                set,
                request == null ? null : request.getFromUtc(),
                request == null ? null : request.getToUtc(),
                parsedConfig.executionTimeframeRequested()
        );

        BacktestRun run = BacktestRun.builder()
                .user(user)
                .symbol(set.getInstrument())
                .timeframe(parsedConfig.executionTimeframeRequested().name())
                .rangeFrom(range.effectiveFromUtc())
                .rangeTo(range.effectiveToUtc())
                .sessionWindow(normalizeOptionalText(request == null ? null : request.getSessionFilter()))
                .provider("CSV")
                .sourceId(set.getId().toString())
                .datasetSet(set)
                .strategyConfig(strategyConfig)
                .fromUtc(range.effectiveFromUtc())
                .toUtc(range.effectiveToUtc())
                .status(BacktestRunStatus.RUNNING)
                .candleCount(0)
                .build();
        run = runRepository.save(run);

        try {
            EngineOutput output = executeRunEngine(run, set, parsedConfig, request, range);
            RunDiagnostics diagnostics = output.diagnostics();
            if (diagnostics != null) {
                run.setFromUtc(diagnostics.effectiveFromUtc());
                run.setToUtc(diagnostics.effectiveToUtc());
                run.setRangeFrom(diagnostics.effectiveFromUtc());
                run.setRangeTo(diagnostics.effectiveToUtc());
            }

            run.setTimeframe(output.executionTimeframe().name());
            run.setDatasetId(output.sourceDataset().getId());
            run.setSourceId(output.sourceDataset().getSourceId());
            run.setCandleCount(output.candles().size());
            run.setStatus(BacktestRunStatus.COMPLETED);
            run.setCompletedAt(OffsetDateTime.now(ZoneOffset.UTC));
            run.setErrorMsg(null);
            runRepository.save(run);

            persistRunArtifacts(run, output.trades());

            boolean autoGenerateReport = request == null || request.getAutoGenerateReport() == null || request.getAutoGenerateReport();
            if (autoGenerateReport) {
                generateAndPersistReport(run, strategyConfig, output);
            }

            return toRunResponse(run, diagnostics);
        } catch (Exception ex) {
            RunDiagnostics diagnostics = ex instanceof BacktestRunDiagnosticsException withDiagnostics
                    ? withDiagnostics.diagnostics()
                    : diagnosticsFromRange(range, 0, minRequiredCandles());
            if (diagnostics != null) {
                run.setFromUtc(diagnostics.effectiveFromUtc());
                run.setToUtc(diagnostics.effectiveToUtc());
                run.setRangeFrom(diagnostics.effectiveFromUtc());
                run.setRangeTo(diagnostics.effectiveToUtc());
            }
            run.setStatus(BacktestRunStatus.FAILED);
            run.setCompletedAt(OffsetDateTime.now(ZoneOffset.UTC));
            String failureMessage = ex.getMessage() == null || ex.getMessage().isBlank()
                    ? "Backtest run failed"
                    : ex.getMessage();
            run.setErrorMsg(truncate(failureMessage, 800));
            runRepository.save(run);
            if (!(ex instanceof BacktestRunDiagnosticsException)) {
                log.warn(
                        "Backtest lab run failed [runId={}, datasetSetId={}, timeframe={}]: {}",
                        run.getId(),
                        set.getId(),
                        run.getTimeframe(),
                        failureMessage
                );
            }
            return toRunResponse(run, diagnostics);
        }
    }

    @Transactional
    public BacktestOptimizerRunResponse runOptimizer(UUID datasetSetId, BacktestOptimizerRunRequest request) {
        User user = currentUserService.getCurrentUser();
        BacktestDatasetSet set = requireDatasetSet(datasetSetId, user.getId());
        BacktestStrategyConfig strategyConfig = resolveStrategyConfig(set, user.getId(), request == null ? null : request.getStrategyConfigId());
        ParsedConfig baseConfig = parseConfig(strategyConfig, set);

        int maxVariants = Math.max(1, Math.min(100, request != null && request.getMaxVariants() != null ? request.getMaxVariants() : 100));
        List<ObjectNode> generated = buildOptimizerVariants(request == null ? null : request.getGrid());
        boolean truncated = generated.size() > maxVariants;
        List<ObjectNode> variants = generated.size() > maxVariants ? generated.subList(0, maxVariants) : generated;

        RangeResolution range = resolveRunRange(
                set,
                request == null ? null : request.getFromUtc(),
                request == null ? null : request.getToUtc(),
                baseConfig.executionTimeframeRequested()
        );

        List<VariantMetrics> metrics = new ArrayList<>();
        AtomicInteger ordinal = new AtomicInteger(1);
        BacktestLabRunRequest shimRequest = new BacktestLabRunRequest();
        if (request != null) {
            shimRequest.setSessionFilter(request.getSessionFilter());
            shimRequest.setFromUtc(request.getFromUtc());
            shimRequest.setToUtc(request.getToUtc());
        }

        for (ObjectNode params : variants) {
            JsonNode variantJson = applyVariantToConfig(strategyConfig.getConfigJson(), params);
            BacktestStrategyConfig variantCfg = BacktestStrategyConfig.builder()
                    .datasetSet(set)
                    .name(strategyConfig.getName())
                    .configJson(variantJson)
                    .build();
            ParsedConfig parsed = parseConfig(variantCfg, set);
            BacktestRun transientRun = BacktestRun.builder()
                    .id(UUID.randomUUID())
                    .user(user)
                    .symbol(set.getInstrument())
                    .timeframe(parsed.executionTimeframeRequested().name())
                    .rangeFrom(range.effectiveFromUtc())
                    .rangeTo(range.effectiveToUtc())
                    .fromUtc(range.effectiveFromUtc())
                    .toUtc(range.effectiveToUtc())
                    .status(BacktestRunStatus.RUNNING)
                    .candleCount(0)
                    .build();

            EngineOutput out = executeRunEngine(transientRun, set, parsed, shimRequest, range);
            metrics.add(summarizeVariant(ordinal.getAndIncrement(), params, out.trades()));
        }

        List<VariantMetrics> ranked = metrics.stream()
                .sorted(Comparator
                        .comparing(VariantMetrics::expectancyR, Comparator.nullsLast(BigDecimal::compareTo)).reversed()
                        .thenComparing(VariantMetrics::profitFactor, Comparator.nullsLast(BigDecimal::compareTo)).reversed()
                        .thenComparing(VariantMetrics::winRate, Comparator.nullsLast(BigDecimal::compareTo)).reversed()
                        .thenComparing(VariantMetrics::sampleSize, Comparator.nullsLast(Integer::compareTo)).reversed()
                        .thenComparingInt(VariantMetrics::variantIndex))
                .toList();

        ArrayNode resultsJson = objectMapper.createArrayNode();
        List<BacktestOptimizerVariantResultResponse> responseRows = new ArrayList<>();
        for (int i = 0; i < ranked.size(); i++) {
            VariantMetrics row = ranked.get(i);
            int rank = i + 1;
            ObjectNode node = objectMapper.createObjectNode();
            node.put("rank", rank);
            node.put("variantIndex", row.variantIndex());
            node.set("params", row.params());
            node.put("trades", row.trades());
            node.put("sampleSize", row.sampleSize());
            putDecimal(node, "winRate", row.winRate());
            putDecimal(node, "profitFactor", row.profitFactor());
            putDecimal(node, "expectancyR", row.expectancyR());
            putDecimal(node, "avgR", row.avgR());
            putDecimal(node, "maxDdR", row.maxDdR());
            putDecimal(node, "fillRate", row.fillRate());
            putDecimal(node, "avgMaeR", row.avgMaeR());
            putDecimal(node, "avgMfeR", row.avgMfeR());
            putDecimal(node, "avgDurationSec", row.avgDurationSec());
            node.put("confidenceNote", row.confidenceNote());
            resultsJson.add(node);

            responseRows.add(BacktestOptimizerVariantResultResponse.builder()
                    .rank(rank)
                    .params(row.params())
                    .trades(row.trades())
                    .sampleSize(row.sampleSize())
                    .winRate(row.winRate())
                    .profitFactor(row.profitFactor())
                    .expectancyR(row.expectancyR())
                    .avgR(row.avgR())
                    .maxDdR(row.maxDdR())
                    .fillRate(row.fillRate())
                    .avgMaeR(row.avgMaeR())
                    .avgMfeR(row.avgMfeR())
                    .avgDurationSec(row.avgDurationSec())
                    .confidenceNote(row.confidenceNote())
                    .build());
        }

        ObjectNode summary = objectMapper.createObjectNode();
        summary.put("generatedVariants", generated.size());
        summary.put("executedVariants", responseRows.size());
        summary.put("truncated", truncated);
        summary.put("maxVariants", maxVariants);
        if (!responseRows.isEmpty()) {
            summary.set("bestParams", responseRows.get(0).getParams());
            putDecimal(summary, "bestExpectancyR", responseRows.get(0).getExpectancyR());
            putDecimal(summary, "bestProfitFactor", responseRows.get(0).getProfitFactor());
            putDecimal(summary, "bestWinRate", responseRows.get(0).getWinRate());
        }

        BacktestOptimizerRun saved = optimizerRunRepository.save(BacktestOptimizerRun.builder()
                .user(user)
                .datasetSet(set)
                .strategyConfig(strategyConfig)
                .requestJson(request == null ? objectMapper.createObjectNode() : objectMapper.valueToTree(request))
                .resultsJson(resultsJson)
                .summaryJson(summary)
                .variantCount(responseRows.size())
                .maxVariants(maxVariants)
                .status("COMPLETED")
                .build());

        return BacktestOptimizerRunResponse.builder()
                .optimizerRunId(saved.getId())
                .status(saved.getStatus())
                .variantCount(saved.getVariantCount())
                .maxVariants(saved.getMaxVariants())
                .truncated(truncated)
                .createdAtUtc(saved.getCreatedAtUtc())
                .summary(saved.getSummaryJson())
                .variants(responseRows)
                .build();
    }

    @Transactional(readOnly = true)
    public BacktestOptimizerRunResponse getOptimizerRun(UUID optimizerRunId) {
        User user = currentUserService.getCurrentUser();
        BacktestOptimizerRun run = optimizerRunRepository.findByIdAndUser_Id(optimizerRunId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Backtest optimizer run not found"));
        List<BacktestOptimizerVariantResultResponse> rows = new ArrayList<>();
        JsonNode results = run.getResultsJson();
        if (results != null && results.isArray()) {
            for (JsonNode item : results) {
                rows.add(BacktestOptimizerVariantResultResponse.builder()
                        .rank(item.path("rank").asInt(0))
                        .params(item.path("params"))
                        .trades(item.path("trades").isNumber() ? item.path("trades").asInt() : null)
                        .sampleSize(item.path("sampleSize").isNumber() ? item.path("sampleSize").asInt() : null)
                        .winRate(asDecimal(item, "winRate"))
                        .profitFactor(asDecimal(item, "profitFactor"))
                        .expectancyR(asDecimal(item, "expectancyR"))
                        .avgR(asDecimal(item, "avgR"))
                        .maxDdR(asDecimal(item, "maxDdR"))
                        .fillRate(asDecimal(item, "fillRate"))
                        .avgMaeR(asDecimal(item, "avgMaeR"))
                        .avgMfeR(asDecimal(item, "avgMfeR"))
                        .avgDurationSec(asDecimal(item, "avgDurationSec"))
                        .confidenceNote(text(item.path("confidenceNote"), null))
                        .build());
            }
        }
        boolean truncated = run.getSummaryJson() != null && run.getSummaryJson().path("truncated").asBoolean(false);
        return BacktestOptimizerRunResponse.builder()
                .optimizerRunId(run.getId())
                .status(run.getStatus())
                .variantCount(run.getVariantCount())
                .maxVariants(run.getMaxVariants())
                .truncated(truncated)
                .createdAtUtc(run.getCreatedAtUtc())
                .summary(run.getSummaryJson())
                .variants(rows)
                .build();
    }

    private List<ObjectNode> buildOptimizerVariants(BacktestOptimizerGridRequest grid) {
        List<Integer> mssCandles = grid != null && grid.getMssMinConfirmCandles() != null && !grid.getMssMinConfirmCandles().isEmpty()
                ? grid.getMssMinConfirmCandles()
                : List.of(2, 3, 4, 5);
        List<String> displacementTypes = grid != null && grid.getDisplacementType() != null && !grid.getDisplacementType().isEmpty()
                ? grid.getDisplacementType()
                : List.of("GAP_OPTIONAL", "GAP_REQUIRED", "NO_GAP_ONLY");
        List<Boolean> retraceRequired = grid != null && grid.getRetraceRequired() != null && !grid.getRetraceRequired().isEmpty()
                ? grid.getRetraceRequired()
                : List.of(true, false);
        List<BigDecimal> retraceMinPct = grid != null && grid.getRetraceMinPct() != null && !grid.getRetraceMinPct().isEmpty()
                ? grid.getRetraceMinPct()
                : List.of(BigDecimal.ZERO, BigDecimal.valueOf(50), BigDecimal.valueOf(62));
        List<BigDecimal> sweepDepth = grid != null && grid.getSweepMinDepthPips() != null && !grid.getSweepMinDepthPips().isEmpty()
                ? grid.getSweepMinDepthPips()
                : List.of(BigDecimal.valueOf(3), BigDecimal.valueOf(4), BigDecimal.valueOf(5), BigDecimal.valueOf(6));
        List<String> confirmationTf = grid != null && grid.getConfirmationTf() != null && !grid.getConfirmationTf().isEmpty()
                ? grid.getConfirmationTf()
                : List.of("M5", "M15");
        List<String> entryTf = grid != null && grid.getEntryTf() != null && !grid.getEntryTf().isEmpty()
                ? grid.getEntryTf()
                : List.of("M5", "M15");

        List<ObjectNode> out = new ArrayList<>();
        for (Integer mss : mssCandles) {
            if (mss == null) {
                continue;
            }
            for (String displacementType : displacementTypes) {
                if (displacementType == null || displacementType.isBlank()) {
                    continue;
                }
                for (Boolean retrace : retraceRequired) {
                    if (retrace == null) {
                        continue;
                    }
                    for (BigDecimal retracePct : retraceMinPct) {
                        if (retracePct == null) {
                            continue;
                        }
                        for (BigDecimal sweep : sweepDepth) {
                            if (sweep == null) {
                                continue;
                            }
                            for (String confirmTf : confirmationTf) {
                                BacktestTimeframe confirmationTimeframe = tryParseTimeframeCode(confirmTf);
                                if (confirmationTimeframe == null) {
                                    continue;
                                }
                                for (String eTf : entryTf) {
                                    BacktestTimeframe entryTimeframe = tryParseTimeframeCode(eTf);
                                    if (entryTimeframe == null) {
                                        continue;
                                    }
                                    if (confirmationTimeframe.duration().compareTo(entryTimeframe.duration()) < 0) {
                                        continue;
                                    }
                                    ObjectNode node = objectMapper.createObjectNode();
                                    node.put("mssMinConfirmCandles", mss);
                                    node.put("displacementType", displacementType);
                                    node.put("retraceRequired", retrace);
                                    node.put("retraceMinPct", retracePct);
                                    node.put("sweepMinDepthPips", sweep);
                                    node.put("confirmationTf", confirmationTimeframe.name());
                                    node.put("entryTf", entryTimeframe.name());
                                    out.add(node);
                                }
                            }
                        }
                    }
                }
            }
        }
        return out;
    }

    private JsonNode applyVariantToConfig(JsonNode baseConfig, ObjectNode params) {
        ObjectNode root = baseConfig != null && baseConfig.isObject()
                ? ((ObjectNode) baseConfig).deepCopy()
                : objectMapper.createObjectNode();
        ObjectNode smc = root.with("smc");
        if (params != null) {
            if (params.path("mssMinConfirmCandles").isNumber()) {
                smc.put("mssMinConfirmCandles", params.path("mssMinConfirmCandles").asInt());
            }
            if (params.path("displacementType").isTextual()) {
                smc.put("displacementType", params.path("displacementType").asText());
            }
            if (params.path("retraceRequired").isBoolean()) {
                smc.put("retraceRequired", params.path("retraceRequired").asBoolean());
            }
            if (params.path("retraceMinPct").isNumber()) {
                smc.put("retraceMinPct", params.path("retraceMinPct").decimalValue());
            }
            if (params.path("sweepMinDepthPips").isNumber()) {
                smc.put("sweepMinDepthPips", params.path("sweepMinDepthPips").decimalValue());
            }
            if (params.path("confirmationTf").isTextual()) {
                BacktestTimeframe confirmationTimeframe = tryParseTimeframeCode(params.path("confirmationTf").asText());
                if (confirmationTimeframe != null) {
                    smc.put("confirmationTf", confirmationTimeframe.name());
                    root.with("setupRule").put("confirmationTf", confirmationTimeframe.name());
                }
            }
            if (params.path("entryTf").isTextual()) {
                BacktestTimeframe entryTimeframe = tryParseTimeframeCode(params.path("entryTf").asText());
                if (entryTimeframe != null) {
                    smc.put("entryTf", entryTimeframe.name());
                    BacktestTimeframe existingExecution = tryParseTimeframeCode(text(
                            firstPresent(path(smc, "executionTf"), path(root, "context", "executionTimeframe"), path(root, "context", "execution_timeframe")),
                            null
                    ));
                    if (existingExecution == null || existingExecution.duration().compareTo(entryTimeframe.duration()) > 0) {
                        smc.put("executionTf", entryTimeframe.name());
                        root.with("context").put("executionTimeframe", entryTimeframe.name());
                    }
                }
            }
        }
        return root;
    }

    private BacktestTimeframe tryParseTimeframeCode(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        try {
            return BacktestTimeframe.from(code.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private VariantMetrics summarizeVariant(int variantIndex, ObjectNode params, List<EngineTrade> trades) {
        List<EngineTrade> filled = trades.stream()
                .filter(item -> "FILLED".equals(item.fillStatus()))
                .filter(item -> item.rMultiple() != null)
                .toList();

        int totalSignals = trades == null ? 0 : trades.size();
        int sampleSize = filled.size();
        long wins = filled.stream().filter(item -> item.rMultiple().compareTo(BigDecimal.ZERO) > 0).count();

        BigDecimal winRate = sampleSize == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(wins).multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(sampleSize), 6, RoundingMode.HALF_UP);
        BigDecimal expectancy = sampleSize == 0
                ? BigDecimal.ZERO
                : filled.stream().map(EngineTrade::rMultiple).reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(sampleSize), 6, RoundingMode.HALF_UP);

        BigDecimal positive = filled.stream()
                .map(EngineTrade::rMultiple)
                .filter(item -> item.compareTo(BigDecimal.ZERO) > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal negativeAbs = filled.stream()
                .map(EngineTrade::rMultiple)
                .filter(item -> item.compareTo(BigDecimal.ZERO) < 0)
                .map(BigDecimal::abs)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal profitFactor;
        if (negativeAbs.compareTo(BigDecimal.ZERO) == 0) {
            profitFactor = positive.compareTo(BigDecimal.ZERO) > 0 ? BigDecimal.valueOf(999) : BigDecimal.ZERO;
        } else {
            profitFactor = positive.divide(negativeAbs, 6, RoundingMode.HALF_UP);
        }

        BigDecimal fillRate = totalSignals == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(sampleSize)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(totalSignals), 6, RoundingMode.HALF_UP);
        BigDecimal avgMae = sampleSize == 0
                ? BigDecimal.ZERO
                : filled.stream()
                .map(EngineTrade::maeR)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(sampleSize), 6, RoundingMode.HALF_UP);
        BigDecimal avgMfe = sampleSize == 0
                ? BigDecimal.ZERO
                : filled.stream()
                .map(EngineTrade::mfeR)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(sampleSize), 6, RoundingMode.HALF_UP);
        BigDecimal avgDurationSec = sampleSize == 0
                ? BigDecimal.ZERO
                : filled.stream()
                .map(EngineTrade::durationSec)
                .filter(Objects::nonNull)
                .map(BigDecimal::valueOf)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(sampleSize), 6, RoundingMode.HALF_UP);

        BigDecimal equity = BigDecimal.ZERO;
        BigDecimal peak = BigDecimal.ZERO;
        BigDecimal maxDd = BigDecimal.ZERO;
        for (EngineTrade trade : filled) {
            equity = equity.add(trade.rMultiple());
            if (equity.compareTo(peak) > 0) {
                peak = equity;
            }
            BigDecimal dd = peak.subtract(equity);
            if (dd.compareTo(maxDd) > 0) {
                maxDd = dd;
            }
        }

        return new VariantMetrics(
                variantIndex,
                params == null ? objectMapper.createObjectNode() : params,
                sampleSize,
                sampleSize,
                winRate,
                profitFactor,
                expectancy,
                expectancy,
                maxDd,
                fillRate,
                avgMae,
                avgMfe,
                avgDurationSec,
                confidenceLabel(sampleSize)
        );
    }

    private void putDecimal(ObjectNode node, String field, BigDecimal value) {
        if (node == null || field == null || field.isBlank()) {
            return;
        }
        if (value == null) {
            node.putNull(field);
        } else {
            node.put(field, value);
        }
    }

    private BigDecimal asDecimal(JsonNode node, String field) {
        if (node == null || field == null) {
            return null;
        }
        JsonNode value = node.path(field);
        if (value.isNumber()) {
            return value.decimalValue();
        }
        return null;
    }

    @Transactional(readOnly = true)
    public BacktestLabRunResultsResponse getRunResults(UUID runId) {
        User user = currentUserService.getCurrentUser();
        BacktestRun run = requireRun(runId, user.getId());
        List<BacktestTrade> trades = tradeRepository.findByRun_IdOrderByEntryTimeAscCreatedAtAsc(runId);

        List<BacktestLabTradeResultResponse> rows = trades.stream()
                .map(this::toTradeResult)
                .toList();

        BacktestLabSummaryResponse summary = summarize(rows);
        String strategyName = run.getStrategyConfig() == null ? STRATEGY_DEFAULT_NAME : run.getStrategyConfig().getName();

        return BacktestLabRunResultsResponse.builder()
                .runId(run.getId())
                .status(run.getStatus().name())
                .strategyName(strategyName)
                .createdAt(run.getCreatedAt())
                .completedAt(run.getCompletedAt())
                .summary(summary)
                .trades(rows)
                .build();
    }

    @Transactional(readOnly = true)
    public BacktestRunReportResponse getRunReport(UUID runId) {
        User user = currentUserService.getCurrentUser();
        requireRun(runId, user.getId());
        BacktestRunReport report = reportRepository.findFirstByRun_IdOrderByCreatedAtUtcDesc(runId)
                .orElseThrow(() -> new EntityNotFoundException("Backtest report not found"));
        return toReportResponse(report);
    }

    @Transactional(readOnly = true)
    public List<BacktestRunReport> listReportsForCurrentUser() {
        User user = currentUserService.getCurrentUser();
        return reportRepository.findByRun_User_IdOrderByCreatedAtUtcDesc(user.getId());
    }

    private void persistRunArtifacts(BacktestRun run, List<EngineTrade> trades) {
        if (trades.isEmpty()) {
            return;
        }

        for (EngineTrade tradeRow : trades) {
            BacktestSetup setup = BacktestSetup.builder()
                    .run(run)
                    .sessionName(tradeRow.sessionName())
                    .direction(tradeRow.direction().name())
                    .sweepType(tradeRow.sweepType())
                    .confirmType(tradeRow.confirmType())
                    .sweepTimeUtc(tradeRow.sweepTimeUtc())
                    .displacementTimeUtc(tradeRow.displacementTimeUtc())
                    .confirmTimeUtc(tradeRow.confirmTimeUtc())
                    .evidenceJson(tradeRow.setupEvidence())
                    .build();
            setup = setupRepository.save(setup);

            BacktestTrade trade = BacktestTrade.builder()
                    .run(run)
                    .user(run.getUser())
                    .setup(setup)
                    .strategyId(null)
                    .symbol(run.getSymbol())
                    .direction(tradeRow.direction())
                    .orderType(tradeRow.orderType())
                    .entryPrice(tradeRow.entryPrice())
                    .stopLossPrice(tradeRow.stopLossPrice())
                    .takeProfitPrice(tradeRow.takeProfitPrice())
                    .requestedAt(tradeRow.confirmTimeUtc() == null ? OffsetDateTime.now(ZoneOffset.UTC) : tradeRow.confirmTimeUtc())
                    .entryTime(tradeRow.entryTimeUtc())
                    .exitTime(tradeRow.exitTimeUtc())
                    .filled("FILLED".equals(tradeRow.fillStatus()))
                    .fillStatus(tradeRow.fillStatus())
                    .exitReason(tradeRow.exitReason())
                    .win(tradeRow.rMultiple() != null && tradeRow.rMultiple().compareTo(BigDecimal.ZERO) > 0)
                    .breakEven(tradeRow.rMultiple() != null && tradeRow.rMultiple().compareTo(BigDecimal.ZERO) == 0)
                    .rMultiple(tradeRow.rMultiple())
                    .maeR(tradeRow.maeR())
                    .mfeR(tradeRow.mfeR())
                    .durationSec(tradeRow.durationSec())
                    .durationMinutes(tradeRow.durationSec() == null ? null : Math.toIntExact(Math.max(0L, tradeRow.durationSec() / 60L)))
                    .metadataJson(tradeRow.metadata())
                    .evidenceJson(tradeRow.tradeEvidence())
                    .build();
            tradeRepository.save(trade);
        }
    }

    private void generateAndPersistReport(BacktestRun run, BacktestStrategyConfig strategyConfig, EngineOutput output) {
        BacktestLabRunResultsResponse results = getRunResults(run.getId());
        List<ObjectNode> recommendations = buildRecommendations(results, strategyConfig.getConfigJson());
        String confidence = confidenceLabel(results.getSummary().getSampleSize());

        String markdown = buildReportMarkdown(
                run,
                strategyConfig,
                output,
                results,
                recommendations,
                confidence
        );

        ArrayNode recJson = objectMapper.createArrayNode();
        recommendations.forEach(recJson::add);

        BacktestRunReport report = BacktestRunReport.builder()
                .run(run)
                .strategyId(null)
                .strategyNameSnapshot(strategyConfig.getName())
                .strategyConfigSnapshotJson(strategyConfig.getConfigJson())
                .filtersSnapshotJson(output.filtersSnapshot())
                .summarySnapshotJson(objectMapper.valueToTree(results.getSummary()))
                .tradesTimelineSnapshotJson(objectMapper.valueToTree(results.getTrades()))
                .recommendationsSnapshotJson(recJson)
                .reportMarkdown(markdown)
                .reportVersion("v1")
                .build();
        reportRepository.save(report);
    }

    private String buildReportMarkdown(BacktestRun run,
                                       BacktestStrategyConfig strategyConfig,
                                       EngineOutput output,
                                       BacktestLabRunResultsResponse results,
                                       List<ObjectNode> recommendations,
                                       String confidence) {
        StringBuilder md = new StringBuilder();
        md.append("# Strategy Diagnostics Report\n\n");
        md.append("## Strategy Snapshot\n");
        md.append("- Strategy: ").append(strategyConfig.getName()).append("\n");
        md.append("- Execution timeframe: ").append(output.executionTimeframe().name()).append("\n");
        md.append("- Instrument: ").append(run.getSymbol()).append("\n");
        md.append("- Date range: ").append(run.getFromUtc()).append(" to ").append(run.getToUtc()).append("\n");
        md.append("- Session filter: ").append(run.getSessionWindow() == null ? "ALL" : run.getSessionWindow()).append("\n\n");

        BacktestLabSummaryResponse summary = results.getSummary();
        md.append("## Performance Summary\n");
        md.append("- Sample size: ").append(summary.getSampleSize()).append("\n");
        md.append("- Win rate: ").append(formatPct(summary.getWinRate())).append("\n");
        md.append("- Expectancy: ").append(formatSigned(summary.getExpectancyR())).append(" R\n");
        md.append("- Avg R: ").append(formatSigned(summary.getAvgR())).append("\n");
        md.append("- Avg MAE/MFE: ").append(formatSigned(summary.getAvgMaeR())).append(" / ").append(formatSigned(summary.getAvgMfeR())).append("\n");
        md.append("- Fill rate: ").append(formatPct(summary.getFillRate())).append("\n");
        md.append("- Avg duration: ").append(summary.getAvgDurationSec() == null ? "0" : summary.getAvgDurationSec().setScale(2, RoundingMode.HALF_UP)).append(" sec\n\n");

        md.append("## Trades Timeline\n");
        if (results.getTrades().isEmpty()) {
            md.append("- 0 setups matched filters.\n\n");
        }
        for (BacktestLabTradeResultResponse trade : results.getTrades()) {
            md.append("### Trade ").append(trade.getTradeId()).append("\n");
            md.append("- Direction: ").append(trade.getDirection()).append("\n");
            md.append("- Outcome: ").append(trade.getExitReason()).append(" | R=").append(formatSigned(trade.getRMultiple())).append("\n");
            if (trade.getTimeline() != null) {
                for (BacktestLabTimelineEventResponse event : trade.getTimeline()) {
                    md.append("- ").append(event.getStage()).append(": ").append(event.getTimeUtc()).append("\n");
                }
            }
            md.append("\n");
        }

        md.append("## What To Change\n");
        if (recommendations.isEmpty()) {
            md.append("- Not enough data for deterministic recommendations.\n\n");
        } else {
            for (ObjectNode rec : recommendations) {
                md.append("- ").append(rec.path("title").asText("Recommendation")).append(": ")
                        .append(rec.path("reason").asText(""))
                        .append(" (N=").append(rec.path("sampleSize").asInt(0)).append(")")
                        .append(" -> `").append(rec.path("field").asText("config")).append("` = ")
                        .append(rec.path("recommendedValue").asText("N/A"))
                        .append("\n");
            }
            md.append("\n");
        }

        md.append("## Confidence\n");
        md.append("- Confidence: ").append(confidence).append("\n");

        return md.toString();
    }

    private List<ObjectNode> buildRecommendations(BacktestLabRunResultsResponse results, JsonNode configJson) {
        List<BacktestLabTradeResultResponse> filledTrades = results.getTrades().stream()
                .filter(item -> "FILLED".equals(item.getFillStatus()))
                .filter(item -> item.getRMultiple() != null)
                .toList();

        List<ObjectNode> out = new ArrayList<>();
        if (filledTrades.size() < 5) {
            return out;
        }

        BigDecimal overallExpectancy = avgR(filledTrades);

        List<BacktestLabTradeResultResponse> losses = filledTrades.stream()
                .filter(item -> item.getRMultiple().compareTo(BigDecimal.ZERO) < 0)
                .toList();

        if (losses.size() >= 10) {
            BigDecimal losingDisp = averageEvidenceNumber(losses, "displacementRatio");
            BigDecimal baseMultiplier = decimal(path(configJson, "qualityFilters", "displacementMultiplier"), BigDecimal.valueOf(1.5));
            if (losingDisp != null && losingDisp.compareTo(baseMultiplier) < 0) {
                ObjectNode rec = objectMapper.createObjectNode();
                rec.put("title", "Raise displacement filter");
                rec.put("field", "qualityFilters.displacementMultiplier");
                rec.put("sampleSize", losses.size());
                rec.put("currentValue", baseMultiplier.toPlainString());
                rec.put("recommendedValue", baseMultiplier.add(BigDecimal.valueOf(0.25)).setScale(2, RoundingMode.HALF_UP).toPlainString());
                rec.put("deltaExpectancyR", overallExpectancy == null ? "0" : overallExpectancy.toPlainString());
                rec.put("reason", "Losing trades show weak displacement ratio compared to current threshold.");
                out.add(rec);
            }
        }

        List<BacktestLabTradeResultResponse> chop = filledTrades.stream()
                .filter(item -> "SL".equals(item.getExitReason()))
                .filter(item -> {
                    Integer bars = evidenceInt(item.getEvidence(), "confirmToExitBars");
                    return bars != null && bars <= 2;
                })
                .toList();
        if (chop.size() >= 10) {
            ObjectNode rec = objectMapper.createObjectNode();
            BigDecimal current = decimal(path(configJson, "qualityFilters", "confirmBreakBufferPips"), BigDecimal.ZERO);
            rec.put("title", "Add confirm close buffer");
            rec.put("field", "qualityFilters.confirmBreakBufferPips");
            rec.put("sampleSize", chop.size());
            rec.put("currentValue", current.toPlainString());
            rec.put("recommendedValue", current.add(BigDecimal.valueOf(0.2)).setScale(2, RoundingMode.HALF_UP).toPlainString());
            rec.put("deltaExpectancyR", avgR(chop) == null ? "0" : avgR(chop).toPlainString());
            rec.put("reason", "Chop cluster detected (rapid SL after confirm). Require stronger pivot break close.");
            out.add(rec);
        }

        Map<String, List<BacktestLabTradeResultResponse>> bySession = new LinkedHashMap<>();
        for (BacktestLabTradeResultResponse trade : filledTrades) {
            String session = evidenceText(trade.getEvidence(), "sessionName", "UNKNOWN");
            bySession.computeIfAbsent(session, ignored -> new ArrayList<>()).add(trade);
        }
        for (Map.Entry<String, List<BacktestLabTradeResultResponse>> entry : bySession.entrySet()) {
            if (entry.getValue().size() >= 10) {
                BigDecimal expectancy = avgR(entry.getValue());
                if (expectancy != null && expectancy.compareTo(BigDecimal.ZERO) < 0) {
                    ObjectNode rec = objectMapper.createObjectNode();
                    rec.put("title", "Session-specific filter");
                    rec.put("field", "setupRule.session");
                    rec.put("sampleSize", entry.getValue().size());
                    rec.put("currentValue", entry.getKey());
                    rec.put("recommendedValue", "Avoid or tighten " + entry.getKey());
                    rec.put("deltaExpectancyR", expectancy.toPlainString());
                    rec.put("reason", "Negative expectancy cluster in session " + entry.getKey() + ".");
                    out.add(rec);
                    break;
                }
            }
        }

        BigDecimal fixedR = decimal(path(configJson, "riskModel", "fixedR"), BigDecimal.valueOf(2));
        if (fixedR.compareTo(BigDecimal.valueOf(3)) >= 0 && filledTrades.size() >= 10) {
            long tpHits = filledTrades.stream().filter(item -> "TP".equals(item.getExitReason())).count();
            BigDecimal hitRate = BigDecimal.valueOf(tpHits)
                    .multiply(BigDecimal.valueOf(100))
                    .divide(BigDecimal.valueOf(filledTrades.size()), 4, RoundingMode.HALF_UP);
            BigDecimal avgMfe = averageMfe(filledTrades);
            if (hitRate.compareTo(BigDecimal.valueOf(30)) < 0 && avgMfe != null && avgMfe.compareTo(BigDecimal.valueOf(2)) >= 0) {
                ObjectNode rec = objectMapper.createObjectNode();
                rec.put("title", "Reduce TP target");
                rec.put("field", "riskModel.fixedR");
                rec.put("sampleSize", filledTrades.size());
                rec.put("currentValue", fixedR.toPlainString());
                rec.put("recommendedValue", "2.0");
                rec.put("deltaExpectancyR", avgMfe.toPlainString());
                rec.put("reason", "MFE supports 2R while current TP hit-rate is low.");
                out.add(rec);
            }
        }

        return out.stream().limit(5).toList();
    }

    private EngineOutput executeRunEngine(BacktestRun run,
                                          BacktestDatasetSet set,
                                          ParsedConfig config,
                                          BacktestLabRunRequest request,
                                          RangeResolution rangeResolution) {
        List<BacktestDataset> datasets = datasetRepository.findByDatasetSet_IdOrderByCreatedAtAsc(set.getId());
        if (datasets.isEmpty()) {
            throw new IllegalArgumentException("No datasets found for this dataset set");
        }

        DatasetSelection selection = chooseExecutionDataset(datasets, config.executionTimeframeRequested());
        int minRequired = minRequiredCandles();

        List<String> warnings = new ArrayList<>(rangeResolution.warnings());
        if (selection.executionTimeframe() != config.executionTimeframeRequested()) {
            warnings.add(
                    "Requested executionTf %s is lower than canonical source timeframe %s; executionTf was adjusted."
                            .formatted(config.executionTimeframeRequested().name(), selection.executionTimeframe().name())
            );
        }
        if (rangeResolution.requestedFromUtc() != null && rangeResolution.requestedFromUtc().isBefore(selection.minTimeUtc())) {
            warnings.add("Requested fromUtc was before selected timeframe dataset start and was clamped.");
        }
        if (rangeResolution.requestedToUtc() != null && rangeResolution.requestedToUtc().isAfter(selection.maxTimeUtc())) {
            warnings.add("Requested toUtc was after selected timeframe dataset end and was clamped.");
        }
        List<String> normalizedWarnings = deduplicateWarnings(warnings);

        OffsetDateTime fromUtc = clampToRange(run.getFromUtc(), selection.minTimeUtc(), selection.maxTimeUtc());
        OffsetDateTime toUtc = clampToRange(run.getToUtc(), selection.minTimeUtc(), selection.maxTimeUtc());
        RunDiagnostics baseDiagnostics = new RunDiagnostics(
                selection.minTimeUtc(),
                selection.maxTimeUtc(),
                rangeResolution.requestedFromUtc(),
                rangeResolution.requestedToUtc(),
                fromUtc,
                toUtc,
                0,
                minRequired,
                normalizedWarnings
        );
        if (fromUtc.isAfter(toUtc)) {
            String message = "Selected date range does not overlap dataset range";
            logRangeFailure(set, run, selection, baseDiagnostics, message);
            throw new BacktestRunDiagnosticsException(message, baseDiagnostics);
        }

        if (log.isDebugEnabled()) {
            log.debug(
                    "Backtest candle load request [datasetSetId={}, runId={}, executionTimeframe={}, selectedDatasetId={}, selectedDatasetTimeframe={}, provider={}, sourceId={}, symbolCanonical={}, symbolDisplay={}, storeTable=candle_chunks, fromUtc={} ({}), toUtc={} ({})]",
                    set.getId(),
                    run.getId(),
                    selection.executionTimeframe().name(),
                    selection.sourceDataset().getId(),
                    selection.sourceDataset().getTimeframe().name(),
                    selection.sourceDataset().getProvider().name(),
                    selection.sourceDataset().getSourceId(),
                    selection.sourceDataset().getSymbolCanonical(),
                    selection.sourceDataset().getSymbolDisplay(),
                    fromUtc,
                    fromUtc == null ? "null" : fromUtc.getClass().getSimpleName(),
                    toUtc,
                    toUtc == null ? "null" : toUtc.getClass().getSimpleName()
            );
        }
        List<BacktestCandle> sourceCandles = loadDatasetCandles(run.getUser().getId(), selection.sourceDataset(), fromUtc, toUtc);
        List<BacktestCandle> execCandles = selection.resample()
                ? resampleCandles(sourceCandles, selection.executionTimeframe())
                : sourceCandles;
        if (log.isDebugEnabled()) {
            log.debug(
                    "Backtest candle load result [datasetSetId={}, runId={}, selectedDatasetId={}, sourceCandles={}, executionCandles={}, resampled={}]",
                    set.getId(),
                    run.getId(),
                    selection.sourceDataset().getId(),
                    sourceCandles.size(),
                    execCandles.size(),
                    selection.resample()
            );
        }

        List<BacktestCandle> candles = execCandles.stream()
                .sorted(Comparator.comparing(BacktestCandle::timestamp))
                .toList();
        RunDiagnostics diagnostics = new RunDiagnostics(
                selection.minTimeUtc(),
                selection.maxTimeUtc(),
                rangeResolution.requestedFromUtc(),
                rangeResolution.requestedToUtc(),
                fromUtc,
                toUtc,
                candles.size(),
                minRequired,
                normalizedWarnings
        );
        if (candles.isEmpty()) {
            String message = "No candles found for timeframe %s in effective range. Import may be incomplete or storage mismatch."
                    .formatted(selection.executionTimeframe().name());
            logRangeFailure(set, run, selection, diagnostics, message);
            throw new BacktestRunDiagnosticsException(message, diagnostics);
        }
        if (candles.size() < minRequired) {
            String message = "Not enough candles: found %d, need >= %d".formatted(candles.size(), minRequired);
            logRangeFailure(set, run, selection, diagnostics, message);
            throw new BacktestRunDiagnosticsException(message, diagnostics);
        }

        List<BacktestCandle> dailyCandles = aggregateToDaily(sourceCandles.isEmpty() ? candles : sourceCandles);

        List<SessionWindow> sessions = config.sessions().isEmpty() ? defaultSessions(config.timezoneBasis()) : config.sessions();
        SessionWindow setupSession = resolveSessionWindow(sessions, config.setupSessionName());
        String forcedSession = normalizeOptionalText(request == null ? null : request.getSessionFilter());
        if (forcedSession != null) {
            setupSession = resolveSessionWindow(sessions, forcedSession);
        }

        Map<LocalDate, SessionStats> sessionStats = computeSessionStats(candles, setupSession);
        Map<LocalDate, DayStats> dailyStats = computeDailyStats(dailyCandles);
        PivotState pivots = computePivots(candles, config.pivotLeft(), config.pivotRight());

        List<EngineTrade> trades = simulateTrades(candles, config, setupSession, sessionStats, dailyStats, pivots);

        ObjectNode filters = objectMapper.createObjectNode();
        filters.put("fromUtc", fromUtc.toString());
        filters.put("toUtc", toUtc.toString());
        filters.put("sessionFilter", setupSession.name());
        filters.put("executionTimeframe", selection.executionTimeframe().name());

        return new EngineOutput(
                selection.executionTimeframe(),
                selection.sourceDataset(),
                candles,
                trades,
                filters,
                diagnostics
        );
    }

    private List<EngineTrade> simulateTrades(List<BacktestCandle> candles,
                                             ParsedConfig config,
                                             SessionWindow setupSession,
                                             Map<LocalDate, SessionStats> sessionStats,
                                             Map<LocalDate, DayStats> dailyStats,
                                             PivotState pivots) {
        List<EngineTrade> trades = new ArrayList<>();
        if (candles == null || candles.isEmpty()) {
            return trades;
        }

        Map<String, Integer> sessionCounter = new HashMap<>();
        Map<LocalDate, Integer> dayCounter = new HashMap<>();

        int swingN = switch (normalizeToken(config.swingDetectionMethod())) {
            case "FRACTAL" -> 2;
            case "SWINGHL" -> 1;
            default -> Math.max(1, config.swingPivotN());
        };
        PivotState structurePivots = computePivots(candles, swingN, swingN);
        PivotMarkers structureMarkers = detectPivotMarkers(candles, swingN, swingN);

        List<SessionWindow> evaluationSessions = resolveEvaluationSessions(config, setupSession);
        if (evaluationSessions.isEmpty()) {
            return trades;
        }
        List<SessionWindow> entrySessions = resolveEntrySessions(config, setupSession);
        if (entrySessions.isEmpty()) {
            return trades;
        }
        Set<String> consumedPools = new LinkedHashSet<>();

        BigDecimal touchBuffer = config.touchTolerancePips().multiply(config.pipSize());
        BigDecimal confirmBreakBuffer = config.confirmBreakBufferPips().multiply(config.pipSize());
        BigDecimal mssBreakBuffer = confirmBreakBuffer.max(config.mssMinBreakDistancePips().multiply(config.pipSize()));
        BigDecimal bosBreakBuffer = config.bosMinBreakDistancePips().multiply(config.pipSize());
        BigDecimal minSweepDepth = config.sweepMinDepthPips().multiply(config.pipSize());
        BigDecimal minDisplacementBody = config.displacementMinBodyPips().multiply(config.pipSize());

        Map<String, List<SessionLevelRecord>> sessionLevelRecords = buildSessionLevelRecords(candles, config.sessions());
        Map<LocalDate, WeekStats> weeklyStats = computeWeeklyStats(dailyStats);

        List<LiquidityPoolCandidate> contextPools = buildContextPools(
                candles,
                config,
                sessionLevelRecords,
                dailyStats,
                weeklyStats
        );
        List<LiquidityPoolCandidate> eqPools = buildEqPools(candles, config);
        List<LiquidityPoolCandidate> allPools = new ArrayList<>(contextPools.size() + eqPools.size());
        allPools.addAll(contextPools);
        allPools.addAll(eqPools);
        allPools.sort(Comparator.comparingInt(LiquidityPoolCandidate::createdIndex));

        int startIndex = Math.max(3, config.bodyLookback());
        for (int i = startIndex; i < candles.size() - 3; i++) {
            BacktestCandle sweepCandle = candles.get(i);
            SessionStamp stamp = null;
            for (SessionWindow sessionWindow : evaluationSessions) {
                stamp = assignSession(sweepCandle.timestamp(), sessionWindow);
                if (stamp != null) {
                    break;
                }
            }
            if (stamp == null) {
                continue;
            }
            if (config.requireKillzone() && !isWithinKillzone(sweepCandle.timestamp(), stamp.sessionName(), config)) {
                continue;
            }

            List<LiquidityPoolCandidate> activePools = resolveActivePools(allPools, config, i);
            if (!activePools.isEmpty() && config.sweepRequiresUnsweptPool()) {
                for (LiquidityPoolCandidate pool : activePools) {
                    if (consumedPools.contains(pool.id())) {
                        continue;
                    }
                    if (isPoolConsumedBeforeIndex(pool, candles, i, touchBuffer, minSweepDepth)) {
                        consumedPools.add(pool.id());
                    }
                }
            }
            if (config.sweepRequiresUnsweptPool() && !consumedPools.isEmpty()) {
                activePools = activePools.stream()
                        .filter(pool -> !consumedPools.contains(pool.id()))
                        .toList();
            }
            Sweep sweep = detectSweep(candles, i, activePools, config, touchBuffer, minSweepDepth, sweepCandle.close());
            if (sweep == null) {
                continue;
            }
            if (config.requireCrossSessionSweep() && sweep.sourceSessionName() != null
                    && normalizeSessionName(sweep.sourceSessionName()).equals(stamp.sessionName())) {
                continue;
            }
            if (config.sweepRequiresUnsweptPool()) {
                consumedPools.add(sweep.poolId());
            }

            String directionMode = normalizeToken(config.directionMode());
            Direction direction = switch (directionMode) {
                case "LONG" -> Direction.LONG;
                case "SHORT" -> Direction.SHORT;
                default -> sweep.side() == SweepSide.HIGH ? Direction.SHORT : Direction.LONG;
            };

            DisplacementSignal displacement = findDisplacementSignal(
                    candles,
                    sweep,
                    direction,
                    config,
                    touchBuffer,
                    minDisplacementBody
            );
            if (displacement == null) {
                continue;
            }

            StructureContext structureContext = deriveStructureContext(candles, structureMarkers, displacement.index(), config);

            String confirmationType = normalizeToken(config.confirmationType());
            MssSignal mss;
            if ("BOS".equals(confirmationType)) {
                if (!config.bosEnabled()) {
                    continue;
                }
                mss = findBosSignal(candles, structurePivots, structureContext, displacement, direction, config, bosBreakBuffer);
            } else {
                if (!config.mssEnabled()) {
                    continue;
                }
                mss = findMssSignal(candles, structurePivots, sweep, displacement, direction, config, mssBreakBuffer);
            }
            if (mss == null) {
                i = Math.max(i, displacement.index());
                continue;
            }

            if (!(sweep.sweepExtremeTime().isAfter(displacement.time()) || displacement.time().isAfter(mss.confirmTime()))) {
                // ordered correctly
            } else {
                continue;
            }

            RetraceGate retraceGate = null;
            if (config.retraceRequired()) {
                retraceGate = resolveRetraceGate(candles, sweep, displacement, direction, config);
                if (retraceGate == null || !retraceGate.satisfied()) {
                    i = Math.max(i, mss.confirmIndex());
                    continue;
                }
            }

            if (config.antiChop() && displacement.index() + 1 < candles.size()) {
                BacktestCandle next = candles.get(displacement.index() + 1);
                BacktestCandle displacementCandle = candles.get(displacement.index());
                if (next.high().compareTo(displacementCandle.high()) >= 0 && next.low().compareTo(displacementCandle.low()) <= 0) {
                    continue;
                }
            }

            String sessionKey = stamp.sessionName() + ":" + stamp.sessionDateKey();
            int usedInSession = sessionCounter.getOrDefault(sessionKey, 0);
            if (config.maxTradesPerSession() > 0 && usedInSession >= config.maxTradesPerSession()) {
                continue;
            }
            int usedInDay = dayCounter.getOrDefault(stamp.sessionDateKey(), 0);
            if (config.maxTradesPerDay() > 0 && usedInDay >= config.maxTradesPerDay()) {
                continue;
            }

            EntryOutcome entry = resolveEntry(config, candles, sweep, displacement, mss, retraceGate, direction);
            if (!entry.filled()) {
                EngineTrade noFill = buildNoFillTrade(
                        config,
                        stamp.sessionName(),
                        stamp.sessionDateKey(),
                        sweep,
                        displacement,
                        mss,
                        retraceGate,
                        entry,
                        direction
                );
                trades.add(noFill);
                sessionCounter.put(sessionKey, usedInSession + 1);
                dayCounter.put(stamp.sessionDateKey(), usedInDay + 1);
                i = Math.max(i, mss.confirmIndex());
                continue;
            }

            SessionStamp entryStamp = null;
            for (SessionWindow entrySession : entrySessions) {
                entryStamp = assignSession(entry.entryTime(), entrySession);
                if (entryStamp != null) {
                    break;
                }
            }
            if (entryStamp == null) {
                continue;
            }
            if (config.requireSameSessionForSweepAndEntry()
                    && !normalizeSessionName(entryStamp.sessionName()).equals(normalizeSessionName(stamp.sessionName()))) {
                continue;
            }

            BigDecimal stopLoss = resolveStop(config, candles, structurePivots, sweep, entry.fillIndex(), direction, touchBuffer);
            if (stopLoss == null) {
                continue;
            }
            BigDecimal takeProfit = resolveTakeProfit(config, entry.entryPrice(), stopLoss, direction);
            BigDecimal rr = rr(entry.entryPrice(), stopLoss, takeProfit);
            if (rr == null || rr.compareTo(config.minRR()) < 0) {
                continue;
            }

            ExecutionCostBreakdown entryCost = buildEntryCostBreakdown(config, direction, entry.entryPrice());
            BigDecimal entryPrice = entryCost.finalPrice();
            BigDecimal risk = entryPrice.subtract(stopLoss).abs();
            if (risk.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            ExitOutcome exit = resolveExit(candles, entry.fillIndex(), direction, stopLoss, takeProfit);
            ExecutionCostBreakdown exitCost = buildExitCostBreakdown(config, direction, exit.exitPrice());
            BigDecimal exitPrice = exitCost.finalPrice();
            BigDecimal rMultiple = calcR(direction, entryPrice, exitPrice, risk);
            Excursion excursion = computeExcursion(candles, entry.fillIndex(), exit.exitIndex(), direction, entryPrice, risk);
            Integer durationSec = null;
            if (entry.entryTime() != null && exit.exitTime() != null) {
                durationSec = Math.toIntExact(Math.max(0, Duration.between(entry.entryTime(), exit.exitTime()).toSeconds()));
            }

            ObjectNode setupEvidence = objectMapper.createObjectNode();
            setupEvidence.put("sessionName", stamp.sessionName());
            setupEvidence.put("sessionDate", stamp.sessionDateKey().toString());
            setupEvidence.put("sweepSide", sweep.side().name());
            setupEvidence.put("poolType", sweep.poolType());
            setupEvidence.put("poolLevel", sweep.levelPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
            setupEvidence.put("sweepDepth", sweep.depth().setScale(6, RoundingMode.HALF_UP).toPlainString());
            setupEvidence.put("sweepExtremePrice", sweep.sweepExtreme().setScale(6, RoundingMode.HALF_UP).toPlainString());
            setupEvidence.put("sweepExtremeTime", isoUtc(sweep.sweepExtremeTime()));
            setupEvidence.put("structureHighLabel", structureContext.highLabel());
            setupEvidence.put("structureLowLabel", structureContext.lowLabel());
            setupEvidence.put("structureTrend", structureContext.trend());

            ObjectNode tradeEvidence = objectMapper.createObjectNode();
            tradeEvidence.put("sessionName", stamp.sessionName());
            tradeEvidence.put("sessionDate", stamp.sessionDateKey().toString());
            tradeEvidence.put("confirmationType", "BOS".equals(confirmationType) ? "BOS" : "MSS");
            tradeEvidence.put("setupFamily", "SWEEP_" + ("BOS".equals(confirmationType) ? "BOS" : "MSS"));
            tradeEvidence.put("sweepSide", sweep.side().name());
            tradeEvidence.put("poolType", sweep.poolType());
            tradeEvidence.put("poolLevel", sweep.levelPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("firstBreachTime", isoUtc(sweep.firstBreachTime()));
            tradeEvidence.put("firstBreachPrice", sweep.firstBreachPrice() == null
                    ? null
                    : sweep.firstBreachPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("sweepExtremePrice", sweep.sweepExtreme().setScale(6, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("sweepExtremeTime", isoUtc(sweep.sweepExtremeTime()));
            tradeEvidence.put("sweepDurationBars", sweep.sweepDurationBars());
            tradeEvidence.put("sweepReclaimConfirmed", sweep.reclaimConfirmed());
            tradeEvidence.put("poolStatusAfterSweep", "CONSUMED");
            tradeEvidence.put("displacementRatio", displacement.bodyRatio() == null
                    ? 0
                    : displacement.bodyRatio().setScale(4, RoundingMode.HALF_UP).doubleValue());
            tradeEvidence.put("displacementBodyPips", displacement.bodyPips().setScale(3, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("displacementAvgBodyPips", displacement.avgBodyPips().setScale(3, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("displacementGapDetected", displacement.gapDetected());
            tradeEvidence.put("displacementGapSizePips", displacement.gapSizePips().setScale(3, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("attackedLevel", displacement.attackedLevel().setScale(6, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("mssAnchorLevel", mss.anchorLevel().setScale(6, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("mssTriggerTime", isoUtc(mss.triggerTime()));
            tradeEvidence.put("mssConfirmTime", isoUtc(mss.confirmTime()));
            tradeEvidence.put("structureHighLabel", structureContext.highLabel());
            tradeEvidence.put("structureLowLabel", structureContext.lowLabel());
            tradeEvidence.put("structureTrend", structureContext.trend());
            if (structureContext.previousSwingHigh() != null) {
                tradeEvidence.put("previousSwingHigh", structureContext.previousSwingHigh().setScale(6, RoundingMode.HALF_UP).toPlainString());
            }
            if (structureContext.latestSwingHigh() != null) {
                tradeEvidence.put("latestSwingHigh", structureContext.latestSwingHigh().setScale(6, RoundingMode.HALF_UP).toPlainString());
            }
            if (structureContext.previousSwingLow() != null) {
                tradeEvidence.put("previousSwingLow", structureContext.previousSwingLow().setScale(6, RoundingMode.HALF_UP).toPlainString());
            }
            if (structureContext.latestSwingLow() != null) {
                tradeEvidence.put("latestSwingLow", structureContext.latestSwingLow().setScale(6, RoundingMode.HALF_UP).toPlainString());
            }
            tradeEvidence.put("confirmToExitBars", Math.max(1, exit.exitIndex() - mss.confirmIndex() + 1));
            tradeEvidence.put("retraceRequired", config.retraceRequired());
            tradeEvidence.put("entryTriggerPrice", entry.entryPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("entryRawPrice", entryCost.rawPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("entrySpreadAdjustmentPrice", entryCost.spreadAdjustment().setScale(6, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("entrySlippageAdjustmentPrice", entryCost.slippageAdjustment().setScale(6, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("entryFinalExecutionPrice", entryCost.finalPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("entrySpreadPips", config.spreadPips().setScale(3, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("entrySlippagePips", config.slippagePips().setScale(3, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("exitRawPrice", exitCost.rawPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("exitSpreadAdjustmentPrice", exitCost.spreadAdjustment().setScale(6, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("exitSlippageAdjustmentPrice", exitCost.slippageAdjustment().setScale(6, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("exitFinalExecutionPrice", exitCost.finalPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("fillPolicy", config.fillPolicy());
            if (retraceGate != null) {
                tradeEvidence.put("retraceReference", retraceGate.referenceUsed());
                tradeEvidence.put("retraceTargetPrice", retraceGate.targetPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
                tradeEvidence.put("retraceOkTime", isoUtc(retraceGate.retraceOkTime()));
            }
            if (config.storeIntermediateLevels() || config.emitDebugFields()) {
                tradeEvidence.put("selectedPoolId", sweep.poolId());
                tradeEvidence.put("sweepRankScore", BigDecimal.valueOf(sweep.rankScore()).setScale(6, RoundingMode.HALF_UP).toPlainString());
            }
            ArrayNode timeline = buildTimeline(sweep, displacement, mss, retraceGate, entry, exit, entryCost, exitCost, config.confirmationType());
            tradeEvidence.set("timeline", timeline);
            tradeEvidence.set("eventGraph", timeline.deepCopy());

            ObjectNode metadata = objectMapper.createObjectNode();
            metadata.put("entryModel", config.entryModelType());
            metadata.put("stopRule", config.stopRule());
            metadata.put("tpRule", "FIXED_R");
            metadata.put("fillPolicy", config.fillPolicy());

            EngineTrade trade = new EngineTrade(
                    stamp.sessionName(),
                    sweep.poolType(),
                    config.confirmationType(),
                    direction,
                    BacktestOrderType.valueOf(config.entryModelType().startsWith("LIMIT") ? "LIMIT" : "MARKET"),
                    sweep.sweepExtremeTime(),
                    displacement.time(),
                    mss.confirmTime(),
                    entry.entryTime(),
                    entryPrice,
                    stopLoss,
                    takeProfit,
                    exit.exitTime(),
                    exitPrice,
                    exit.exitReason(),
                    "FILLED",
                    rMultiple,
                    excursion.maeR(),
                    excursion.mfeR(),
                    durationSec,
                    metadata,
                    setupEvidence,
                    tradeEvidence
            );
            trades.add(trade);

            sessionCounter.put(sessionKey, usedInSession + 1);
            dayCounter.put(stamp.sessionDateKey(), usedInDay + 1);
            i = Math.max(i, Math.max(entry.fillIndex(), mss.confirmIndex()));
        }

        return trades;
    }

    private EngineTrade buildNoFillTrade(ParsedConfig config,
                                         String sessionName,
                                         LocalDate sessionDate,
                                         Sweep sweep,
                                         DisplacementSignal displacement,
                                         MssSignal mss,
                                         RetraceGate retraceGate,
                                         EntryOutcome entry,
                                         Direction direction) {
        ObjectNode metadata = objectMapper.createObjectNode();
        metadata.put("entryModel", config.entryModelType());
        metadata.put("status", "NO_FILL");

        ObjectNode setupEvidence = objectMapper.createObjectNode();
        setupEvidence.put("sessionName", sessionName);
        setupEvidence.put("sessionDate", sessionDate.toString());
        setupEvidence.put("sweepSide", sweep.side().name());
        setupEvidence.put("poolType", sweep.poolType());
        setupEvidence.put("poolLevel", sweep.levelPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
        setupEvidence.put("sweepExtremePrice", sweep.sweepExtreme().setScale(6, RoundingMode.HALF_UP).toPlainString());

        ObjectNode tradeEvidence = objectMapper.createObjectNode();
        tradeEvidence.put("sessionName", sessionName);
        tradeEvidence.put("sessionDate", sessionDate.toString());
        tradeEvidence.put("confirmationType", normalizeToken(config.confirmationType()).equals("BOS") ? "BOS" : "MSS");
        tradeEvidence.put("setupFamily", "SWEEP_" + (normalizeToken(config.confirmationType()).equals("BOS") ? "BOS" : "MSS"));
        tradeEvidence.put("sweepSide", sweep.side().name());
        tradeEvidence.put("poolType", sweep.poolType());
        tradeEvidence.put("poolStatusAfterSweep", "CONSUMED");
        tradeEvidence.put("displacementRatio", displacement.bodyRatio() == null
                ? 0
                : displacement.bodyRatio().setScale(4, RoundingMode.HALF_UP).doubleValue());
        tradeEvidence.put("mssAnchorLevel", mss.anchorLevel().setScale(6, RoundingMode.HALF_UP).toPlainString());
        tradeEvidence.put("mssTriggerTime", isoUtc(mss.triggerTime()));
        tradeEvidence.put("mssConfirmTime", isoUtc(mss.confirmTime()));
        tradeEvidence.put("entryTriggerPrice", entry.entryPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
        tradeEvidence.put("fillPolicy", config.fillPolicy());
        if (retraceGate != null) {
            tradeEvidence.put("retraceRequired", config.retraceRequired());
            tradeEvidence.put("retraceReference", retraceGate.referenceUsed());
            tradeEvidence.put("retraceTargetPrice", retraceGate.targetPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
            tradeEvidence.put("retraceOkTime", isoUtc(retraceGate.retraceOkTime()));
        }
        ArrayNode timeline = buildNoFillTimeline(sweep, displacement, mss, retraceGate, entry, config.confirmationType());
        tradeEvidence.set("timeline", timeline);
        tradeEvidence.set("eventGraph", timeline.deepCopy());

        return new EngineTrade(
                sessionName,
                sweep.poolType(),
                config.confirmationType(),
                direction,
                BacktestOrderType.valueOf(config.entryModelType().startsWith("LIMIT") ? "LIMIT" : "MARKET"),
                sweep.sweepExtremeTime(),
                displacement.time(),
                mss.confirmTime(),
                null,
                entry.entryPrice(),
                entry.entryPrice(),
                entry.entryPrice(),
                null,
                null,
                BacktestExitReason.OPEN,
                "NO_FILL",
                null,
                null,
                null,
                null,
                metadata,
                setupEvidence,
                tradeEvidence
        );
    }

    private ArrayNode buildNoFillTimeline(Sweep sweep,
                                          DisplacementSignal displacement,
                                          MssSignal mss,
                                          RetraceGate retraceGate,
                                          EntryOutcome entry,
                                          String confirmationTypeRaw) {
        ArrayNode timeline = objectMapper.createArrayNode();
        boolean bosMode = "BOS".equals(normalizeToken(confirmationTypeRaw));

        ObjectNode sweepDetails = objectMapper.createObjectNode();
        sweepDetails.put("side", sweep.side().name());
        sweepDetails.put("poolType", sweep.poolType());
        sweepDetails.put("poolId", sweep.poolId());
        sweepDetails.put("poolLevel", sweep.levelPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
        sweepDetails.put("depth", sweep.depth().setScale(6, RoundingMode.HALF_UP).toPlainString());
        sweepDetails.put("sweepExtremePrice", sweep.sweepExtreme().setScale(6, RoundingMode.HALF_UP).toPlainString());
        sweepDetails.put("sweepExtremeTime", isoUtc(sweep.sweepExtremeTime()));
        sweepDetails.put("durationBars", sweep.sweepDurationBars());
        sweepDetails.put("reclaimConfirmed", sweep.reclaimConfirmed());
        sweepDetails.put("confirmationTf", sweep.confirmationTf());
        sweepDetails.put("state", "SWEEP_CONFIRMED");
        sweepDetails.put("poolStatus", "CONSUMED");
        if (sweep.poolCreatedTime() != null) {
            sweepDetails.put("poolCreatedTime", isoUtc(sweep.poolCreatedTime()));
        }
        if (sweep.sourceSessionName() != null) {
            sweepDetails.put("poolSourceSession", sweep.sourceSessionName());
        }
        timeline.add(timelineNode("POOL_CREATED", sweep.poolCreatedTime(), sweepDetails.deepCopy()));
        timeline.add(timelineNode("POOL_TARGETED", sweep.firstBreachTime(), sweepDetails.deepCopy()));
        if (sweep.firstBreachTime() != null) {
            sweepDetails.put("firstBreachTime", isoUtc(sweep.firstBreachTime()));
            timeline.add(timelineNode("SWEEP_FIRST_BREACH", sweep.firstBreachTime(), sweepDetails.deepCopy()));
        }
        if (sweep.firstBreachPrice() != null) {
            sweepDetails.put("firstBreachPrice", sweep.firstBreachPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
        }
        timeline.add(timelineNode("SWEEP_EXTREME", sweep.sweepExtremeTime(), sweepDetails.deepCopy()));
        timeline.add(timelineNode("SWEEP", sweep.sweepExtremeTime(), sweepDetails));
        timeline.add(timelineNode("POOL_CONSUMED", sweep.sweepExtremeTime(), sweepDetails.deepCopy()));

        ObjectNode displacementDetails = objectMapper.createObjectNode();
        displacementDetails.put("open", displacement.open().toPlainString());
        displacementDetails.put("close", displacement.close().toPlainString());
        displacementDetails.put("attackedLevel", displacement.attackedLevel().setScale(6, RoundingMode.HALF_UP).toPlainString());
        displacementDetails.put("bodyPips", displacement.bodyPips().setScale(3, RoundingMode.HALF_UP).toPlainString());
        displacementDetails.put("avgBodyPips", displacement.avgBodyPips().setScale(3, RoundingMode.HALF_UP).toPlainString());
        displacementDetails.put("gapDetected", displacement.gapDetected());
        displacementDetails.put("gapSizePips", displacement.gapSizePips().setScale(3, RoundingMode.HALF_UP).toPlainString());
        if (displacement.bodyRatio() != null) {
            displacementDetails.put("bodyVsAvg", displacement.bodyRatio().setScale(4, RoundingMode.HALF_UP).toPlainString());
        }
        timeline.add(timelineNode("DISPLACEMENT_FOUND", displacement.time(), displacementDetails.deepCopy()));
        if (displacement.gapDetected()) {
            timeline.add(timelineNode("GAP_FOUND", displacement.time(), displacementDetails.deepCopy()));
        }
        timeline.add(timelineNode("DISPLACEMENT", displacement.time(), displacementDetails));

        ObjectNode triggerDetails = objectMapper.createObjectNode();
        triggerDetails.put("anchorLevel", mss.anchorLevel().setScale(6, RoundingMode.HALF_UP).toPlainString());
        triggerDetails.put("breakPrice", mss.breakPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
        timeline.add(timelineNode(bosMode ? "BOS_TRIGGER" : "MSS_TRIGGER", mss.triggerTime(), triggerDetails));

        ObjectNode confirmDetails = objectMapper.createObjectNode();
        confirmDetails.put("anchorLevel", mss.anchorLevel().setScale(6, RoundingMode.HALF_UP).toPlainString());
        confirmDetails.put("breakPrice", mss.breakPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
        timeline.add(timelineNode(bosMode ? "BOS_CONFIRMED" : "MSS_CONFIRMED", mss.confirmTime(), confirmDetails));
        timeline.add(timelineNode(bosMode ? "BOS" : "MSS_BOS", mss.confirmTime(), confirmDetails.deepCopy()));

        if (retraceGate != null) {
            ObjectNode retraceTarget = objectMapper.createObjectNode();
            retraceTarget.put("reference", retraceGate.referenceUsed());
            retraceTarget.put("rangeLow", retraceGate.referenceLow().setScale(6, RoundingMode.HALF_UP).toPlainString());
            retraceTarget.put("rangeHigh", retraceGate.referenceHigh().setScale(6, RoundingMode.HALF_UP).toPlainString());
            retraceTarget.put("targetPrice", retraceGate.targetPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
            timeline.add(timelineNode("RETRACE_TARGET_CALC", retraceGate.targetTime(), retraceTarget));

            if (retraceGate.retraceOkTime() != null) {
                ObjectNode retraceOk = objectMapper.createObjectNode();
                retraceOk.put("targetPrice", retraceGate.targetPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
                retraceOk.put("touchPrice", retraceGate.retraceTouchPrice() == null
                        ? null
                        : retraceGate.retraceTouchPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
                timeline.add(timelineNode("RETRACE_OK", retraceGate.retraceOkTime(), retraceOk));
            }
        }

        ObjectNode entryDetails = objectMapper.createObjectNode();
        entryDetails.put("status", "NO_FILL");
        entryDetails.put("model", entry.model());
        entryDetails.put("price", entry.entryPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
        entryDetails.put("entryTriggerPrice", entry.entryPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
        timeline.add(timelineNode("ENTRY", null, entryDetails));

        return timeline;
    }

    private ArrayNode buildTimeline(Sweep sweep,
                                    DisplacementSignal displacement,
                                    MssSignal mss,
                                    RetraceGate retraceGate,
                                    EntryOutcome entry,
                                    ExitOutcome exit,
                                    ExecutionCostBreakdown entryCost,
                                    ExecutionCostBreakdown exitCost,
                                    String confirmationTypeRaw) {
        ArrayNode timeline = objectMapper.createArrayNode();
        boolean bosMode = "BOS".equals(normalizeToken(confirmationTypeRaw));

        ObjectNode sweepDetails = objectMapper.createObjectNode();
        sweepDetails.put("side", sweep.side().name());
        sweepDetails.put("poolType", sweep.poolType());
        sweepDetails.put("poolId", sweep.poolId());
        sweepDetails.put("poolLevel", sweep.levelPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
        sweepDetails.put("depth", sweep.depth().setScale(6, RoundingMode.HALF_UP).toPlainString());
        sweepDetails.put("sweepExtremePrice", sweep.sweepExtreme().setScale(6, RoundingMode.HALF_UP).toPlainString());
        sweepDetails.put("sweepExtremeTime", isoUtc(sweep.sweepExtremeTime()));
        sweepDetails.put("durationBars", sweep.sweepDurationBars());
        sweepDetails.put("reclaimConfirmed", sweep.reclaimConfirmed());
        sweepDetails.put("confirmationTf", sweep.confirmationTf());
        sweepDetails.put("state", "SWEEP_CONFIRMED");
        sweepDetails.put("poolStatus", "CONSUMED");
        if (sweep.poolCreatedTime() != null) {
            sweepDetails.put("poolCreatedTime", isoUtc(sweep.poolCreatedTime()));
        }
        if (sweep.sourceSessionName() != null) {
            sweepDetails.put("poolSourceSession", sweep.sourceSessionName());
        }
        timeline.add(timelineNode("POOL_CREATED", sweep.poolCreatedTime(), sweepDetails.deepCopy()));
        timeline.add(timelineNode("POOL_TARGETED", sweep.firstBreachTime(), sweepDetails.deepCopy()));
        if (sweep.firstBreachTime() != null) {
            sweepDetails.put("firstBreachTime", isoUtc(sweep.firstBreachTime()));
            timeline.add(timelineNode("SWEEP_FIRST_BREACH", sweep.firstBreachTime(), sweepDetails.deepCopy()));
        }
        if (sweep.firstBreachPrice() != null) {
            sweepDetails.put("firstBreachPrice", sweep.firstBreachPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
        }
        timeline.add(timelineNode("SWEEP_EXTREME", sweep.sweepExtremeTime(), sweepDetails.deepCopy()));
        timeline.add(timelineNode("SWEEP", sweep.sweepExtremeTime(), sweepDetails));
        timeline.add(timelineNode("POOL_CONSUMED", sweep.sweepExtremeTime(), sweepDetails.deepCopy()));

        ObjectNode displacementDetails = objectMapper.createObjectNode();
        displacementDetails.put("open", displacement.open().toPlainString());
        displacementDetails.put("close", displacement.close().toPlainString());
        displacementDetails.put("attackedLevel", displacement.attackedLevel().setScale(6, RoundingMode.HALF_UP).toPlainString());
        displacementDetails.put("bodyPips", displacement.bodyPips().setScale(3, RoundingMode.HALF_UP).toPlainString());
        displacementDetails.put("avgBodyPips", displacement.avgBodyPips().setScale(3, RoundingMode.HALF_UP).toPlainString());
        displacementDetails.put("gapDetected", displacement.gapDetected());
        displacementDetails.put("gapSizePips", displacement.gapSizePips().setScale(3, RoundingMode.HALF_UP).toPlainString());
        if (displacement.bodyRatio() != null) {
            displacementDetails.put("bodyVsAvg", displacement.bodyRatio().setScale(4, RoundingMode.HALF_UP).toPlainString());
        }
        timeline.add(timelineNode("DISPLACEMENT_FOUND", displacement.time(), displacementDetails.deepCopy()));
        if (displacement.gapDetected()) {
            timeline.add(timelineNode("GAP_FOUND", displacement.time(), displacementDetails.deepCopy()));
        }
        timeline.add(timelineNode("DISPLACEMENT", displacement.time(), displacementDetails));

        ObjectNode triggerDetails = objectMapper.createObjectNode();
        triggerDetails.put("anchorLevel", mss.anchorLevel().setScale(6, RoundingMode.HALF_UP).toPlainString());
        triggerDetails.put("breakPrice", mss.breakPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
        timeline.add(timelineNode(bosMode ? "BOS_TRIGGER" : "MSS_TRIGGER", mss.triggerTime(), triggerDetails));

        ObjectNode confirmDetails = objectMapper.createObjectNode();
        confirmDetails.put("anchorLevel", mss.anchorLevel().setScale(6, RoundingMode.HALF_UP).toPlainString());
        confirmDetails.put("breakPrice", mss.breakPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
        timeline.add(timelineNode(bosMode ? "BOS_CONFIRMED" : "MSS_CONFIRMED", mss.confirmTime(), confirmDetails));
        timeline.add(timelineNode(bosMode ? "BOS" : "MSS_BOS", mss.confirmTime(), confirmDetails.deepCopy()));

        if (retraceGate != null) {
            ObjectNode retraceTarget = objectMapper.createObjectNode();
            retraceTarget.put("reference", retraceGate.referenceUsed());
            retraceTarget.put("rangeLow", retraceGate.referenceLow().setScale(6, RoundingMode.HALF_UP).toPlainString());
            retraceTarget.put("rangeHigh", retraceGate.referenceHigh().setScale(6, RoundingMode.HALF_UP).toPlainString());
            retraceTarget.put("targetPrice", retraceGate.targetPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
            timeline.add(timelineNode("RETRACE_TARGET_CALC", retraceGate.targetTime(), retraceTarget));

            if (retraceGate.retraceOkTime() != null) {
                ObjectNode retraceOk = objectMapper.createObjectNode();
                retraceOk.put("targetPrice", retraceGate.targetPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
                retraceOk.put("touchPrice", retraceGate.retraceTouchPrice() == null
                        ? null
                        : retraceGate.retraceTouchPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
                timeline.add(timelineNode("RETRACE_OK", retraceGate.retraceOkTime(), retraceOk));
            }
        }

        ObjectNode entryDetails = objectMapper.createObjectNode();
        entryDetails.put("price", entry.entryPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
        entryDetails.put("model", entry.model());
        entryDetails.put("entryTriggerPrice", entry.entryPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
        if (entryCost != null) {
            entryDetails.put("entryRawPrice", entryCost.rawPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
            entryDetails.put("spreadAdjustmentPrice", entryCost.spreadAdjustment().setScale(6, RoundingMode.HALF_UP).toPlainString());
            entryDetails.put("slippageAdjustmentPrice", entryCost.slippageAdjustment().setScale(6, RoundingMode.HALF_UP).toPlainString());
            entryDetails.put("finalExecutionPrice", entryCost.finalPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
        }
        timeline.add(timelineNode("ENTRY", entry.entryTime(), entryDetails));
        timeline.add(timelineNode("ENTRY_FILLED", entry.entryTime(), entryDetails.deepCopy()));

        ObjectNode exitDetails = objectMapper.createObjectNode();
        exitDetails.put("reason", exit.exitReason().name());
        if (exit.exitPrice() != null) {
            exitDetails.put("price", exit.exitPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
        }
        if (exitCost != null) {
            exitDetails.put("exitRawPrice", exitCost.rawPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
            exitDetails.put("spreadAdjustmentPrice", exitCost.spreadAdjustment().setScale(6, RoundingMode.HALF_UP).toPlainString());
            exitDetails.put("slippageAdjustmentPrice", exitCost.slippageAdjustment().setScale(6, RoundingMode.HALF_UP).toPlainString());
            exitDetails.put("finalExecutionPrice", exitCost.finalPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
        }
        timeline.add(timelineNode("EXIT", exit.exitTime(), exitDetails));

        return timeline;
    }

    private ObjectNode timelineNode(String stage, OffsetDateTime timeUtc, ObjectNode details) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("stage", stage);
        if (timeUtc != null) {
            node.put("timeUtc", isoUtc(timeUtc));
        } else {
            node.putNull("timeUtc");
        }
        node.set("details", details == null ? objectMapper.createObjectNode() : details);
        return node;
    }

    private ExitOutcome resolveExit(List<BacktestCandle> candles,
                                    int fillIndex,
                                    Direction direction,
                                    BigDecimal stopLoss,
                                    BigDecimal takeProfit) {
        for (int i = fillIndex; i < candles.size(); i++) {
            BacktestCandle candle = candles.get(i);
            boolean slHit;
            boolean tpHit;
            if (direction == Direction.LONG) {
                slHit = candle.low().compareTo(stopLoss) <= 0;
                tpHit = candle.high().compareTo(takeProfit) >= 0;
            } else {
                slHit = candle.high().compareTo(stopLoss) >= 0;
                tpHit = candle.low().compareTo(takeProfit) <= 0;
            }
            if (slHit && tpHit) {
                return new ExitOutcome(i, candle.timestamp(), stopLoss, BacktestExitReason.SL);
            }
            if (slHit) {
                return new ExitOutcome(i, candle.timestamp(), stopLoss, BacktestExitReason.SL);
            }
            if (tpHit) {
                return new ExitOutcome(i, candle.timestamp(), takeProfit, BacktestExitReason.TP);
            }
        }

        BacktestCandle last = candles.get(candles.size() - 1);
        return new ExitOutcome(candles.size() - 1, last.timestamp(), last.close(), BacktestExitReason.MANUAL);
    }

    private BigDecimal resolveStop(ParsedConfig config,
                                   List<BacktestCandle> candles,
                                   PivotState pivots,
                                   Sweep sweep,
                                   int fillIndex,
                                   Direction direction,
                                   BigDecimal buffer) {
        if ("LAST_SWING_PLUS_BUFFER".equals(config.stopRule())) {
            BigDecimal swing = direction == Direction.LONG
                    ? pivots.lastPivotLowPrice(fillIndex)
                    : pivots.lastPivotHighPrice(fillIndex);
            if (swing != null) {
                return direction == Direction.LONG
                        ? swing.subtract(buffer)
                        : swing.add(buffer);
            }
        }

        return direction == Direction.LONG
                ? sweep.sweepExtreme().subtract(buffer)
                : sweep.sweepExtreme().add(buffer);
    }

    private EntryOutcome resolveEntry(ParsedConfig config,
                                      List<BacktestCandle> candles,
                                      Sweep sweep,
                                      DisplacementSignal displacement,
                                      MssSignal mss,
                                      RetraceGate retraceGate,
                                      Direction direction) {
        int entryStartIndex = mss.confirmIndex();
        if (retraceGate != null && retraceGate.retraceOkIndex() != null) {
            entryStartIndex = Math.max(entryStartIndex, retraceGate.retraceOkIndex());
        }
        BacktestCandle anchorCandle = candles.get(entryStartIndex);
        String modelToken = normalizeToken(config.entryModelType());
        if ("MARKETONCONFIRMCLOSE".equals(modelToken) || "MARKETONMSSCONFIRM".equals(modelToken)) {
            return new EntryOutcome(
                    true,
                    entryStartIndex,
                    anchorCandle.timestamp(),
                    anchorCandle.close(),
                    displacement.time(),
                    mss.confirmTime(),
                    "MARKET_ON_MSS_CONFIRM"
            );
        }
        if ("LIMITFVGFILL".equals(modelToken)) {
            BigDecimal entryPrice = null;
            if (displacement.gapDetected() && displacement.gapLow() != null && displacement.gapHigh() != null) {
                entryPrice = displacement.gapLow()
                        .add(displacement.gapHigh())
                        .divide(BigDecimal.valueOf(2), 8, RoundingMode.HALF_UP);
            }
            if (entryPrice == null) {
                return new EntryOutcome(false, null, null, anchorCandle.close(), displacement.time(), mss.confirmTime(), "LIMIT_FVG_FILL");
            }
            int until = Math.min(candles.size() - 1, entryStartIndex + Math.max(1, config.entryWindowBars()));
            for (int i = entryStartIndex; i <= until; i++) {
                BacktestCandle candle = candles.get(i);
                if (candle.low().compareTo(entryPrice) <= 0 && candle.high().compareTo(entryPrice) >= 0) {
                    return new EntryOutcome(true, i, candle.timestamp(), entryPrice, displacement.time(), mss.confirmTime(), "LIMIT_FVG_FILL");
                }
            }
            return new EntryOutcome(false, null, null, entryPrice, displacement.time(), mss.confirmTime(), "LIMIT_FVG_FILL");
        }

        int legStart = Math.min(sweep.sweepExtremeIndex(), displacement.index());
        int legEnd = Math.max(sweep.sweepExtremeIndex(), displacement.index());
        BigDecimal impulseHigh = candles.get(legStart).high();
        BigDecimal impulseLow = candles.get(legStart).low();
        for (int i = legStart; i <= legEnd; i++) {
            BacktestCandle candle = candles.get(i);
            if (candle.high().compareTo(impulseHigh) > 0) {
                impulseHigh = candle.high();
            }
            if (candle.low().compareTo(impulseLow) < 0) {
                impulseLow = candle.low();
            }
        }
        BigDecimal range = impulseHigh.subtract(impulseLow).abs();
        if (range.compareTo(BigDecimal.ZERO) <= 0) {
            range = candles.get(displacement.index()).high().subtract(candles.get(displacement.index()).low()).abs();
        }
        BigDecimal retrace = config.retracePercent().divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);
        BigDecimal entryPrice = direction == Direction.LONG
                ? impulseHigh.subtract(range.multiply(retrace))
                : impulseLow.add(range.multiply(retrace));

        if (config.entryRequiresDiscountPremium()) {
            BigDecimal midpoint = impulseLow.add(range.divide(BigDecimal.valueOf(2), 8, RoundingMode.HALF_UP));
            if ((direction == Direction.LONG && entryPrice.compareTo(midpoint) > 0)
                    || (direction == Direction.SHORT && entryPrice.compareTo(midpoint) < 0)) {
                return new EntryOutcome(false, null, null, entryPrice, displacement.time(), mss.confirmTime(), "LIMIT_RETRACE_PERCENT");
            }
        }

        int until = Math.min(candles.size() - 1, entryStartIndex + Math.max(1, config.entryWindowBars()));
        int probeStart = config.retraceRequired()
                ? entryStartIndex
                : Math.min(candles.size() - 1, entryStartIndex + 1);
        for (int i = probeStart; i <= until; i++) {
            BacktestCandle candle = candles.get(i);
            if (candle.low().compareTo(entryPrice) <= 0 && candle.high().compareTo(entryPrice) >= 0) {
                if (config.entryRequiresFvgRetest() && !isFvgRetestSatisfied(candles, displacement.index(), direction, i)) {
                    continue;
                }
                return new EntryOutcome(true, i, candle.timestamp(), entryPrice, displacement.time(), mss.confirmTime(), "LIMIT_RETRACE_PERCENT");
            }
        }

        return new EntryOutcome(false, null, null, entryPrice, displacement.time(), mss.confirmTime(), "LIMIT_RETRACE_PERCENT");
    }

    private boolean isFvgRetestSatisfied(List<BacktestCandle> candles,
                                         int displacementIndex,
                                         Direction direction,
                                         int probeIndex) {
        if (displacementIndex <= 0 || displacementIndex >= candles.size()) {
            return false;
        }
        BacktestCandle previous = candles.get(displacementIndex - 1);
        BacktestCandle displacement = candles.get(displacementIndex);
        BacktestCandle probe = candles.get(probeIndex);

        if (direction == Direction.LONG) {
            if (displacement.low().compareTo(previous.high()) <= 0) {
                return false;
            }
            return probe.low().compareTo(displacement.low()) <= 0 && probe.high().compareTo(previous.high()) >= 0;
        }
        if (displacement.high().compareTo(previous.low()) >= 0) {
            return false;
        }
        return probe.high().compareTo(displacement.high()) >= 0 && probe.low().compareTo(previous.low()) <= 0;
    }

    private RetraceGate resolveRetraceGate(List<BacktestCandle> candles,
                                           Sweep sweep,
                                           DisplacementSignal displacement,
                                           Direction direction,
                                           ParsedConfig config) {
        if (candles == null || candles.isEmpty()) {
            return null;
        }

        String configuredReference = normalizeToken(config.retraceReference());
        String referenceUsed;
        BigDecimal referenceLow;
        BigDecimal referenceHigh;

        boolean preferGap = "GAPFILL".equals(configuredReference) || configuredReference.isBlank();
        if (preferGap && displacement.gapDetected()
                && displacement.gapLow() != null
                && displacement.gapHigh() != null
                && displacement.gapHigh().compareTo(displacement.gapLow()) > 0) {
            referenceLow = displacement.gapLow();
            referenceHigh = displacement.gapHigh();
            referenceUsed = "GAP_FILL";
        } else {
            BigDecimal origin = displacement.open();
            BigDecimal extreme = direction == Direction.LONG
                    ? displacement.high()
                    : displacement.low();
            referenceLow = origin.min(extreme);
            referenceHigh = origin.max(extreme);
            referenceUsed = "IMPULSE_LEG";
        }

        BigDecimal range = referenceHigh.subtract(referenceLow).abs();
        if (range.compareTo(BigDecimal.ZERO) <= 0) {
            return new RetraceGate(
                    false,
                    displacement.index(),
                    displacement.time(),
                    referenceLow,
                    null,
                    null,
                    null,
                    referenceUsed,
                    referenceLow,
                    referenceHigh
            );
        }

        BigDecimal pct = config.retraceMinPct();
        if (pct == null) {
            pct = BigDecimal.valueOf(50);
        }
        if (pct.compareTo(BigDecimal.ZERO) < 0) {
            pct = BigDecimal.ZERO;
        }
        if (pct.compareTo(BigDecimal.valueOf(100)) > 0) {
            pct = BigDecimal.valueOf(100);
        }
        BigDecimal ratio = pct.divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);
        BigDecimal targetPrice = direction == Direction.LONG
                ? referenceHigh.subtract(range.multiply(ratio))
                : referenceLow.add(range.multiply(ratio));

        int startIndex = Math.min(candles.size() - 1, displacement.index() + 1);
        int until = Math.min(candles.size() - 1, displacement.index() + Math.max(1, config.retraceMaxWaitBars()));
        for (int i = startIndex; i <= until; i++) {
            BacktestCandle candle = candles.get(i);
            boolean touched = config.retraceAcceptWickTouch()
                    ? candle.low().compareTo(targetPrice) <= 0 && candle.high().compareTo(targetPrice) >= 0
                    : (direction == Direction.LONG
                    ? candle.close().compareTo(targetPrice) <= 0
                    : candle.close().compareTo(targetPrice) >= 0);
            if (!touched) {
                continue;
            }
            BigDecimal touchPrice = config.retraceAcceptWickTouch()
                    ? targetPrice
                    : candle.close();
            return new RetraceGate(
                    true,
                    displacement.index(),
                    displacement.time(),
                    targetPrice,
                    i,
                    candle.timestamp(),
                    touchPrice,
                    referenceUsed,
                    referenceLow,
                    referenceHigh
            );
        }

        return new RetraceGate(
                false,
                displacement.index(),
                displacement.time(),
                targetPrice,
                null,
                null,
                null,
                referenceUsed,
                referenceLow,
                referenceHigh
        );
    }

    private MssSignal findMssSignal(List<BacktestCandle> candles,
                                    PivotState pivots,
                                    Sweep sweep,
                                    DisplacementSignal displacement,
                                    Direction direction,
                                    ParsedConfig config,
                                    BigDecimal buffer) {
        BigDecimal anchor = resolveMssAnchor(candles, pivots, sweep, displacement, direction, config);
        if (anchor == null) {
            return null;
        }

        int from = displacement.index();
        int until = Math.min(candles.size() - 1, from + Math.max(1, config.mssMaxConfirmWindowBars()));
        int needed = Math.max(1, config.mssMinConfirmCandles());
        String invalidationRule = normalizeToken(config.mssInvalidationRule());
        int allowedPierces = "ALLOWONEPIERCE".equals(invalidationRule) ? 1 : 0;
        for (int i = from; i <= until; i++) {
            BacktestCandle candle = candles.get(i);
            if (!isMssBroken(candle, direction, anchor, buffer, config.mssRequiresClose())) {
                continue;
            }

            int streak = 0;
            int pierces = 0;
            int confirmIndex = -1;
            for (int j = i; j <= until; j++) {
                BacktestCandle probe = candles.get(j);
                if (isMssInvalidated(probe, direction, anchor, buffer, config)) {
                    pierces++;
                    if (pierces > allowedPierces) {
                        break;
                    }
                    continue;
                }
                streak++;
                if (streak >= needed) {
                    confirmIndex = j;
                    break;
                }
            }
            if (confirmIndex >= 0) {
                BigDecimal breakPrice = config.mssRequiresClose()
                        ? candle.close()
                        : direction == Direction.LONG ? candle.high() : candle.low();
                return new MssSignal(
                        i,
                        confirmIndex,
                        candles.get(i).timestamp(),
                        candles.get(confirmIndex).timestamp(),
                        anchor,
                        breakPrice
                );
            }
        }
        return null;
    }

    private MssSignal findBosSignal(List<BacktestCandle> candles,
                                    PivotState pivots,
                                    StructureContext structureContext,
                                    DisplacementSignal displacement,
                                    Direction direction,
                                    ParsedConfig config,
                                    BigDecimal breakBuffer) {
        int from = displacement.index();
        int until = Math.min(candles.size() - 1, from + Math.max(2, config.mssMaxConfirmWindowBars()));
        if (from >= candles.size()) {
            return null;
        }

        boolean closeOnly = !"WICKALLOWED".equals(normalizeToken(config.bosBreakMode()));
        String anchorType = normalizeToken(config.bosAnchorType());
        BigDecimal anchor;
        if ("EXTERNALSWINGONLY".equals(anchorType)) {
            anchor = direction == Direction.LONG
                    ? structureContext.latestSwingHigh()
                    : structureContext.latestSwingLow();
        } else if ("INTERNALSWINGALLOWED".equals(anchorType)) {
            anchor = displacement.attackedLevel();
        } else {
            anchor = direction == Direction.LONG
                    ? pivots.lastPivotHighPrice(from - 1)
                    : pivots.lastPivotLowPrice(from - 1);
        }
        if (anchor == null) {
            anchor = direction == Direction.LONG ? structureContext.latestSwingHigh() : structureContext.latestSwingLow();
        }
        if (anchor == null) {
            return null;
        }
        if ("WITHTRENDONLY".equals(normalizeToken(config.bosDirectionRule()))) {
            if (direction == Direction.LONG && !"BULLISH".equals(structureContext.trend())) {
                return null;
            }
            if (direction == Direction.SHORT && !"BEARISH".equals(structureContext.trend())) {
                return null;
            }
        }

        int neededHoldBars = Math.max(1, config.bosHoldBars());
        for (int i = from; i <= until; i++) {
            BacktestCandle candle = candles.get(i);
            boolean broken;
            if (direction == Direction.LONG) {
                broken = closeOnly
                        ? candle.close().compareTo(anchor.add(breakBuffer)) > 0
                        : candle.high().compareTo(anchor.add(breakBuffer)) > 0;
            } else {
                broken = closeOnly
                        ? candle.close().compareTo(anchor.subtract(breakBuffer)) < 0
                        : candle.low().compareTo(anchor.subtract(breakBuffer)) < 0;
            }
            if (!broken) {
                continue;
            }

            int hold = 0;
            int confirm = -1;
            for (int j = i; j <= until; j++) {
                BacktestCandle probe = candles.get(j);
                boolean stillBeyond;
                if (direction == Direction.LONG) {
                    stillBeyond = closeOnly
                            ? probe.close().compareTo(anchor.add(breakBuffer)) > 0
                            : probe.high().compareTo(anchor.add(breakBuffer)) > 0;
                } else {
                    stillBeyond = closeOnly
                            ? probe.close().compareTo(anchor.subtract(breakBuffer)) < 0
                            : probe.low().compareTo(anchor.subtract(breakBuffer)) < 0;
                }
                if (!stillBeyond) {
                    break;
                }
                hold++;
                if (hold >= neededHoldBars) {
                    confirm = j;
                    break;
                }
            }
            if (confirm >= 0) {
                BigDecimal breakPrice = closeOnly
                        ? candle.close()
                        : direction == Direction.LONG ? candle.high() : candle.low();
                return new MssSignal(i, confirm, candles.get(i).timestamp(), candles.get(confirm).timestamp(), anchor, breakPrice);
            }
        }
        return null;
    }

    private boolean isMssBroken(BacktestCandle candle,
                                Direction direction,
                                BigDecimal anchor,
                                BigDecimal buffer,
                                boolean requiresClose) {
        if (direction == Direction.LONG) {
            return requiresClose
                    ? candle.close().compareTo(anchor.add(buffer)) > 0
                    : candle.high().compareTo(anchor.add(buffer)) > 0;
        }
        return requiresClose
                ? candle.close().compareTo(anchor.subtract(buffer)) < 0
                : candle.low().compareTo(anchor.subtract(buffer)) < 0;
    }

    private boolean isMssInvalidated(BacktestCandle candle,
                                     Direction direction,
                                     BigDecimal anchor,
                                     BigDecimal buffer,
                                     ParsedConfig config) {
        String rule = normalizeToken(config.mssInvalidationRule());
        if ("WICKBACKTHROUGHLEVEL".equals(rule)) {
            if (direction == Direction.LONG) {
                return candle.low().compareTo(anchor.subtract(buffer)) <= 0;
            }
            return candle.high().compareTo(anchor.add(buffer)) >= 0;
        }
        if ("CLOSEBACKTHROUGHLEVEL".equals(rule) || rule.isBlank() || "ALLOWONEPIERCE".equals(rule)) {
            if (direction == Direction.LONG) {
                return candle.close().compareTo(anchor.subtract(buffer)) <= 0;
            }
            return candle.close().compareTo(anchor.add(buffer)) >= 0;
        }
        return false;
    }

    private BigDecimal resolveMssAnchor(List<BacktestCandle> candles,
                                        PivotState pivots,
                                        Sweep sweep,
                                        DisplacementSignal displacement,
                                        Direction direction,
                                        ParsedConfig config) {
        String anchorMode = normalizeToken(config.mssAnchorLevel());
        if ("DISPLACEMENTORIGIN".equals(anchorMode)) {
            return candles.get(displacement.index()).open();
        }
        if ("INTERNALSTRUCTURE".equals(anchorMode)
                || "INTERNALSWING".equals(anchorMode)
                || "INTERNALSWINGALLOWED".equals(anchorMode)) {
            return displacement.attackedLevel();
        }
        if ("PROTECTEDHIGHLOW".equals(anchorMode) || "LASTCONFIRMEDSWING".equals(anchorMode)) {
            return direction == Direction.LONG
                    ? pivots.lastPivotHighPrice(displacement.index() - 1)
                    : pivots.lastPivotLowPrice(displacement.index() - 1);
        }

        BigDecimal pivotAnchor = direction == Direction.LONG
                ? pivots.lastPivotHighPrice(displacement.index() - 1)
                : pivots.lastPivotLowPrice(displacement.index() - 1);
        if (pivotAnchor != null) {
            return pivotAnchor;
        }
        if (displacement.attackedLevel() != null) {
            return displacement.attackedLevel();
        }
        return sweep.levelPrice();
    }

    private DisplacementSignal findDisplacementSignal(List<BacktestCandle> candles,
                                                      Sweep sweep,
                                                      Direction direction,
                                                      ParsedConfig config,
                                                      BigDecimal touchBuffer,
                                                      BigDecimal minBodyAbs) {
        int from = sweep.sweepEndIndex() + 1;
        int until = Math.min(candles.size() - 2, from + Math.max(1, config.displacementMaxDelayBarsAfterSweep()));
        if (from >= candles.size()) {
            return null;
        }
        BigDecimal minGapPips = config.displacementGapMinPips();
        for (int i = from; i <= until; i++) {
            BacktestCandle candle = candles.get(i);
            BigDecimal body = candle.close().subtract(candle.open()).abs();
            BigDecimal avgBody = averageBodyAbs(candles, i, config.bodyLookback());
            BigDecimal ratio = (avgBody == null || avgBody.compareTo(BigDecimal.ZERO) == 0)
                    ? null
                    : body.divide(avgBody, 8, RoundingMode.HALF_UP);

            boolean directional = direction == Direction.LONG
                    ? candle.close().compareTo(candle.open()) > 0
                    : candle.close().compareTo(candle.open()) < 0;
            if (!directional) {
                continue;
            }
            boolean bodyStrong = body.compareTo(minBodyAbs) >= 0
                    && ratio != null
                    && ratio.compareTo(config.displacementMinBodyVsAvgMult()) >= 0;

            GapMetrics gap = detectDisplacementGap(candles, i, direction, config);
            boolean gapStrong = gap.detected()
                    && gap.sizePips().compareTo(minGapPips) >= 0;
            if (!isDisplacementTypeAccepted(config.displacementType(), bodyStrong, gapStrong, gap.detected())) {
                continue;
            }

            BigDecimal attackedLevel = sweep.levelPrice();
            if (config.displacementRequiresCloseBeyondLevel()) {
                boolean beyond = direction == Direction.LONG
                        ? candle.close().compareTo(attackedLevel.add(touchBuffer)) > 0
                        : candle.close().compareTo(attackedLevel.subtract(touchBuffer)) < 0;
                if (!beyond) {
                    continue;
                }
            }

            int overlapBars = Math.max(0, config.displacementNoInstantOverlapBars());
            if (overlapBars > 0) {
                boolean hasInstantOverlap = false;
                for (int offset = 1; offset <= overlapBars && i + offset < candles.size(); offset++) {
                    BacktestCandle next = candles.get(i + offset);
                    if (next.high().compareTo(candle.high()) >= 0 && next.low().compareTo(candle.low()) <= 0) {
                        hasInstantOverlap = true;
                        break;
                    }
                }
                if (hasInstantOverlap) {
                    continue;
                }
            }

            BigDecimal bodyPips = config.pipSize().compareTo(BigDecimal.ZERO) == 0
                    ? BigDecimal.ZERO
                    : body.divide(config.pipSize(), 8, RoundingMode.HALF_UP);
            BigDecimal avgBodyPips = config.pipSize().compareTo(BigDecimal.ZERO) == 0 || avgBody == null
                    ? BigDecimal.ZERO
                    : avgBody.divide(config.pipSize(), 8, RoundingMode.HALF_UP);
            return new DisplacementSignal(
                    i,
                    candle.timestamp(),
                    attackedLevel,
                    body,
                    bodyPips,
                    avgBodyPips,
                    ratio,
                    gap.detected(),
                    gap.sizePips(),
                    gap.low(),
                    gap.high(),
                    candle.open(),
                    candle.close(),
                    candle.high(),
                    candle.low()
            );
        }
        return null;
    }

    private boolean isDisplacementTypeAccepted(String typeRaw,
                                               boolean bodyStrong,
                                               boolean gapStrong,
                                               boolean anyGapDetected) {
        String type = normalizeToken(typeRaw);
        if ("GAPREQUIRED".equals(type)) {
            return gapStrong;
        }
        if ("NOGAPONLY".equals(type)) {
            return bodyStrong && !anyGapDetected;
        }
        return gapStrong || bodyStrong;
    }

    private GapMetrics detectDisplacementGap(List<BacktestCandle> candles,
                                             int index,
                                             Direction direction,
                                             ParsedConfig config) {
        if (index <= 0 || index >= candles.size()) {
            return GapMetrics.none();
        }
        String mode = normalizeToken(config.displacementGapDefinition());
        BacktestCandle current = candles.get(index);
        BigDecimal gapLow = null;
        BigDecimal gapHigh = null;

        if ("TWOCANDLEGAP".equals(mode)) {
            BacktestCandle previous = candles.get(index - 1);
            if (direction == Direction.LONG && current.low().compareTo(previous.high()) > 0) {
                gapLow = previous.high();
                gapHigh = current.low();
            } else if (direction == Direction.SHORT && current.high().compareTo(previous.low()) < 0) {
                gapLow = current.high();
                gapHigh = previous.low();
            }
        } else {
            if (index < 2) {
                return GapMetrics.none();
            }
            BacktestCandle left = candles.get(index - 2);
            if (direction == Direction.LONG && current.low().compareTo(left.high()) > 0) {
                gapLow = left.high();
                gapHigh = current.low();
            } else if (direction == Direction.SHORT && current.high().compareTo(left.low()) < 0) {
                gapLow = current.high();
                gapHigh = left.low();
            }
        }

        if (gapLow == null || gapHigh == null || gapHigh.compareTo(gapLow) <= 0) {
            return GapMetrics.none();
        }
        BigDecimal sizePips = config.pipSize().compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : gapHigh.subtract(gapLow).abs().divide(config.pipSize(), 8, RoundingMode.HALF_UP);
        return new GapMetrics(true, gapLow, gapHigh, sizePips);
    }

    private BigDecimal averageBodyAbs(List<BacktestCandle> candles, int index, int lookback) {
        if (index <= 0) {
            return null;
        }
        int from = Math.max(0, index - Math.max(1, lookback));
        BigDecimal total = BigDecimal.ZERO;
        int count = 0;
        for (int i = from; i < index; i++) {
            BigDecimal body = candles.get(i).close().subtract(candles.get(i).open()).abs();
            total = total.add(body);
            count++;
        }
        if (count == 0) {
            return null;
        }
        return total.divide(BigDecimal.valueOf(count), 8, RoundingMode.HALF_UP);
    }

    private BigDecimal bodyRatio(List<BacktestCandle> candles, int index, int lookback) {
        BigDecimal avg = averageBodyAbs(candles, index, lookback);
        if (avg == null || avg.compareTo(BigDecimal.ZERO) == 0) {
            return null;
        }
        BigDecimal current = candles.get(index).close().subtract(candles.get(index).open()).abs();
        return current.divide(avg, 8, RoundingMode.HALF_UP);
    }

    private Sweep detectSweep(List<BacktestCandle> candles,
                              int index,
                              List<LiquidityPoolCandidate> pools,
                              ParsedConfig config,
                              BigDecimal touchBuffer,
                              BigDecimal minDepthAbs,
                              BigDecimal referenceClose) {
        if (pools.isEmpty()) {
            return null;
        }
        BacktestCandle candle = candles.get(index);
        List<Sweep> candidates = new ArrayList<>();
        String configuredSweepType = normalizeSessionName(config.sweepType());
        for (LiquidityPoolCandidate pool : pools) {
            if (config.sweepRequiresLiquidityType() && !config.poolTypesEnabled().contains(pool.type())) {
                continue;
            }
            if (!matchesConfiguredSweepType(configuredSweepType, pool.type())) {
                continue;
            }
            if (!config.sweepSourceSessions().isEmpty() && pool.sourceSessionName() != null
                    && !config.sweepSourceSessions().contains(normalizeSessionName(pool.sourceSessionName()))) {
                continue;
            }
            if (pool.side() == SweepSide.HIGH) {
                if (candle.high().compareTo(pool.levelPrice().add(touchBuffer)) < 0) {
                    continue;
                }
            } else if (candle.low().compareTo(pool.levelPrice().subtract(touchBuffer)) > 0) {
                continue;
            }

            double rankScore = computePoolRankScore(pool, config.poolRankRule(), referenceClose);
            Sweep sweep = trackSweepExcursion(candles, index, pool, config, minDepthAbs, rankScore);
            if (sweep != null) {
                candidates.add(sweep);
            }
        }
        return selectSweepCandidate(candidates, config);
    }

    private Sweep selectSweepCandidate(List<Sweep> candidates, ParsedConfig config) {
        if (candidates == null || candidates.isEmpty()) {
            return null;
        }
        if (candidates.size() == 1) {
            return candidates.get(0);
        }

        String rule = normalizeToken(config.sweepSelectRule());
        Comparator<Sweep> comparator;
        if ("NEWESTSESSIONLEVEL".equals(rule)) {
            comparator = Comparator.comparingInt(Sweep::poolCreatedIndex)
                    .thenComparing(Sweep::depth);
        } else if ("MAXDEPTHTHENBESTRANKEDPOOL".equals(rule) || "LARGESTDEPTH".equals(rule)) {
            comparator = Comparator.comparing(Sweep::depth)
                    .thenComparingDouble(Sweep::rankScore);
        } else if ("HIGHESTRANKEDPOOL".equals(rule)) {
            comparator = Comparator.comparingDouble(Sweep::rankScore)
                    .thenComparing(Sweep::depth);
        } else {
            comparator = Comparator.comparing(Sweep::depth)
                    .thenComparingDouble(Sweep::rankScore);
        }
        return candidates.stream().max(comparator).orElse(null);
    }

    private Sweep trackSweepExcursion(List<BacktestCandle> candles,
                                      int startIndex,
                                      LiquidityPoolCandidate pool,
                                      ParsedConfig config,
                                      BigDecimal minDepthAbs,
                                      double rankScore) {
        int maxDuration = Math.max(1, config.sweepMaxDurationBars());
        int until = Math.min(candles.size() - 1, startIndex + maxDuration);
        BacktestCandle first = candles.get(startIndex);

        BigDecimal extreme = pool.side() == SweepSide.HIGH ? first.high() : first.low();
        OffsetDateTime extremeTime = first.timestamp();
        int extremeIndex = startIndex;
        BigDecimal firstBreachPrice = pool.side() == SweepSide.HIGH ? first.high() : first.low();
        OffsetDateTime firstBreachTime = first.timestamp();
        int endIndex = until;
        boolean reclaimed = false;

        for (int i = startIndex; i <= until; i++) {
            BacktestCandle candle = candles.get(i);
            if (pool.side() == SweepSide.HIGH) {
                if (candle.high().compareTo(extreme) > 0) {
                    extreme = candle.high();
                    extremeTime = candle.timestamp();
                    extremeIndex = i;
                }
                if (config.sweepRequiresReclaim() && candle.close().compareTo(pool.levelPrice()) < 0) {
                    reclaimed = true;
                    endIndex = i;
                    break;
                }
            } else {
                if (candle.low().compareTo(extreme) < 0) {
                    extreme = candle.low();
                    extremeTime = candle.timestamp();
                    extremeIndex = i;
                }
                if (config.sweepRequiresReclaim() && candle.close().compareTo(pool.levelPrice()) > 0) {
                    reclaimed = true;
                    endIndex = i;
                    break;
                }
            }
        }

        if (config.sweepRequiresReclaim() && !reclaimed) {
            return null;
        }

        BigDecimal depth = pool.side() == SweepSide.HIGH
                ? extreme.subtract(pool.levelPrice()).abs()
                : pool.levelPrice().subtract(extreme).abs();
        if (depth.compareTo(minDepthAbs) < 0) {
            return null;
        }
        int durationBars = Math.max(1, endIndex - startIndex + 1);

        return new Sweep(
                pool.side(),
                pool.levelPrice(),
                depth,
                extreme,
                extremeTime,
                pool.id(),
                pool.type(),
                firstBreachPrice,
                firstBreachTime,
                startIndex,
                durationBars,
                reclaimed,
                config.confirmationTf().name(),
                endIndex,
                extremeIndex,
                pool.createdIndex(),
                pool.createdTime(),
                pool.sourceSessionName(),
                rankScore
        );
    }

    private double computePoolRankScore(LiquidityPoolCandidate pool, String rankRule, BigDecimal referenceClose) {
        String normalizedRule = normalizeToken(rankRule);
        double touches = Math.max(1, pool.touches());
        double significance = pool.significance() == null ? 0.0 : pool.significance().doubleValue();
        double distance = referenceClose == null ? 0.0 : referenceClose.subtract(pool.levelPrice()).abs().doubleValue();
        double recency = Math.max(0, pool.createdIndex());
        if ("MOSTTOUCHESTHENRECENCY".equals(normalizedRule) || "TOUCHCOUNT".equals(normalizedRule)) {
            return touches * 1_000_000d + recency;
        }
        if ("LARGESTSWING".equals(normalizedRule)) {
            return significance * 1_000_000d + touches * 100d;
        }
        if ("NEARESTRECENT".equals(normalizedRule)) {
            return -distance + recency * 0.001d;
        }
        return touches * 10_000d + significance * 1_000d;
    }

    private List<LiquidityPoolCandidate> resolveActivePools(List<LiquidityPoolCandidate> pools,
                                                            ParsedConfig config,
                                                            int index) {
        if (pools == null || pools.isEmpty()) {
            return List.of();
        }
        int minAge = Math.max(0, config.poolMinAgeBars());
        List<LiquidityPoolCandidate> active = new ArrayList<>();
        for (LiquidityPoolCandidate pool : pools) {
            if (pool.createdIndex() > index - minAge) {
                continue;
            }
            active.add(pool);
        }
        return active;
    }

    private boolean isPoolConsumedBeforeIndex(LiquidityPoolCandidate pool,
                                              List<BacktestCandle> candles,
                                              int currentIndex,
                                              BigDecimal touchBufferAbs,
                                              BigDecimal minSweepDepthAbs) {
        if (pool == null || candles == null || candles.isEmpty() || currentIndex <= 0) {
            return false;
        }
        int from = Math.max(0, pool.createdIndex());
        int until = Math.min(currentIndex - 1, candles.size() - 1);
        if (from > until) {
            return false;
        }

        BigDecimal threshold = pool.side() == SweepSide.HIGH
                ? pool.levelPrice().add(touchBufferAbs).add(minSweepDepthAbs)
                : pool.levelPrice().subtract(touchBufferAbs).subtract(minSweepDepthAbs);
        for (int i = from; i <= until; i++) {
            BacktestCandle candle = candles.get(i);
            if (pool.side() == SweepSide.HIGH) {
                if (candle.high().compareTo(threshold) >= 0) {
                    return true;
                }
            } else if (candle.low().compareTo(threshold) <= 0) {
                return true;
            }
        }
        return false;
    }

    private List<LiquidityPoolCandidate> buildContextPools(List<BacktestCandle> candles,
                                                           ParsedConfig config,
                                                           Map<String, List<SessionLevelRecord>> sessionLevelRecords,
                                                           Map<LocalDate, DayStats> dailyStats,
                                                           Map<LocalDate, WeekStats> weeklyStats) {
        List<LiquidityPoolCandidate> pools = new ArrayList<>();
        Map<LocalDate, Integer> firstIndexByDay = dailyFirstIndex(candles);
        Map<LocalDate, Integer> firstIndexByWeek = new LinkedHashMap<>();
        for (int i = 0; i < candles.size(); i++) {
            LocalDate day = candles.get(i).timestamp().atZoneSameInstant(ZoneOffset.UTC).toLocalDate();
            LocalDate week = day.minusDays((day.getDayOfWeek().getValue() + 6L) % 7L);
            firstIndexByWeek.putIfAbsent(week, i);
        }

        for (Map.Entry<String, List<SessionLevelRecord>> entry : sessionLevelRecords.entrySet()) {
            String normalizedSession = normalizeSessionName(entry.getKey());
            String highType = sessionPoolTypeHigh(normalizedSession);
            String lowType = sessionPoolTypeLow(normalizedSession);
            for (SessionLevelRecord record : entry.getValue()) {
                int createdIndex = Math.max(0, record.lastIndex() + 1);
                BigDecimal significance = record.high().subtract(record.low()).abs();
                if (config.poolTypesEnabled().contains(highType)) {
                    pools.add(new LiquidityPoolCandidate(
                            "POOL-" + highType + "-" + record.sessionDate(),
                            highType,
                            SweepSide.HIGH,
                            record.high(),
                            1,
                            createdIndex,
                            record.lastTime(),
                            significance,
                            normalizedSession
                    ));
                }
                if (config.poolTypesEnabled().contains(lowType)) {
                    pools.add(new LiquidityPoolCandidate(
                            "POOL-" + lowType + "-" + record.sessionDate(),
                            lowType,
                            SweepSide.LOW,
                            record.low(),
                            1,
                            createdIndex,
                            record.lastTime(),
                            significance,
                            normalizedSession
                    ));
                }
            }
        }

        if (config.poolTypesEnabled().contains("PDH") || config.poolTypesEnabled().contains("PDL")) {
            for (Map.Entry<LocalDate, Integer> entry : firstIndexByDay.entrySet()) {
                LocalDate day = entry.getKey();
                LocalDate previous = day.minusDays(1);
                DayStats stats = dailyStats.get(previous);
                if (stats == null) {
                    continue;
                }
                BigDecimal significance = stats.high().subtract(stats.low()).abs();
                if (config.poolTypesEnabled().contains("PDH")) {
                    pools.add(new LiquidityPoolCandidate(
                            "POOL-PDH-" + day,
                            "PDH",
                            SweepSide.HIGH,
                            stats.high(),
                            1,
                            entry.getValue(),
                            timestampAtIndex(candles, entry.getValue()),
                            significance,
                            null
                    ));
                }
                if (config.poolTypesEnabled().contains("PDL")) {
                    pools.add(new LiquidityPoolCandidate(
                            "POOL-PDL-" + day,
                            "PDL",
                            SweepSide.LOW,
                            stats.low(),
                            1,
                            entry.getValue(),
                            timestampAtIndex(candles, entry.getValue()),
                            significance,
                            null
                    ));
                }
            }
        }

        if (config.poolTypesEnabled().contains("PWH") || config.poolTypesEnabled().contains("PWL")) {
            for (Map.Entry<LocalDate, Integer> entry : firstIndexByWeek.entrySet()) {
                LocalDate week = entry.getKey();
                LocalDate previous = week.minusWeeks(1);
                WeekStats stats = weeklyStats.get(previous);
                if (stats == null) {
                    continue;
                }
                BigDecimal significance = stats.high().subtract(stats.low()).abs();
                if (config.poolTypesEnabled().contains("PWH")) {
                    pools.add(new LiquidityPoolCandidate(
                            "POOL-PWH-" + week,
                            "PWH",
                            SweepSide.HIGH,
                            stats.high(),
                            1,
                            entry.getValue(),
                            timestampAtIndex(candles, entry.getValue()),
                            significance,
                            null
                    ));
                }
                if (config.poolTypesEnabled().contains("PWL")) {
                    pools.add(new LiquidityPoolCandidate(
                            "POOL-PWL-" + week,
                            "PWL",
                            SweepSide.LOW,
                            stats.low(),
                            1,
                            entry.getValue(),
                            timestampAtIndex(candles, entry.getValue()),
                            significance,
                            null
                    ));
                }
            }
        }

        return pools;
    }

    private List<LiquidityPoolCandidate> buildEqPools(List<BacktestCandle> candles, ParsedConfig config) {
        boolean eqhEnabled = config.poolTypesEnabled().contains("EQH");
        boolean eqlEnabled = config.poolTypesEnabled().contains("EQL");
        if (!eqhEnabled && !eqlEnabled) {
            return List.of();
        }

        List<BacktestCandle> detectionCandles = candles;
        BacktestTimeframe detectTf = config.poolTimeframeForDetection();
        if (detectTf != null
                && detectTf.duration().compareTo(config.executionTimeframeRequested().duration()) > 0) {
            detectionCandles = resampleCandles(candles, detectTf);
        }

        int pivotN = Math.max(1, config.swingPivotN());
        PivotMarkers markers = detectPivotMarkers(detectionCandles, pivotN, pivotN);
        BigDecimal tolerance = config.poolTouchTolerancePips().multiply(config.pipSize());
        int minSeparation = Math.max(0, config.poolMinSeparationBars());
        int minTouches = Math.max(2, config.poolMinTouches());

        List<LiquidityPoolCandidate> pools = new ArrayList<>();
        if (eqhEnabled) {
            List<PoolCluster> clusters = new ArrayList<>();
            for (int i = 0; i < detectionCandles.size(); i++) {
                if (!markers.pivotHigh()[i]) {
                    continue;
                }
                BigDecimal price = detectionCandles.get(i).high();
                PoolCluster matched = null;
                for (PoolCluster cluster : clusters) {
                    if (price.subtract(cluster.level()).abs().compareTo(tolerance) <= 0
                            && i - cluster.lastTouchIndex() >= minSeparation) {
                        matched = cluster;
                        break;
                    }
                }
                if (matched == null) {
                    clusters.add(PoolCluster.seed(i, price, detectionCandles.get(i).timestamp()));
                } else {
                    matched.touch(i, price, detectionCandles.get(i).timestamp());
                }
            }
            for (PoolCluster cluster : clusters) {
                if (cluster.touches() < minTouches) {
                    continue;
                }
                int createdIndex = findCandleIndexAtOrAfter(candles, cluster.lastTouchTime());
                if (createdIndex < 0) {
                    continue;
                }
                pools.add(new LiquidityPoolCandidate(
                        "POOL-EQH-" + cluster.lastTouchTime(),
                        "EQH",
                        SweepSide.HIGH,
                        cluster.level(),
                        cluster.touches(),
                        createdIndex,
                        cluster.lastTouchTime(),
                        cluster.significance(),
                        null
                ));
            }
        }
        if (eqlEnabled) {
            List<PoolCluster> clusters = new ArrayList<>();
            for (int i = 0; i < detectionCandles.size(); i++) {
                if (!markers.pivotLow()[i]) {
                    continue;
                }
                BigDecimal price = detectionCandles.get(i).low();
                PoolCluster matched = null;
                for (PoolCluster cluster : clusters) {
                    if (price.subtract(cluster.level()).abs().compareTo(tolerance) <= 0
                            && i - cluster.lastTouchIndex() >= minSeparation) {
                        matched = cluster;
                        break;
                    }
                }
                if (matched == null) {
                    clusters.add(PoolCluster.seed(i, price, detectionCandles.get(i).timestamp()));
                } else {
                    matched.touch(i, price, detectionCandles.get(i).timestamp());
                }
            }
            for (PoolCluster cluster : clusters) {
                if (cluster.touches() < minTouches) {
                    continue;
                }
                int createdIndex = findCandleIndexAtOrAfter(candles, cluster.lastTouchTime());
                if (createdIndex < 0) {
                    continue;
                }
                pools.add(new LiquidityPoolCandidate(
                        "POOL-EQL-" + cluster.lastTouchTime(),
                        "EQL",
                        SweepSide.LOW,
                        cluster.level(),
                        cluster.touches(),
                        createdIndex,
                        cluster.lastTouchTime(),
                        cluster.significance(),
                        null
                ));
            }
        }

        return pools;
    }

    private PivotMarkers detectPivotMarkers(List<BacktestCandle> candles, int left, int right) {
        int n = candles.size();
        boolean[] pivotHigh = new boolean[n];
        boolean[] pivotLow = new boolean[n];
        int l = Math.max(1, left);
        int r = Math.max(1, right);
        for (int i = l; i < n - r; i++) {
            boolean isPivotHigh = true;
            boolean isPivotLow = true;
            BigDecimal h = candles.get(i).high();
            BigDecimal lo = candles.get(i).low();
            for (int j = i - l; j <= i + r; j++) {
                if (j == i) {
                    continue;
                }
                if (candles.get(j).high().compareTo(h) >= 0) {
                    isPivotHigh = false;
                }
                if (candles.get(j).low().compareTo(lo) <= 0) {
                    isPivotLow = false;
                }
                if (!isPivotHigh && !isPivotLow) {
                    break;
                }
            }
            pivotHigh[i] = isPivotHigh;
            pivotLow[i] = isPivotLow;
        }
        return new PivotMarkers(pivotHigh, pivotLow);
    }

    private StructureContext deriveStructureContext(List<BacktestCandle> candles,
                                                    PivotMarkers markers,
                                                    int index,
                                                    ParsedConfig config) {
        if (candles == null || candles.isEmpty() || markers == null) {
            return StructureContext.empty();
        }
        int safeIndex = Math.max(0, Math.min(index, candles.size() - 1));
        BigDecimal minDistanceAbs = config.minSwingDistancePips()
                .multiply(config.pipSize())
                .abs();
        int minSeparation = Math.max(1, config.minSwingSeparationBars());

        SwingPair highs = lastTwoConfirmedSwings(candles, markers.pivotHigh(), safeIndex, true, minDistanceAbs, minSeparation);
        SwingPair lows = lastTwoConfirmedSwings(candles, markers.pivotLow(), safeIndex, false, minDistanceAbs, minSeparation);

        String highLabel = deriveSwingLabel(highs.previousPrice(), highs.latestPrice(), "HH", "LH");
        String lowLabel = deriveSwingLabel(lows.previousPrice(), lows.latestPrice(), "HL", "LL");
        String trend;
        if ("HH".equals(highLabel) && "HL".equals(lowLabel)) {
            trend = "BULLISH";
        } else if ("LH".equals(highLabel) && "LL".equals(lowLabel)) {
            trend = "BEARISH";
        } else {
            trend = "MIXED";
        }
        return new StructureContext(
                highs.previousPrice(),
                highs.latestPrice(),
                highLabel,
                lows.previousPrice(),
                lows.latestPrice(),
                lowLabel,
                trend
        );
    }

    private SwingPair lastTwoConfirmedSwings(List<BacktestCandle> candles,
                                             boolean[] markers,
                                             int index,
                                             boolean highs,
                                             BigDecimal minDistanceAbs,
                                             int minSeparationBars) {
        int latestIndex = -1;
        BigDecimal latestPrice = null;
        int previousIndex = -1;
        BigDecimal previousPrice = null;

        int from = Math.min(index, Math.min(markers.length, candles.size()) - 1);
        for (int i = from; i >= 0; i--) {
            if (!markers[i]) {
                continue;
            }
            BigDecimal price = highs ? candles.get(i).high() : candles.get(i).low();
            if (latestIndex < 0) {
                latestIndex = i;
                latestPrice = price;
                continue;
            }
            if (latestIndex - i < minSeparationBars) {
                continue;
            }
            if (latestPrice != null && latestPrice.subtract(price).abs().compareTo(minDistanceAbs) < 0) {
                continue;
            }
            previousIndex = i;
            previousPrice = price;
            break;
        }
        return new SwingPair(previousIndex, previousPrice, latestIndex, latestPrice);
    }

    private String deriveSwingLabel(BigDecimal previousPrice,
                                    BigDecimal latestPrice,
                                    String higherLabel,
                                    String lowerLabel) {
        if (previousPrice == null || latestPrice == null) {
            return "N/A";
        }
        int cmp = latestPrice.compareTo(previousPrice);
        if (cmp > 0) {
            return higherLabel;
        }
        if (cmp < 0) {
            return lowerLabel;
        }
        return "EQ";
    }

    private Map<String, List<SessionLevelRecord>> buildSessionLevelRecords(List<BacktestCandle> candles, List<SessionWindow> sessions) {
        Map<String, List<SessionLevelRecord>> out = new LinkedHashMap<>();
        for (SessionWindow session : sessions) {
            if (!session.canGeneratePools()) {
                continue;
            }
            Map<LocalDate, SessionLevelMutable> grouped = new LinkedHashMap<>();
            for (int i = 0; i < candles.size(); i++) {
                BacktestCandle candle = candles.get(i);
                SessionStamp stamp = assignSession(candle.timestamp(), session);
                if (stamp == null) {
                    continue;
                }
                SessionLevelMutable stats = grouped.computeIfAbsent(stamp.sessionDateKey(), ignored -> new SessionLevelMutable());
                stats.include(candle.high(), candle.low(), i, candle.timestamp());
            }
            List<SessionLevelRecord> rows = new ArrayList<>();
            for (Map.Entry<LocalDate, SessionLevelMutable> entry : grouped.entrySet()) {
                SessionLevelMutable stats = entry.getValue();
                if (stats.high == null || stats.low == null) {
                    continue;
                }
                rows.add(new SessionLevelRecord(
                        normalizeSessionName(session.name()),
                        entry.getKey(),
                        stats.high,
                        stats.low,
                        stats.firstIndex,
                        stats.lastIndex,
                        stats.firstTime,
                        stats.lastTime
                ));
            }
            rows.sort(Comparator.comparing(SessionLevelRecord::lastTime));
            out.put(normalizeSessionName(session.name()), rows);
        }
        return out;
    }

    private Map<LocalDate, Integer> dailyFirstIndex(List<BacktestCandle> candles) {
        Map<LocalDate, Integer> out = new LinkedHashMap<>();
        for (int i = 0; i < candles.size(); i++) {
            LocalDate day = candles.get(i).timestamp().atZoneSameInstant(ZoneOffset.UTC).toLocalDate();
            out.putIfAbsent(day, i);
        }
        return out;
    }

    private String sessionPoolTypeHigh(String sessionName) {
        return normalizeSessionPoolBase(sessionName) + "_H";
    }

    private String sessionPoolTypeLow(String sessionName) {
        return normalizeSessionPoolBase(sessionName) + "_L";
    }

    private String normalizeSessionPoolBase(String sessionName) {
        String normalized = normalizeSessionName(sessionName);
        if ("NY".equals(normalized)) {
            return "NY_AM";
        }
        return normalized;
    }

    private String normalizeSessionName(String sessionName) {
        if (sessionName == null || sessionName.isBlank()) {
            return "";
        }
        return sessionName.trim().toUpperCase(Locale.ROOT).replace('-', '_');
    }

    private boolean matchesConfiguredSweepType(String configuredSweepType, String poolType) {
        if (configuredSweepType == null || configuredSweepType.isBlank()) {
            return true;
        }
        if ("SESSION_HL".equals(configuredSweepType) || "ANY".equals(configuredSweepType) || "AUTO".equals(configuredSweepType)) {
            return true;
        }
        return configuredSweepType.equals(normalizeSessionName(poolType));
    }

    private String normalizeToken(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }

    private List<SessionWindow> resolveEvaluationSessions(ParsedConfig config, SessionWindow fallback) {
        Map<String, SessionWindow> byName = new LinkedHashMap<>();
        for (SessionWindow session : config.sessions()) {
            if (session.canFilterEvaluation()) {
                byName.put(normalizeSessionName(session.name()), session);
            }
        }
        List<SessionWindow> out = new ArrayList<>();
        Set<String> requested = config.evaluationSessions();
        if (requested != null && !requested.isEmpty()) {
            for (String name : requested) {
                SessionWindow session = byName.get(normalizeSessionName(name));
                if (session != null) {
                    out.add(session);
                }
            }
        }
        if (!out.isEmpty()) {
            return out;
        }
        if (fallback != null && fallback.canFilterEvaluation()) {
            return List.of(fallback);
        }
        return config.sessions().stream().filter(SessionWindow::canFilterEvaluation).findFirst().map(List::of).orElse(List.of());
    }

    private List<SessionWindow> resolveEntrySessions(ParsedConfig config, SessionWindow fallback) {
        Map<String, SessionWindow> byName = new LinkedHashMap<>();
        for (SessionWindow session : config.sessions()) {
            if (session.canFilterEntry()) {
                byName.put(normalizeSessionName(session.name()), session);
            }
        }
        List<SessionWindow> out = new ArrayList<>();
        Set<String> requested = config.entrySessions();
        if (requested != null && !requested.isEmpty()) {
            for (String name : requested) {
                SessionWindow session = byName.get(normalizeSessionName(name));
                if (session != null) {
                    out.add(session);
                }
            }
        }
        if (!out.isEmpty()) {
            return out;
        }
        if (fallback != null && fallback.canFilterEntry()) {
            return List.of(fallback);
        }
        return config.sessions().stream().filter(SessionWindow::canFilterEntry).findFirst().map(List::of).orElse(List.of());
    }

    private boolean isWithinKillzone(OffsetDateTime ts, String sessionName, ParsedConfig config) {
        if (ts == null || sessionName == null || config == null) {
            return false;
        }
        SessionWindow window = config.killzoneWindowsUtc().get(normalizeSessionName(sessionName));
        if (window == null) {
            return true;
        }
        SessionStamp stamp = assignSession(ts, window);
        return stamp != null;
    }

    private int findCandleIndexAtOrAfter(List<BacktestCandle> candles, OffsetDateTime ts) {
        if (candles == null || candles.isEmpty() || ts == null) {
            return -1;
        }
        int left = 0;
        int right = candles.size() - 1;
        int answer = -1;
        while (left <= right) {
            int mid = (left + right) >>> 1;
            OffsetDateTime midTs = candles.get(mid).timestamp();
            if (midTs == null) {
                break;
            }
            if (!midTs.isBefore(ts)) {
                answer = mid;
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        }
        return answer < 0 ? candles.size() - 1 : answer;
    }

    private OffsetDateTime timestampAtIndex(List<BacktestCandle> candles, Integer index) {
        if (candles == null || candles.isEmpty() || index == null) {
            return null;
        }
        int safe = Math.max(0, Math.min(index, candles.size() - 1));
        return candles.get(safe).timestamp();
    }

    private PivotState computePivots(List<BacktestCandle> candles, int left, int right) {
        int n = candles.size();
        boolean[] pivotHigh = new boolean[n];
        boolean[] pivotLow = new boolean[n];

        int l = Math.max(1, left);
        int r = Math.max(1, right);
        for (int i = l; i < n - r; i++) {
            boolean isPivotHigh = true;
            boolean isPivotLow = true;
            BigDecimal h = candles.get(i).high();
            BigDecimal lo = candles.get(i).low();

            for (int j = i - l; j <= i + r; j++) {
                if (j == i) {
                    continue;
                }
                if (candles.get(j).high().compareTo(h) >= 0) {
                    isPivotHigh = false;
                }
                if (candles.get(j).low().compareTo(lo) <= 0) {
                    isPivotLow = false;
                }
                if (!isPivotHigh && !isPivotLow) {
                    break;
                }
            }
            pivotHigh[i] = isPivotHigh;
            pivotLow[i] = isPivotLow;
        }

        BigDecimal[] lastPivotHigh = new BigDecimal[n];
        BigDecimal[] lastPivotLow = new BigDecimal[n];
        BigDecimal currentHigh = null;
        BigDecimal currentLow = null;
        for (int i = 0; i < n; i++) {
            if (pivotHigh[i]) {
                currentHigh = candles.get(i).high();
            }
            if (pivotLow[i]) {
                currentLow = candles.get(i).low();
            }
            lastPivotHigh[i] = currentHigh;
            lastPivotLow[i] = currentLow;
        }

        return new PivotState(lastPivotHigh, lastPivotLow);
    }

    private Map<LocalDate, SessionStats> computeSessionStats(List<BacktestCandle> candles, SessionWindow window) {
        Map<LocalDate, SessionStatsMutable> mutable = new LinkedHashMap<>();
        for (BacktestCandle candle : candles) {
            SessionStamp stamp = assignSession(candle.timestamp(), window);
            if (stamp == null) {
                continue;
            }
            SessionStatsMutable stats = mutable.computeIfAbsent(stamp.sessionDateKey(), ignored -> new SessionStatsMutable());
            stats.include(candle.high(), candle.low());
        }

        Map<LocalDate, SessionStats> out = new LinkedHashMap<>();
        for (Map.Entry<LocalDate, SessionStatsMutable> entry : mutable.entrySet()) {
            out.put(entry.getKey(), new SessionStats(entry.getValue().high, entry.getValue().low));
        }
        return out;
    }

    private Map<LocalDate, DayStats> computeDailyStats(List<BacktestCandle> candles) {
        Map<LocalDate, DayStatsMutable> mutable = new LinkedHashMap<>();
        for (BacktestCandle candle : candles) {
            LocalDate day = candle.timestamp().atZoneSameInstant(ZoneOffset.UTC).toLocalDate();
            DayStatsMutable stats = mutable.computeIfAbsent(day, ignored -> new DayStatsMutable());
            stats.include(candle.high(), candle.low());
        }

        Map<LocalDate, DayStats> out = new LinkedHashMap<>();
        for (Map.Entry<LocalDate, DayStatsMutable> entry : mutable.entrySet()) {
            out.put(entry.getKey(), new DayStats(entry.getValue().high, entry.getValue().low));
        }
        return out;
    }

    private Map<LocalDate, WeekStats> computeWeeklyStats(Map<LocalDate, DayStats> dailyStats) {
        Map<LocalDate, WeekStatsMutable> mutable = new LinkedHashMap<>();
        for (Map.Entry<LocalDate, DayStats> entry : dailyStats.entrySet()) {
            LocalDate week = entry.getKey().minusDays((entry.getKey().getDayOfWeek().getValue() + 6L) % 7L);
            WeekStatsMutable stats = mutable.computeIfAbsent(week, ignored -> new WeekStatsMutable());
            stats.include(entry.getValue().high(), entry.getValue().low());
        }
        Map<LocalDate, WeekStats> out = new LinkedHashMap<>();
        for (Map.Entry<LocalDate, WeekStatsMutable> entry : mutable.entrySet()) {
            out.put(entry.getKey(), new WeekStats(entry.getValue().high, entry.getValue().low));
        }
        return out;
    }

    private List<BacktestCandle> loadDailyCandles(UUID userId,
                                                  List<BacktestDataset> datasets,
                                                  BacktestDataset sourceDataset,
                                                  OffsetDateTime fromUtc,
                                                  OffsetDateTime toUtc,
                                                  List<BacktestCandle> executionCandles) {
        BacktestDataset d1 = datasets.stream()
                .filter(item -> item.getTimeframe() == BacktestTimeframe.D1)
                .findFirst()
                .orElse(null);
        if (d1 != null) {
            return loadDatasetCandles(userId, d1, fromUtc.minusDays(3), toUtc.plusDays(1));
        }
        return aggregateToDaily(executionCandles);
    }

    private List<BacktestCandle> aggregateToDaily(List<BacktestCandle> candles) {
        Map<LocalDate, AggState> byDay = new LinkedHashMap<>();
        for (BacktestCandle candle : candles) {
            LocalDate day = candle.timestamp().atZoneSameInstant(ZoneOffset.UTC).toLocalDate();
            AggState state = byDay.computeIfAbsent(day, ignored -> new AggState());
            state.include(candle);
        }
        List<BacktestCandle> out = new ArrayList<>();
        for (Map.Entry<LocalDate, AggState> entry : byDay.entrySet()) {
            AggState state = entry.getValue();
            out.add(new BacktestCandle(
                    entry.getKey().atStartOfDay().atOffset(ZoneOffset.UTC),
                    state.open,
                    state.high,
                    state.low,
                    state.close,
                    state.volume
            ));
        }
        return out;
    }

    private List<BacktestCandle> loadDatasetCandles(UUID userId,
                                                    BacktestDataset dataset,
                                                    OffsetDateTime fromUtc,
                                                    OffsetDateTime toUtc) {
        return candleDataService.getCandles(
                userId,
                dataset.getProvider().name(),
                dataset.getSourceId(),
                dataset.getSymbolDisplay(),
                dataset.getTimeframe().name(),
                fromUtc,
                toUtc,
                false
        );
    }

    private List<BacktestCandle> resampleCandles(List<BacktestCandle> candles, BacktestTimeframe targetTimeframe) {
        if (candles.isEmpty()) {
            return candles;
        }

        long bucketSeconds = targetTimeframe.duration().toSeconds();
        Map<Long, AggState> buckets = new LinkedHashMap<>();

        for (BacktestCandle candle : candles) {
            long epochSec = candle.timestamp().toEpochSecond();
            long bucketStart = (epochSec / bucketSeconds) * bucketSeconds;
            AggState agg = buckets.computeIfAbsent(bucketStart, ignored -> new AggState());
            agg.include(candle);
        }

        List<BacktestCandle> out = new ArrayList<>();
        for (Map.Entry<Long, AggState> entry : buckets.entrySet()) {
            AggState agg = entry.getValue();
            out.add(new BacktestCandle(
                    OffsetDateTime.ofInstant(Instant.ofEpochSecond(entry.getKey()), ZoneOffset.UTC),
                    agg.open,
                    agg.high,
                    agg.low,
                    agg.close,
                    agg.volume
            ));
        }
        return out;
    }

    private DatasetSelection chooseExecutionDataset(List<BacktestDataset> datasets, BacktestTimeframe requestedTimeframe) {
        List<BacktestDataset> sorted = datasets.stream()
                .sorted(Comparator.comparing(item -> item.getTimeframe().duration()))
                .toList();
        BacktestDataset canonical = sorted.get(0);
        BacktestTimeframe requested = requestedTimeframe == null ? canonical.getTimeframe() : requestedTimeframe;
        BacktestTimeframe execution = requested;

        // Lower-than-canonical execution TF cannot be derived safely.
        if (canonical.getTimeframe().duration().compareTo(execution.duration()) > 0) {
            execution = canonical.getTimeframe();
        }
        return new DatasetSelection(
                canonical,
                execution,
                canonical.getTimeframe() != execution,
                rangeMin(canonical),
                rangeMax(canonical)
        );
    }

    private ParsedConfig parseConfig(BacktestStrategyConfig strategyConfig, BacktestDatasetSet set) {
        JsonNode root = strategyConfig.getConfigJson() == null ? JsonNodeFactory.instance.objectNode() : strategyConfig.getConfigJson();
        JsonNode smc = path(root, "smc");

        String timezoneBasis = text(
                firstPresent(
                        path(root, "context", "timezoneBasis"),
                        path(smc, "sessionTimezone"),
                        path(smc, "session_timezone")
                ),
                set.getTimezoneBasis()
        );

        BacktestTimeframe executionTf = parseTimeframe(
                firstPresent(
                        path(root, "context", "executionTimeframe"),
                        path(smc, "executionTf"),
                        path(smc, "execution_tf"),
                        path(smc, "executionTimeframe"),
                        path(smc, "execution_timeframe")
                ),
                BacktestTimeframe.M5
        );
        BacktestTimeframe contextTf = parseTimeframe(
                firstPresent(path(smc, "contextTf"), path(smc, "context_tf")),
                executionTf
        );

        List<SessionWindow> sessions = parseSessions(root, timezoneBasis);
        Set<String> sessionsEnabled = parseStringSet(
                firstPresent(path(smc, "sessionsEnabled"), path(smc, "sessions_enabled")),
                Set.of("ASIA", "LONDON", "NY_AM", "NY_PM")
        );
        if (!sessionsEnabled.isEmpty()) {
            sessions = sessions.stream()
                    .filter(item -> sessionsEnabled.contains(normalizeSessionName(item.name())))
                    .toList();
        }
        sessions = sessions.stream().filter(SessionWindow::enabled).toList();
        if (sessions.isEmpty()) {
            sessions = defaultSessions(timezoneBasis);
        }

        Set<String> evaluationSessions = parseStringSet(
                firstPresent(path(smc, "evaluationSessionFilter"), path(smc, "evaluation_session_filter")),
                Set.of(normalizeSessionName(text(path(root, "setupRule", "session"), "LONDON"))
                )
        );
        Set<String> entrySessions = parseStringSet(
                firstPresent(path(smc, "entrySessions"), path(smc, "entry_sessions")),
                evaluationSessions
        );
        Set<String> sweepSourceSessions = parseStringSet(
                firstPresent(
                        path(smc, "poolSourceSessions"),
                        path(smc, "pool_source_sessions"),
                        path(smc, "sweepSourceSessions"),
                        path(smc, "sweep_source_sessions")
                ),
                Set.of("ASIA", "LONDON", "NY_AM")
        );

        Set<String> poolTypesEnabled = parseStringSet(
                firstPresent(path(smc, "poolTypesEnabled"), path(smc, "pool_types_enabled")),
                Set.of("EQH", "EQL", "ASIA_H", "ASIA_L", "LONDON_H", "LONDON_L", "NY_AM_H", "NY_AM_L", "PDH", "PDL", "PWH", "PWL")
        );

        BacktestTimeframe poolTf = parseTimeframe(
                firstPresent(
                        path(smc, "poolTf"),
                        path(smc, "pool_tf"),
                        path(smc, "poolTimeframeForDetection"),
                        path(smc, "pool_timeframe_for_detection")
                ),
                BacktestTimeframe.M15
        );
        BacktestTimeframe confirmationTf = parseTimeframe(
                firstPresent(
                        path(smc, "confirmationTf"),
                        path(smc, "confirmation_tf"),
                        path(root, "setupRule", "confirmationTf"),
                        path(root, "setupRule", "confirmation_tf")
                ),
                executionTf
        );
        BacktestTimeframe entryTf = parseTimeframe(
                firstPresent(path(smc, "entryTf"), path(smc, "entry_tf")),
                confirmationTf
        );
        BacktestTimeframe displacementTf = parseTimeframe(
                firstPresent(path(smc, "displacementTimeframe"), path(smc, "displacement_timeframe")),
                confirmationTf
        );
        BacktestTimeframe mssTf = parseTimeframe(
                firstPresent(
                        path(smc, "mssTf"),
                        path(smc, "mss_tf"),
                        path(smc, "structureTimeframe"),
                        path(smc, "structure_timeframe")
                ),
                confirmationTf
        );
        boolean allowNonHierarchicalTimeframes = bool(
                firstPresent(path(smc, "allowNonHierarchicalTimeframes"), path(smc, "allow_non_hierarchical_timeframes")),
                false
        );
        boolean requireCrossSessionSweep = bool(
                firstPresent(path(smc, "requireCrossSessionSweep"), path(smc, "require_cross_session_sweep")),
                false
        );
        boolean requireSameSessionForSweepAndEntry = bool(
                firstPresent(path(smc, "requireSameSessionForSweepAndEntry"), path(smc, "require_same_session_for_sweep_and_entry")),
                false
        );
        boolean sweepRequiresUnsweptPool = bool(
                firstPresent(path(smc, "sweepRequiresUnsweptPool"), path(smc, "sweep_requires_unswept_pool")),
                true
        );
        Map<String, SessionWindow> killzoneWindowsUtc = parseKillzoneWindows(smc);
        int displacementNoOverlapBars = integer(
                firstPresent(path(smc, "displacementNoInstantOverlapBars"), path(smc, "displacement_no_instant_overlap_bars")),
                bool(firstPresent(path(smc, "displacementNoInstantOverlap"), path(smc, "displacement_no_instant_overlap")), false) ? 1 : 0
        );
        int mssMaxConfirmWindowBars = integer(
                firstPresent(path(smc, "mssMaxConfirmWindowBars"), path(smc, "mss_max_confirm_window_bars")),
                integer(firstPresent(path(smc, "mssMaxDelayBarsAfterDisplacement"), path(smc, "mss_max_delay_bars_after_displacement")), 8)
        );
        String mssBreakMode = text(firstPresent(path(smc, "mssBreakMode"), path(smc, "mss_break_mode")), "CLOSE_ONLY");
        boolean mssRequiresClose = bool(
                firstPresent(path(smc, "mssRequiresClose"), path(smc, "mss_requires_close")),
                !"WICKALLOWED".equals(normalizeToken(mssBreakMode))
        );
        String bosBreakMode = text(firstPresent(path(smc, "bosBreakMode"), path(smc, "bos_break_mode")), "CLOSE_ONLY");

        BigDecimal legacyDisplacementMult = decimal(path(root, "qualityFilters", "displacementMultiplier"), BigDecimal.valueOf(1.5));

        ParsedConfig parsed = new ParsedConfig(
                text(path(root, "name"), STRATEGY_DEFAULT_NAME),
                decimal(path(root, "context", "pipSize"), inferPipSize(set.getInstrument())),
                decimal(path(root, "context", "spreadPips"), BigDecimal.valueOf(0.8)),
                decimal(path(root, "context", "slippagePips"), BigDecimal.valueOf(0.3)),
                decimal(path(root, "context", "touchTolerancePips"), BigDecimal.valueOf(0.5)),
                timezoneBasis,
                executionTf,
                sessions,
                text(path(root, "setupRule", "session"), "LONDON"),
                text(path(root, "setupRule", "sweepType"), "ASIA_H"),
                text(path(root, "setupRule", "confirmationType"), "MSS"),
                text(path(root, "setupRule", "direction"), "AUTO_FROM_SWEEP"),
                text(path(root, "entryModel", "type"), "LIMIT_RETRACE_PERCENT"),
                decimal(path(root, "entryModel", "retracePercent"), BigDecimal.valueOf(50)),
                integer(path(root, "entryModel", "entryWindowBars"), 5),
                text(path(root, "riskModel", "stopRule"), "SWEEP_EXTREME_PLUS_BUFFER"),
                decimal(path(root, "riskModel", "fixedR"), BigDecimal.valueOf(2.0)),
                decimal(path(root, "riskModel", "minRR"), BigDecimal.valueOf(2.0)),
                legacyDisplacementMult,
                integer(path(root, "qualityFilters", "bodyLookback"), 20),
                bool(path(root, "qualityFilters", "antiChop"), true),
                integer(path(root, "qualityFilters", "maxTradesPerSession"), 1),
                integer(path(root, "qualityFilters", "maxTradesPerDay"), 3),
                integer(path(root, "qualityFilters", "pivotLeft"), 2),
                integer(path(root, "qualityFilters", "pivotRight"), 2),
                decimal(path(root, "qualityFilters", "confirmBreakBufferPips"), BigDecimal.ZERO),
                normalizeTimezoneBasis(text(firstPresent(path(smc, "sessionTimezone"), path(smc, "session_timezone")), timezoneBasis)),
                evaluationSessions,
                sweepSourceSessions,
                poolTypesEnabled,
                poolTf,
                decimal(firstPresent(path(smc, "poolTouchTolerancePips"), path(smc, "pool_touch_tolerance_pips")), BigDecimal.valueOf(1.0)),
                integer(firstPresent(path(smc, "poolMinTouches"), path(smc, "pool_min_touches")), 2),
                integer(firstPresent(path(smc, "poolMinSeparationBars"), path(smc, "pool_min_separation_bars")), 6),
                integer(firstPresent(path(smc, "poolMinAgeBars"), path(smc, "pool_min_age_bars")), 12),
                text(firstPresent(path(smc, "poolRankRule"), path(smc, "pool_rank_rule")), "MOST_TOUCHES_THEN_RECENCY"),
                decimal(firstPresent(path(smc, "sweepMinDepthPips"), path(smc, "sweep_min_depth_pips")), BigDecimal.valueOf(4.0)),
                integer(firstPresent(path(smc, "sweepMaxDurationBars"), path(smc, "sweep_max_duration_bars")), 5),
                bool(firstPresent(path(smc, "sweepRequiresReclaim"), path(smc, "sweep_requires_reclaim")), true),
                bool(firstPresent(path(smc, "sweepRequiresLiquidityType"), path(smc, "sweep_requires_liquidity_type")), true),
                text(firstPresent(path(smc, "sweepSelectRule"), path(smc, "sweep_select_rule")), "MAX_DEPTH_THEN_BEST_RANKED_POOL"),
                displacementTf,
                integer(firstPresent(path(smc, "displacementMaxDelayBarsAfterSweep"), path(smc, "displacement_max_delay_bars_after_sweep")), 2),
                decimal(firstPresent(path(smc, "displacementMinBodyPips"), path(smc, "displacement_min_body_pips")), BigDecimal.valueOf(6.0)),
                decimal(firstPresent(path(smc, "displacementMinBodyVsAvgMult"), path(smc, "displacement_min_body_vs_avg_mult")), BigDecimal.valueOf(1.8)),
                bool(firstPresent(path(smc, "displacementRequiresCloseBeyondLevel"), path(smc, "displacement_requires_close_beyond_level")), true),
                displacementNoOverlapBars,
                text(firstPresent(path(smc, "displacementType"), path(smc, "displacement_type")), "GAP_OPTIONAL"),
                text(firstPresent(path(smc, "displacementGapDefinition"), path(smc, "displacement_gap_definition")), "THREE_CANDLE_FVG"),
                decimal(firstPresent(path(smc, "displacementGapMinPips"), path(smc, "displacement_gap_min_pips")), BigDecimal.valueOf(2.0)),
                mssTf,
                text(firstPresent(path(smc, "swingDetectionMethod"), path(smc, "swing_detection_method")), "PIVOT_N"),
                integer(firstPresent(path(smc, "swingPivotN"), path(smc, "swing_pivot_n")), Math.max(2, integer(path(root, "qualityFilters", "pivotLeft"), 2))),
                mssRequiresClose,
                integer(firstPresent(path(smc, "mssMinConfirmCandles"), path(smc, "mss_min_confirm_candles")), 3),
                mssMaxConfirmWindowBars,
                text(firstPresent(path(smc, "mssInvalidationRule"), path(smc, "mss_invalidation_rule")), "CLOSE_BACK_THROUGH_LEVEL"),
                text(
                        firstPresent(
                                path(smc, "mssAnchorLevel"),
                                path(smc, "mss_anchor_level"),
                                path(smc, "mssAnchorType"),
                                path(smc, "mss_anchor_type")
                        ),
                        "LAST_SWING_HIGH_LOW"
                ),
                bool(firstPresent(path(smc, "entryRequiresFvgRetest"), path(smc, "entry_requires_fvg_retest")), false),
                bool(firstPresent(path(smc, "entryRequiresDiscountPremium"), path(smc, "entry_requires_discount_premium")), false),
                text(firstPresent(path(smc, "fillPolicy"), path(smc, "fill_policy")), "BID_ASK_SIM"),
                bool(firstPresent(path(smc, "emitDebugFields"), path(smc, "emit_debug_fields")), true),
                bool(firstPresent(path(smc, "storeIntermediateLevels"), path(smc, "store_intermediate_levels")), true),
                bool(firstPresent(path(smc, "requireKillzone"), path(smc, "require_killzone")), true),
                killzoneWindowsUtc,
                bool(firstPresent(path(smc, "retraceRequired"), path(smc, "retrace_required")), true),
                text(firstPresent(path(smc, "retraceReference"), path(smc, "retrace_reference")), "GAP_FILL"),
                decimal(firstPresent(path(smc, "retraceMinPct"), path(smc, "retrace_min_pct")), BigDecimal.valueOf(50)),
                integer(firstPresent(path(smc, "retraceMaxWaitBars"), path(smc, "retrace_max_wait_bars")), 6),
                bool(firstPresent(path(smc, "retraceAcceptWickTouch"), path(smc, "retrace_accept_wick_touch")), true),
                contextTf,
                poolTf,
                confirmationTf,
                entryTf,
                executionTf,
                allowNonHierarchicalTimeframes,
                entrySessions,
                requireCrossSessionSweep,
                requireSameSessionForSweepAndEntry,
                sweepRequiresUnsweptPool,
                bool(firstPresent(path(smc, "bosEnabled"), path(smc, "bos_enabled")), false),
                text(firstPresent(path(smc, "bosAnchorType"), path(smc, "bos_anchor_type")), "LAST_CONFIRMED_SWING"),
                bosBreakMode,
                decimal(firstPresent(path(smc, "bosMinBreakDistancePips"), path(smc, "bos_min_break_distance_pips")), BigDecimal.valueOf(0.5)),
                integer(firstPresent(path(smc, "bosHoldBars"), path(smc, "bos_hold_bars")), 2),
                text(firstPresent(path(smc, "bosDirectionRule"), path(smc, "bos_direction_rule")), "WITH_TREND_ONLY"),
                bool(firstPresent(path(smc, "mssEnabled"), path(smc, "mss_enabled")), true),
                mssBreakMode,
                bool(firstPresent(path(smc, "mssRequiresLiquiditySweep"), path(smc, "mss_requires_liquidity_sweep")), true),
                bool(firstPresent(path(smc, "mssRequiresDisplacement"), path(smc, "mss_requires_displacement")), true),
                decimal(firstPresent(path(smc, "mssMinBreakDistancePips"), path(smc, "mss_min_break_distance_pips")), BigDecimal.valueOf(0.5)),
                text(firstPresent(path(smc, "mssStructureTier"), path(smc, "mss_structure_tier")), "INTERNAL"),
                decimal(firstPresent(path(smc, "minSwingDistancePips"), path(smc, "min_swing_distance_pips")), BigDecimal.valueOf(1.0)),
                integer(firstPresent(path(smc, "minSwingSeparationBars"), path(smc, "min_swing_separation_bars")), 2),
                text(firstPresent(path(smc, "structureTier"), path(smc, "structure_tier")), "BOTH")
        );
        validateTimeframeRoles(parsed);
        return parsed;
    }

    private void validateTimeframeRoles(ParsedConfig config) {
        if (config == null || config.allowNonHierarchicalTimeframes()) {
            return;
        }
        List<String> violations = new ArrayList<>();
        if (config.contextTf().duration().compareTo(config.poolTf().duration()) < 0) {
            violations.add("contextTf must be >= poolTf");
        }
        if (config.poolTf().duration().compareTo(config.confirmationTf().duration()) < 0) {
            violations.add("poolTf must be >= confirmationTf");
        }
        if (config.confirmationTf().duration().compareTo(config.entryTf().duration()) < 0) {
            violations.add("confirmationTf must be >= entryTf");
        }
        if (config.executionTf().duration().compareTo(config.entryTf().duration()) > 0) {
            violations.add("executionTf must be <= entryTf");
        }
        if (!violations.isEmpty()) {
            throw new IllegalArgumentException("Invalid timeframe roles. " + String.join("; ", violations)
                    + ". Enable smc.allowNonHierarchicalTimeframes=true to override.");
        }
    }

    private SessionWindow sessionWindow(String name, String zoneId, LocalTime start, LocalTime end, int displayOrder) {
        return new SessionWindow(
                normalizeSessionName(name),
                normalizeTimezoneBasis(zoneId),
                start,
                end,
                true,
                true,
                true,
                true,
                displayOrder
        );
    }

    private SessionWindow sessionWindow(String name,
                                        String zoneId,
                                        LocalTime start,
                                        LocalTime end,
                                        boolean enabled,
                                        boolean canGeneratePools,
                                        boolean canFilterEvaluation,
                                        boolean canFilterEntry,
                                        int displayOrder) {
        return new SessionWindow(
                normalizeSessionName(name),
                normalizeTimezoneBasis(zoneId),
                start,
                end,
                enabled,
                canGeneratePools,
                canFilterEvaluation,
                canFilterEntry,
                displayOrder
        );
    }

    private Map<String, SessionWindow> parseKillzoneWindows(JsonNode smc) {
        JsonNode windowsNode = firstPresent(path(smc, "killzoneWindowsUtc"), path(smc, "killzone_windows_utc"));
        Map<String, SessionWindow> out = new LinkedHashMap<>();
        if (windowsNode != null && windowsNode.isObject()) {
            for (String sessionName : List.of("LONDON", "NY_AM", "ASIA", "NY_PM")) {
                JsonNode node = firstPresent(
                        windowsNode.path(sessionName),
                        windowsNode.path(sessionName.toLowerCase(Locale.ROOT)),
                        windowsNode.path(sessionName.replace('_', '-'))
                );
                if (node == null || node.isMissingNode() || node.isNull()) {
                    continue;
                }
                String start = text(firstPresent(node.path("start"), node.path("startUtc"), node.path("start_utc")), null);
                String end = text(firstPresent(node.path("end"), node.path("endUtc"), node.path("end_utc")), null);
                if (start == null || end == null) {
                    continue;
                }
                out.put(
                        normalizeSessionName(sessionName),
                        sessionWindow(sessionName, "UTC", parseLocalTime(start), parseLocalTime(end), true, false, false, false, out.size())
                );
            }
        }
        if (!out.containsKey("LONDON")) {
            out.put("LONDON", sessionWindow("LONDON", "UTC", LocalTime.of(7, 0), LocalTime.of(10, 0), true, false, false, false, out.size()));
        }
        if (!out.containsKey("NY_AM")) {
            out.put("NY_AM", sessionWindow("NY_AM", "UTC", LocalTime.of(12, 30), LocalTime.of(15, 30), true, false, false, false, out.size()));
        }
        return out;
    }

    private List<SessionWindow> parseSessions(JsonNode root, String timezoneBasis) {
        JsonNode smc = path(root, "smc");
        String sessionTimezone = text(firstPresent(path(smc, "sessionTimezone"), path(smc, "session_timezone")), timezoneBasis);

        JsonNode sessionCalendarNode = firstPresent(path(smc, "sessionCalendar"), path(smc, "session_calendar"));
        if (sessionCalendarNode != null && sessionCalendarNode.isArray()) {
            List<SessionWindow> rows = new ArrayList<>();
            for (JsonNode item : sessionCalendarNode) {
                String name = text(firstPresent(item.path("name"), item.path("sessionName"), item.path("session_name")), null);
                String start = text(firstPresent(item.path("localStartTime"), item.path("startLocal"), item.path("start"), item.path("start_local")), null);
                String end = text(firstPresent(item.path("localEndTime"), item.path("endLocal"), item.path("end"), item.path("end_local")), null);
                if (name == null || start == null || end == null) {
                    continue;
                }
                String zone = text(firstPresent(item.path("timezoneId"), item.path("zoneId"), item.path("zone_id")), sessionTimezone);
                boolean enabled = bool(item.path("enabled"), true);
                boolean canGeneratePools = bool(item.path("canGeneratePools"), true);
                boolean canFilterEvaluation = bool(item.path("canFilterEvaluation"), true);
                boolean canFilterEntry = bool(item.path("canFilterEntry"), true);
                int displayOrder = integer(item.path("displayOrder"), rows.size());
                rows.add(sessionWindow(
                        name,
                        zone,
                        parseLocalTime(start),
                        parseLocalTime(end),
                        enabled,
                        canGeneratePools,
                        canFilterEvaluation,
                        canFilterEntry,
                        displayOrder
                ));
            }
            if (!rows.isEmpty()) {
                rows.sort(Comparator.comparingInt(SessionWindow::displayOrder));
                return rows;
            }
        }

        JsonNode sessionRanges = firstPresent(path(smc, "sessionTimeRanges"), path(smc, "session_time_ranges"));
        if (sessionRanges != null && sessionRanges.isObject()) {
            List<SessionWindow> rows = new ArrayList<>();
            int order = 0;
            for (String sessionName : List.of("ASIA", "LONDON", "NY_AM", "NY_PM")) {
                JsonNode item = firstPresent(
                        sessionRanges.path(sessionName),
                        sessionRanges.path(sessionName.toLowerCase(Locale.ROOT)),
                        sessionRanges.path(sessionName.replace('_', '-'))
                );
                if (item == null || item.isMissingNode() || item.isNull()) {
                    continue;
                }
                String start = text(firstPresent(item.path("start"), item.path("startLocal"), item.path("start_local")), null);
                String end = text(firstPresent(item.path("end"), item.path("endLocal"), item.path("end_local")), null);
                if (start == null || end == null) {
                    continue;
                }
                String zone = text(firstPresent(item.path("zoneId"), item.path("zone_id")), sessionTimezone);
                rows.add(sessionWindow(sessionName, zone, parseLocalTime(start), parseLocalTime(end), order++));
            }
            if (!rows.isEmpty()) {
                return rows;
            }
        }

        JsonNode sessionsNode = path(root, "sessions");
        if (sessionsNode != null && sessionsNode.isArray()) {
            List<SessionWindow> rows = new ArrayList<>();
            for (JsonNode item : sessionsNode) {
                String name = text(firstPresent(item.path("name"), item.path("sessionName"), item.path("session_name")), null);
                String zone = text(firstPresent(item.path("timezoneId"), item.path("zoneId"), item.path("zone_id")), sessionTimezone);
                String start = text(firstPresent(item.path("localStartTime"), item.path("startLocal"), item.path("start"), item.path("start_local")), "08:00");
                String end = text(firstPresent(item.path("localEndTime"), item.path("endLocal"), item.path("end"), item.path("end_local")), "17:00");
                if (name == null) {
                    continue;
                }
                rows.add(sessionWindow(
                        name,
                        zone,
                        parseLocalTime(start),
                        parseLocalTime(end),
                        bool(item.path("enabled"), true),
                        bool(item.path("canGeneratePools"), true),
                        bool(item.path("canFilterEvaluation"), true),
                        bool(item.path("canFilterEntry"), true),
                        integer(item.path("displayOrder"), rows.size())
                ));
            }
            if (!rows.isEmpty()) {
                rows.sort(Comparator.comparingInt(SessionWindow::displayOrder));
                return rows;
            }
        }
        return defaultSessions(timezoneBasis);
    }

    private List<SessionWindow> defaultSessions(String timezoneBasisRaw) {
        String basis = normalizeTimezoneBasis(timezoneBasisRaw);
        String zone = "CENTER_LOCAL".equalsIgnoreCase(basis) ? "UTC" : basis;
        if (zone == null || zone.isBlank()) {
            zone = "UTC";
        }
        return List.of(
                sessionWindow("ASIA", zone, LocalTime.of(0, 0), LocalTime.of(7, 0), 0),
                sessionWindow("LONDON", zone, LocalTime.of(7, 0), LocalTime.of(12, 0), 1),
                sessionWindow("NY_AM", zone, LocalTime.of(13, 0), LocalTime.of(17, 0), 2),
                sessionWindow("NY_PM", zone, LocalTime.of(17, 0), LocalTime.of(22, 0), 3)
        );
    }

    private SessionWindow resolveSessionWindow(List<SessionWindow> sessions, String sessionName) {
        if (sessions == null || sessions.isEmpty()) {
            return sessionWindow("LONDON", "UTC", LocalTime.of(7, 0), LocalTime.of(12, 0), 0);
        }
        if (sessionName == null || sessionName.isBlank()) {
            return sessions.stream().filter(SessionWindow::enabled).findFirst().orElse(sessions.get(0));
        }
        String wanted = normalizeSessionName(sessionName);
        for (SessionWindow session : sessions) {
            if (session.enabled() && normalizeSessionName(session.name()).equals(wanted)) {
                return session;
            }
        }
        return sessions.stream().filter(SessionWindow::enabled).findFirst().orElse(sessions.get(0));
    }

    private SessionStamp assignSession(OffsetDateTime ts, SessionWindow window) {
        if (ts == null || window == null) {
            return null;
        }

        ZonedDateTime zdt = ts.toInstant().atZone(ZoneId.of(window.zoneId()));
        LocalTime local = zdt.toLocalTime();
        boolean overnight = !window.startLocal().isBefore(window.endLocal());
        boolean inside;
        if (!overnight) {
            inside = !local.isBefore(window.startLocal()) && local.isBefore(window.endLocal());
        } else {
            inside = !local.isBefore(window.startLocal()) || local.isBefore(window.endLocal());
        }
        if (!inside) {
            return null;
        }

        LocalDate sessionDate;
        if (!overnight) {
            sessionDate = zdt.toLocalDate();
        } else {
            if (local.isBefore(window.endLocal())) {
                sessionDate = zdt.toLocalDate().minusDays(1);
            } else {
                sessionDate = zdt.toLocalDate();
            }
        }

        return new SessionStamp(window.name(), sessionDate);
    }

    private List<BacktestSessionPreviewResponse> buildSessionPreview(BacktestDatasetSet set, List<BacktestDataset> datasets) {
        if (datasets == null || datasets.isEmpty()) {
            return List.of();
        }

        BacktestDataset preferred = datasets.stream()
                .filter(item -> item.getTimeframe() == BacktestTimeframe.M5)
                .findFirst()
                .orElseGet(() -> datasets.stream()
                        .min(Comparator.comparing(item -> item.getTimeframe().duration()))
                        .orElse(datasets.get(0)));

        OffsetDateTime min = rangeMin(preferred);
        OffsetDateTime max = rangeMax(preferred);
        if (min == null || max == null || min.isAfter(max)) {
            return List.of();
        }

        OffsetDateTime to = min.plusDays(2);
        if (to.isAfter(max)) {
            to = max;
        }

        List<BacktestCandle> candles = loadDatasetCandles(set.getUser().getId(), preferred, min, to);
        if (candles.isEmpty()) {
            return List.of();
        }

        List<BacktestSessionPreviewResponse> rows = new ArrayList<>();
        for (SessionWindow window : defaultSessions(set.getTimezoneBasis())) {
            Map<LocalDate, SessionStatsMutable> grouped = new LinkedHashMap<>();
            for (BacktestCandle candle : candles) {
                SessionStamp stamp = assignSession(candle.timestamp(), window);
                if (stamp == null) {
                    continue;
                }
                grouped.computeIfAbsent(stamp.sessionDateKey(), ignored -> new SessionStatsMutable())
                        .include(candle.high(), candle.low());
            }
            if (grouped.isEmpty()) {
                continue;
            }
            LocalDate firstDate = grouped.keySet().iterator().next();
            SessionStatsMutable stats = grouped.get(firstDate);
            rows.add(BacktestSessionPreviewResponse.builder()
                    .sessionName(window.name())
                    .sessionDate(firstDate.toString())
                    .candleCount(stats.count)
                    .sessionHigh(stats.high)
                    .sessionLow(stats.low)
                    .build());
        }

        return rows;
    }

    private RangeResolution resolveRunRange(BacktestDatasetSet set,
                                            OffsetDateTime requestedFrom,
                                            OffsetDateTime requestedTo,
                                            BacktestTimeframe requestedExecutionTimeframe) {
        List<BacktestDataset> datasets = datasetRepository.findByDatasetSet_IdOrderByCreatedAtAsc(set.getId());
        if (datasets.isEmpty()) {
            throw new IllegalArgumentException("No datasets in selected set");
        }
        BacktestTimeframe executionTimeframe = requestedExecutionTimeframe == null ? BacktestTimeframe.M5 : requestedExecutionTimeframe;
        DatasetSelection selection = chooseExecutionDataset(datasets, executionTimeframe);
        OffsetDateTime min = selection.minTimeUtc();
        OffsetDateTime max = selection.maxTimeUtc();
        if (min == null || max == null) {
            throw new IllegalArgumentException("Dataset range unavailable");
        }

        OffsetDateTime requestedFromUtc = normalizeUtc(requestedFrom);
        OffsetDateTime requestedToUtc = normalizeUtc(requestedTo);

        OffsetDateTime from = requestedFromUtc == null ? min : requestedFromUtc;
        OffsetDateTime to = requestedToUtc == null ? max : requestedToUtc;
        List<String> warnings = new ArrayList<>();

        if (requestedFromUtc != null && requestedFromUtc.isBefore(min)) {
            warnings.add("Requested fromUtc was before selected timeframe dataset start and was clamped.");
        }
        if (requestedToUtc != null && requestedToUtc.isAfter(max)) {
            warnings.add("Requested toUtc was after selected timeframe dataset end and was clamped.");
        }

        if (from.isBefore(min)) {
            from = min;
        }
        if (to.isAfter(max)) {
            to = max;
        }
        if (from.isAfter(to)) {
            from = min;
            to = max;
            warnings.add("Requested range was invalid after clamping; using full dataset range.");
        }

        return new RangeResolution(
                min,
                max,
                requestedFromUtc,
                requestedToUtc,
                from,
                to,
                deduplicateWarnings(warnings)
        );
    }

    private BacktestStrategyConfig resolveStrategyConfig(BacktestDatasetSet set, UUID userId, UUID strategyConfigId) {
        if (strategyConfigId != null) {
            return strategyConfigRepository.findByIdAndDatasetSet_User_Id(strategyConfigId, userId)
                    .orElseThrow(() -> new EntityNotFoundException("Backtest strategy config not found"));
        }

        return strategyConfigRepository.findByDatasetSet_IdOrderByUpdatedAtDesc(set.getId())
                .stream()
                .findFirst()
                .orElseGet(() -> strategyConfigRepository.save(BacktestStrategyConfig.builder()
                        .datasetSet(set)
                        .name(STRATEGY_DEFAULT_NAME)
                        .configJson(defaultStrategyConfigNode(set))
                        .build()));
    }

    private BacktestDatasetSet requireDatasetSet(UUID datasetSetId, UUID userId) {
        return datasetSetRepository.findByIdAndUser_Id(datasetSetId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Backtest dataset set not found"));
    }

    private BacktestRun requireRun(UUID runId, UUID userId) {
        return runRepository.findByIdAndUser_Id(runId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Backtest run not found"));
    }

    private BacktestDatasetSetResponse toDatasetSetResponse(BacktestDatasetSet set) {
        return BacktestDatasetSetResponse.builder()
                .id(set.getId())
                .instrument(set.getInstrument())
                .timezoneBasis(set.getTimezoneBasis())
                .createdAt(set.getCreatedAt())
                .build();
    }

    private BacktestDatasetFileResponse toDatasetFileResponse(BacktestDataset dataset) {
        JsonNode mappingNode = dataset.getMetadataJson() == null ? null : dataset.getMetadataJson().path("mapping");
        String columnsMapped = "N/A";
        if (mappingNode != null && mappingNode.isObject()) {
            columnsMapped = String.join(
                    "/",
                    text(mappingNode.path("timeColumn"), "-"),
                    text(mappingNode.path("openColumn"), "-"),
                    text(mappingNode.path("highColumn"), "-"),
                    text(mappingNode.path("lowColumn"), "-"),
                    text(mappingNode.path("closeColumn"), "-")
            );
        }

        DatasetValidationResult validation = validateDataset(dataset);
        int candleCount = resolveDatasetCandleCount(dataset);

        log.info(
                "Dataset validation [datasetId={}, candlesCount={}, status={}, runnable={}, warningCodes={}, fatalCodes={}]",
                dataset.getId(),
                candleCount,
                validation.status(),
                validation.runnable(),
                validation.warnings().stream().map(BacktestDatasetValidationIssueResponse::getCode).toList(),
                validation.fatalErrors().stream().map(BacktestDatasetValidationIssueResponse::getCode).toList()
        );

        return BacktestDatasetFileResponse.builder()
                .datasetId(dataset.getId())
                .timeframe(dataset.getTimeframe().name())
                .originalFilename(dataset.getOriginalFilename() == null ? dataset.getName() : dataset.getOriginalFilename())
                .minTimeUtc(rangeMin(dataset))
                .maxTimeUtc(rangeMax(dataset))
                .candleCount(candleCount)
                .columnsMapped(columnsMapped)
                .status(validation.status())
                .runnable(validation.runnable())
                .minRequiredCandles(validation.minRequiredCandles())
                .errorMsg(dataset.getErrorMsg())
                .warnings(validation.warnings())
                .fatalErrors(validation.fatalErrors())
                .build();
    }

    private DatasetValidationResult validateDataset(BacktestDataset dataset) {
        int candleCount = resolveDatasetCandleCount(dataset);
        int minRequired = minRequiredCandles();
        OffsetDateTime min = rangeMin(dataset);
        OffsetDateTime max = rangeMax(dataset);
        List<BacktestDatasetValidationIssueResponse> warningIssues = readWarningIssues(dataset);
        List<BacktestDatasetValidationIssueResponse> fatalIssues = new ArrayList<>(readFatalIssues(dataset));

        if (Boolean.FALSE.equals(dataset.getParsedOk())) {
            fatalIssues.add(issue(
                    "PARSE_FAILED",
                    "Dataset parsing failed. Re-upload a clean CSV with valid timestamp/OHLC columns.",
                    dataset.getErrorMsg()
            ));
        }

        if (candleCount <= 0) {
            fatalIssues.add(issue(
                    "NO_CANDLES",
                    "No candles were persisted for this dataset.",
                    "Re-import the CSV and verify timestamp plus OHLC mappings."
            ));
        } else if (candleCount < minRequired) {
            fatalIssues.add(issue(
                    "INSUFFICIENT_CANDLES",
                    "Need at least %d candles to run safely; found %d.".formatted(minRequired, candleCount),
                    "Widen the date range or import more history."
            ));
        }

        if (min == null || max == null) {
            fatalIssues.add(issue(
                    "RANGE_UNAVAILABLE",
                    "Dataset range is unavailable (missing min/max timestamp).",
                    "Re-import this dataset to rebuild range metadata."
            ));
        } else if (min.isAfter(max)) {
            fatalIssues.add(issue(
                    "RANGE_INVALID",
                    "Dataset range is invalid because min timestamp is after max timestamp.",
                    "Re-import this dataset to rebuild range metadata."
            ));
        }

        List<BacktestDatasetValidationIssueResponse> dedupedWarnings = deduplicateIssues(warningIssues);
        List<BacktestDatasetValidationIssueResponse> dedupedFatals = deduplicateIssues(fatalIssues);
        boolean runnable = dedupedFatals.isEmpty();
        String status = runnable
                ? (dedupedWarnings.isEmpty() ? "READY" : "WARN")
                : "ERROR";

        return new DatasetValidationResult(status, runnable, minRequired, dedupedWarnings, dedupedFatals);
    }

    private List<BacktestDatasetValidationIssueResponse> readWarningIssues(BacktestDataset dataset) {
        JsonNode warningNode = dataset.getMetadataJson() == null ? null : dataset.getMetadataJson().path("warnings");
        if (warningNode == null || !warningNode.isArray()) {
            return List.of();
        }
        List<BacktestDatasetValidationIssueResponse> warnings = new ArrayList<>();
        for (JsonNode item : warningNode) {
            if (item == null || item.isNull()) {
                continue;
            }
            String message = item.asText(null);
            if (message == null || message.isBlank()) {
                continue;
            }
            warnings.add(issue(mapWarningCode(message), message, null));
        }
        return warnings;
    }

    private List<BacktestDatasetValidationIssueResponse> readFatalIssues(BacktestDataset dataset) {
        JsonNode fatalNode = dataset.getMetadataJson() == null ? null : dataset.getMetadataJson().path("fatalErrors");
        if (fatalNode == null || !fatalNode.isArray()) {
            return List.of();
        }
        List<BacktestDatasetValidationIssueResponse> fatalErrors = new ArrayList<>();
        for (JsonNode item : fatalNode) {
            if (item == null || item.isNull()) {
                continue;
            }
            if (item.isObject()) {
                String code = text(item.path("code"), "VALIDATION_ERROR");
                String message = text(item.path("message"), null);
                String details = text(item.path("details"), null);
                if (message != null && !message.isBlank()) {
                    fatalErrors.add(issue(code, message, details));
                }
                continue;
            }
            String message = item.asText(null);
            if (message != null && !message.isBlank()) {
                fatalErrors.add(issue("VALIDATION_ERROR", message, null));
            }
        }
        return fatalErrors;
    }

    private List<BacktestDatasetValidationIssueResponse> deduplicateIssues(List<BacktestDatasetValidationIssueResponse> issues) {
        if (issues == null || issues.isEmpty()) {
            return List.of();
        }
        Set<String> seen = new LinkedHashSet<>();
        List<BacktestDatasetValidationIssueResponse> deduped = new ArrayList<>();
        for (BacktestDatasetValidationIssueResponse issue : issues) {
            if (issue == null || issue.getMessage() == null || issue.getMessage().isBlank()) {
                continue;
            }
            String key = "%s|%s".formatted(
                    issue.getCode() == null ? "UNKNOWN" : issue.getCode(),
                    issue.getMessage().trim()
            );
            if (seen.add(key)) {
                deduped.add(issue);
            }
        }
        return deduped;
    }

    private String mapWarningCode(String warningMessage) {
        String normalized = warningMessage == null ? "" : warningMessage.toLowerCase(Locale.ROOT);
        if (normalized.contains("duplicate")) {
            return "DUPLICATES_REMOVED";
        }
        if (normalized.contains("gap")) {
            return "GAPS_DETECTED";
        }
        if (normalized.contains("unsorted")) {
            return "UNSORTED_NORMALIZED";
        }
        if (normalized.contains("skipped") && normalized.contains("invalid")) {
            return "INVALID_ROWS_SKIPPED";
        }
        return "DATA_WARNING";
    }

    private int resolveDatasetCandleCount(BacktestDataset dataset) {
        if (dataset == null) {
            return 0;
        }
        if (dataset.getCandleCount() != null && dataset.getCandleCount() > 0) {
            return dataset.getCandleCount();
        }
        return dataset.getRowCount() == null ? 0 : Math.max(0, dataset.getRowCount());
    }

    private BacktestDatasetValidationIssueResponse issue(String code, String message, String details) {
        return BacktestDatasetValidationIssueResponse.builder()
                .code(code)
                .message(message)
                .details(details)
                .build();
    }

    private BacktestStrategyConfigResponse toStrategyResponse(BacktestStrategyConfig config) {
        return BacktestStrategyConfigResponse.builder()
                .id(config.getId())
                .datasetSetId(config.getDatasetSet().getId())
                .name(config.getName())
                .configJson(config.getConfigJson())
                .createdAt(config.getCreatedAt())
                .updatedAt(config.getUpdatedAt())
                .build();
    }

    private BacktestLabRunResponse toRunResponse(BacktestRun run, RunDiagnostics diagnostics) {
        return BacktestLabRunResponse.builder()
                .runId(run.getId())
                .status(run.getStatus().name())
                .symbol(run.getSymbol())
                .timeframe(run.getTimeframe())
                .fromUtc(run.getFromUtc())
                .toUtc(run.getToUtc())
                .createdAt(run.getCreatedAt())
                .completedAt(run.getCompletedAt())
                .errorMsg(run.getErrorMsg())
                .datasetMinUtc(diagnostics == null ? null : diagnostics.datasetMinUtc())
                .datasetMaxUtc(diagnostics == null ? null : diagnostics.datasetMaxUtc())
                .requestedFromUtc(diagnostics == null ? null : diagnostics.requestedFromUtc())
                .requestedToUtc(diagnostics == null ? null : diagnostics.requestedToUtc())
                .effectiveFromUtc(diagnostics == null ? null : diagnostics.effectiveFromUtc())
                .effectiveToUtc(diagnostics == null ? null : diagnostics.effectiveToUtc())
                .candleCountInRange(diagnostics == null ? null : diagnostics.candleCountInRange())
                .minRequiredCandles(diagnostics == null ? null : diagnostics.minRequiredCandles())
                .warnings(diagnostics == null || diagnostics.warnings() == null ? List.of() : diagnostics.warnings())
                .build();
    }

    private BacktestRunReportResponse toReportResponse(BacktestRunReport report) {
        return BacktestRunReportResponse.builder()
                .reportId(report.getId())
                .runId(report.getRun().getId())
                .strategyId(report.getStrategyId())
                .strategyNameSnapshot(report.getStrategyNameSnapshot())
                .strategyConfigSnapshotJson(report.getStrategyConfigSnapshotJson())
                .filtersSnapshotJson(report.getFiltersSnapshotJson())
                .summarySnapshotJson(report.getSummarySnapshotJson())
                .tradesTimelineSnapshotJson(report.getTradesTimelineSnapshotJson())
                .recommendationsSnapshotJson(report.getRecommendationsSnapshotJson())
                .reportMarkdown(report.getReportMarkdown())
                .reportVersion(report.getReportVersion())
                .createdAtUtc(report.getCreatedAtUtc())
                .build();
    }

    private BacktestLabTradeResultResponse toTradeResult(BacktestTrade trade) {
        JsonNode evidence = trade.getEvidenceJson() == null ? objectMapper.createObjectNode() : trade.getEvidenceJson();
        List<BacktestLabTimelineEventResponse> timeline = new ArrayList<>();
        JsonNode timelineNode = evidence.path("timeline");
        if (timelineNode.isArray()) {
            for (JsonNode item : timelineNode) {
                Instant eventTime = parseInstantUtc(item.path("timeUtc").asText(null));
                timeline.add(BacktestLabTimelineEventResponse.builder()
                        .stage(item.path("stage").asText())
                        .timeUtc(eventTime)
                        .details(item.path("details"))
                        .build());
            }
        }

        return BacktestLabTradeResultResponse.builder()
                .tradeId(trade.getId())
                .setupId(trade.getSetup() == null ? null : trade.getSetup().getId())
                .sessionName(evidenceText(evidence, "sessionName", trade.getSetup() == null ? null : trade.getSetup().getSessionName()))
                .direction(trade.getDirection() == null ? null : trade.getDirection().name())
                .entryTime(trade.getEntryTime())
                .entryPrice(trade.getEntryPrice())
                .stopLoss(trade.getStopLossPrice())
                .takeProfit(trade.getTakeProfitPrice())
                .exitTime(trade.getExitTime())
                .exitPrice(trade.isFilled() ? inferExitPrice(trade) : null)
                .exitReason(trade.getExitReason() == null ? null : trade.getExitReason().name())
                .fillStatus(trade.getFillStatus() == null ? (trade.isFilled() ? "FILLED" : "NO_FILL") : trade.getFillStatus())
                .rMultiple(trade.getRMultiple())
                .maeR(trade.getMaeR())
                .mfeR(trade.getMfeR())
                .durationSec(trade.getDurationSec())
                .evidence(evidence)
                .timeline(timeline)
                .build();
    }

    private BigDecimal inferExitPrice(BacktestTrade trade) {
        if (trade.getExitReason() == BacktestExitReason.SL) {
            return trade.getStopLossPrice();
        }
        if (trade.getExitReason() == BacktestExitReason.TP) {
            return trade.getTakeProfitPrice();
        }
        return null;
    }

    private BacktestLabSummaryResponse summarize(List<BacktestLabTradeResultResponse> trades) {
        List<BacktestLabTradeResultResponse> filled = trades.stream()
                .filter(item -> "FILLED".equals(item.getFillStatus()))
                .filter(item -> item.getRMultiple() != null)
                .toList();

        int sampleSize = filled.size();
        int totalSignals = trades.size();
        long wins = filled.stream().filter(item -> item.getRMultiple().compareTo(BigDecimal.ZERO) > 0).count();

        BigDecimal winRate = sampleSize == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(wins).multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(sampleSize), 4, RoundingMode.HALF_UP);

        BigDecimal expectancy = avgR(filled);
        BigDecimal avgMae = averageOf(filled, BacktestLabTradeResultResponse::getMaeR);
        BigDecimal avgMfe = averageOf(filled, BacktestLabTradeResultResponse::getMfeR);
        BigDecimal fillRate = totalSignals == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(sampleSize).multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(totalSignals), 4, RoundingMode.HALF_UP);
        BigDecimal avgDuration = averageOfInt(filled, BacktestLabTradeResultResponse::getDurationSec);

        return BacktestLabSummaryResponse.builder()
                .sampleSize(sampleSize)
                .winRate(winRate)
                .expectancyR(expectancy)
                .avgR(expectancy)
                .avgMaeR(avgMae)
                .avgMfeR(avgMfe)
                .fillRate(fillRate)
                .avgDurationSec(avgDuration)
                .build();
    }

    private BigDecimal averageEvidenceNumber(List<BacktestLabTradeResultResponse> rows, String field) {
        BigDecimal total = BigDecimal.ZERO;
        int count = 0;
        for (BacktestLabTradeResultResponse row : rows) {
            JsonNode evidence = row.getEvidence();
            if (evidence == null) {
                continue;
            }
            JsonNode node = evidence.path(field);
            if (node.isNumber()) {
                total = total.add(node.decimalValue());
                count++;
            }
        }
        if (count == 0) {
            return null;
        }
        return total.divide(BigDecimal.valueOf(count), 6, RoundingMode.HALF_UP);
    }

    private BigDecimal averageMfe(List<BacktestLabTradeResultResponse> rows) {
        return averageOf(rows, BacktestLabTradeResultResponse::getMfeR);
    }

    private BigDecimal avgR(List<BacktestLabTradeResultResponse> rows) {
        return averageOf(rows, BacktestLabTradeResultResponse::getRMultiple);
    }

    private BigDecimal averageOf(List<BacktestLabTradeResultResponse> rows,
                                 java.util.function.Function<BacktestLabTradeResultResponse, BigDecimal> fn) {
        BigDecimal total = BigDecimal.ZERO;
        int count = 0;
        for (BacktestLabTradeResultResponse row : rows) {
            BigDecimal value = fn.apply(row);
            if (value != null) {
                total = total.add(value);
                count++;
            }
        }
        if (count == 0) {
            return BigDecimal.ZERO;
        }
        return total.divide(BigDecimal.valueOf(count), 6, RoundingMode.HALF_UP);
    }

    private BigDecimal averageOfInt(List<BacktestLabTradeResultResponse> rows,
                                    java.util.function.Function<BacktestLabTradeResultResponse, Integer> fn) {
        BigDecimal total = BigDecimal.ZERO;
        int count = 0;
        for (BacktestLabTradeResultResponse row : rows) {
            Integer value = fn.apply(row);
            if (value != null) {
                total = total.add(BigDecimal.valueOf(value));
                count++;
            }
        }
        if (count == 0) {
            return BigDecimal.ZERO;
        }
        return total.divide(BigDecimal.valueOf(count), 4, RoundingMode.HALF_UP);
    }

    private String confidenceLabel(int sampleSize) {
        if (sampleSize < 10) {
            return "Low";
        }
        if (sampleSize < 30) {
            return "Moderate";
        }
        if (sampleSize < 50) {
            return "Good";
        }
        return "High";
    }

    private BigDecimal calcR(Direction direction, BigDecimal entry, BigDecimal exit, BigDecimal risk) {
        if (direction == null || entry == null || exit == null || risk == null || risk.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        BigDecimal pnl = direction == Direction.LONG
                ? exit.subtract(entry)
                : entry.subtract(exit);
        return pnl.divide(risk, 6, RoundingMode.HALF_UP);
    }

    private BigDecimal rr(BigDecimal entry, BigDecimal sl, BigDecimal tp) {
        if (entry == null || sl == null || tp == null) {
            return null;
        }
        BigDecimal risk = entry.subtract(sl).abs();
        if (risk.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        BigDecimal reward = tp.subtract(entry).abs();
        return reward.divide(risk, 6, RoundingMode.HALF_UP);
    }

    private Excursion computeExcursion(List<BacktestCandle> candles,
                                       int fillIndex,
                                       int exitIndex,
                                       Direction direction,
                                       BigDecimal entry,
                                       BigDecimal risk) {
        BigDecimal maxAdverse = BigDecimal.ZERO;
        BigDecimal maxFavorable = BigDecimal.ZERO;

        for (int i = fillIndex; i <= Math.min(exitIndex, candles.size() - 1); i++) {
            BacktestCandle candle = candles.get(i);
            BigDecimal adverse;
            BigDecimal favorable;
            if (direction == Direction.LONG) {
                adverse = entry.subtract(candle.low());
                favorable = candle.high().subtract(entry);
            } else {
                adverse = candle.high().subtract(entry);
                favorable = entry.subtract(candle.low());
            }
            if (adverse.compareTo(BigDecimal.ZERO) < 0) {
                adverse = BigDecimal.ZERO;
            }
            if (favorable.compareTo(BigDecimal.ZERO) < 0) {
                favorable = BigDecimal.ZERO;
            }
            if (adverse.compareTo(maxAdverse) > 0) {
                maxAdverse = adverse;
            }
            if (favorable.compareTo(maxFavorable) > 0) {
                maxFavorable = favorable;
            }
        }

        BigDecimal maeR = risk.compareTo(BigDecimal.ZERO) <= 0 ? null : maxAdverse.divide(risk, 6, RoundingMode.HALF_UP);
        BigDecimal mfeR = risk.compareTo(BigDecimal.ZERO) <= 0 ? null : maxFavorable.divide(risk, 6, RoundingMode.HALF_UP);
        return new Excursion(maeR, mfeR);
    }

    private BigDecimal resolveTakeProfit(ParsedConfig config, BigDecimal entry, BigDecimal stopLoss, Direction direction) {
        BigDecimal risk = entry.subtract(stopLoss).abs();
        if (risk.compareTo(BigDecimal.ZERO) <= 0) {
            return entry;
        }
        BigDecimal reward = risk.multiply(config.fixedR());
        return direction == Direction.LONG
                ? entry.add(reward)
                : entry.subtract(reward);
    }

    private ExecutionCostBreakdown buildEntryCostBreakdown(ParsedConfig config, Direction direction, BigDecimal rawPrice) {
        if (rawPrice == null) {
            return new ExecutionCostBreakdown(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        }
        if ("MID".equalsIgnoreCase(config.fillPolicy())) {
            return new ExecutionCostBreakdown(rawPrice, BigDecimal.ZERO, BigDecimal.ZERO, rawPrice);
        }

        BigDecimal spreadPrice = config.spreadPips().multiply(config.pipSize());
        BigDecimal slippagePrice = config.slippagePips().multiply(config.pipSize());
        BigDecimal spreadAdj = signedEntryHalfCost(direction, spreadPrice);
        BigDecimal slippageAdj = signedEntryHalfCost(direction, slippagePrice);
        BigDecimal finalPrice = rawPrice.add(spreadAdj).add(slippageAdj);
        return new ExecutionCostBreakdown(rawPrice, spreadAdj, slippageAdj, finalPrice);
    }

    private ExecutionCostBreakdown buildExitCostBreakdown(ParsedConfig config, Direction direction, BigDecimal rawPrice) {
        if (rawPrice == null) {
            return new ExecutionCostBreakdown(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        }
        if ("MID".equalsIgnoreCase(config.fillPolicy())) {
            return new ExecutionCostBreakdown(rawPrice, BigDecimal.ZERO, BigDecimal.ZERO, rawPrice);
        }

        BigDecimal spreadPrice = config.spreadPips().multiply(config.pipSize());
        BigDecimal slippagePrice = config.slippagePips().multiply(config.pipSize());
        BigDecimal spreadAdj = signedExitHalfCost(direction, spreadPrice);
        BigDecimal slippageAdj = signedExitHalfCost(direction, slippagePrice);
        BigDecimal finalPrice = rawPrice.add(spreadAdj).add(slippageAdj);
        return new ExecutionCostBreakdown(rawPrice, spreadAdj, slippageAdj, finalPrice);
    }

    private BigDecimal signedEntryHalfCost(Direction direction, BigDecimal cost) {
        if (cost == null || direction == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal half = cost.divide(BigDecimal.valueOf(2), 8, RoundingMode.HALF_UP);
        return direction == Direction.LONG ? half : half.negate();
    }

    private BigDecimal signedExitHalfCost(Direction direction, BigDecimal cost) {
        if (cost == null || direction == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal half = cost.divide(BigDecimal.valueOf(2), 8, RoundingMode.HALF_UP);
        return direction == Direction.LONG ? half.negate() : half;
    }

    private BigDecimal applyEntryCost(BigDecimal entryRaw, Direction direction, BigDecimal cost) {
        if (entryRaw == null || direction == null || cost == null) {
            return entryRaw;
        }
        BigDecimal half = cost.divide(BigDecimal.valueOf(2), 8, RoundingMode.HALF_UP);
        return direction == Direction.LONG ? entryRaw.add(half) : entryRaw.subtract(half);
    }

    private BigDecimal applyExitCost(BigDecimal exitRaw, Direction direction, BigDecimal cost) {
        if (exitRaw == null || direction == null || cost == null) {
            return exitRaw;
        }
        BigDecimal half = cost.divide(BigDecimal.valueOf(2), 8, RoundingMode.HALF_UP);
        return direction == Direction.LONG ? exitRaw.subtract(half) : exitRaw.add(half);
    }

    private JsonNode defaultStrategyConfigNode(BacktestDatasetSet set) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("name", STRATEGY_DEFAULT_NAME);

        String timezone = normalizeTimezoneBasis(set.getTimezoneBasis());
        BacktestTimeframe executionTf = BacktestTimeframe.M5;

        ObjectNode context = root.putObject("context");
        context.put("pipSize", inferPipSize(set.getInstrument()).doubleValue());
        context.put("spreadPips", 0.8);
        context.put("slippagePips", 0.3);
        context.put("touchTolerancePips", 0.5);
        context.put("timezoneBasis", timezone);
        context.put("executionTimeframe", executionTf.name());

        ArrayNode sessions = root.putArray("sessions");
        for (SessionWindow window : defaultSessions(timezone)) {
            ObjectNode node = sessions.addObject();
            node.put("name", window.name());
            node.put("zoneId", window.zoneId());
            node.put("startLocal", window.startLocal().toString());
            node.put("endLocal", window.endLocal().toString());
        }

        ObjectNode setupRule = root.putObject("setupRule");
        setupRule.put("session", "LONDON");
        setupRule.put("sweepType", "ASIA_H");
        setupRule.put("confirmationType", "MSS");
        setupRule.put("confirmationTf", "M5");
        setupRule.put("direction", "AUTO_FROM_SWEEP");

        ObjectNode entryModel = root.putObject("entryModel");
        entryModel.put("type", "LIMIT_RETRACE_PERCENT");
        entryModel.put("retracePercent", 50);
        entryModel.put("entryWindowBars", 5);

        ObjectNode riskModel = root.putObject("riskModel");
        riskModel.put("stopRule", "SWEEP_EXTREME_PLUS_BUFFER");
        riskModel.put("tpRule", "FIXED_R");
        riskModel.put("fixedR", 2.0);
        riskModel.put("minRR", 2.0);

        ObjectNode quality = root.putObject("qualityFilters");
        quality.put("displacementMultiplier", 1.5);
        quality.put("bodyLookback", 20);
        quality.put("antiChop", true);
        quality.put("maxTradesPerSession", 1);
        quality.put("maxTradesPerDay", 3);
        quality.put("pivotLeft", 2);
        quality.put("pivotRight", 2);
        quality.put("confirmBreakBufferPips", 0.0);

        ObjectNode smc = root.putObject("smc");
        smc.put("sessionTimezone", timezone);
        smc.put("contextTf", "H1");
        smc.put("poolTf", "M15");
        smc.put("confirmationTf", "M5");
        smc.put("entryTf", "M5");
        smc.put("executionTf", executionTf.name());
        smc.put("allowNonHierarchicalTimeframes", false);
        smc.putArray("sessionsEnabled")
                .add("ASIA")
                .add("LONDON")
                .add("NY_AM")
                .add("NY_PM");

        ObjectNode sessionTimeRanges = smc.putObject("sessionTimeRanges");
        for (SessionWindow window : defaultSessions(timezone)) {
            ObjectNode range = sessionTimeRanges.putObject(window.name());
            range.put("start", window.startLocal().toString());
            range.put("end", window.endLocal().toString());
            range.put("zoneId", window.zoneId());
        }
        ArrayNode sessionCalendar = smc.putArray("sessionCalendar");
        for (SessionWindow window : defaultSessions(timezone)) {
            ObjectNode row = sessionCalendar.addObject();
            row.put("name", window.name());
            row.put("timezoneId", window.zoneId());
            row.put("localStartTime", window.startLocal().toString());
            row.put("localEndTime", window.endLocal().toString());
            row.put("enabled", window.enabled());
            row.put("canGeneratePools", window.canGeneratePools());
            row.put("canFilterEvaluation", window.canFilterEvaluation());
            row.put("canFilterEntry", window.canFilterEntry());
            row.put("displayOrder", window.displayOrder());
        }

        smc.putArray("sweepSourceSessions")
                .add("ASIA")
                .add("LONDON")
                .add("NY_AM");
        smc.putArray("evaluationSessionFilter")
                .add("LONDON");
        smc.putArray("entrySessions")
                .add("LONDON");
        smc.put("requireCrossSessionSweep", false);
        smc.put("requireSameSessionForSweepAndEntry", false);
        smc.put("sweepRequiresUnsweptPool", true);

        smc.putArray("poolTypesEnabled")
                .add("EQH")
                .add("EQL")
                .add("ASIA_H")
                .add("ASIA_L")
                .add("LONDON_H")
                .add("LONDON_L")
                .add("NY_AM_H")
                .add("NY_AM_L")
                .add("PDH")
                .add("PDL")
                .add("PWH")
                .add("PWL");
        smc.put("poolTimeframeForDetection", "M15");
        smc.put("poolTouchTolerancePips", 1.0);
        smc.put("poolMinTouches", 2);
        smc.put("poolMinSeparationBars", 6);
        smc.put("poolMinAgeBars", 12);
        smc.put("poolRankRule", "MOST_TOUCHES_THEN_RECENCY");

        smc.put("sweepMinDepthPips", 4.0);
        smc.put("sweepMaxDurationBars", 5);
        smc.put("sweepRequiresReclaim", true);
        smc.put("sweepRequiresLiquidityType", true);
        smc.put("sweepSelectRule", "MAX_DEPTH_THEN_BEST_RANKED_POOL");

        smc.put("displacementTimeframe", "M5");
        smc.put("displacementMaxDelayBarsAfterSweep", 2);
        smc.put("displacementMinBodyPips", 6.0);
        smc.put("displacementMinBodyVsAvgMult", 1.8);
        smc.put("displacementRequiresCloseBeyondLevel", true);
        smc.put("displacementNoInstantOverlapBars", 1);
        smc.put("displacementType", "GAP_OPTIONAL");
        smc.put("displacementGapDefinition", "THREE_CANDLE_FVG");
        smc.put("displacementGapMinPips", 2.0);

        smc.put("mssTf", "M5");
        smc.put("swingDetectionMethod", "PIVOT_N");
        smc.put("swingPivotN", 2);
        smc.put("minSwingDistancePips", 1.0);
        smc.put("minSwingSeparationBars", 2);
        smc.put("structureTier", "BOTH");
        smc.put("mssRequiresClose", true);
        smc.put("mssBreakMode", "CLOSE_ONLY");
        smc.put("mssEnabled", true);
        smc.put("mssRequiresLiquiditySweep", true);
        smc.put("mssRequiresDisplacement", true);
        smc.put("mssMinBreakDistancePips", 0.5);
        smc.put("mssStructureTier", "INTERNAL");
        smc.put("mssMinConfirmCandles", 3);
        smc.put("mssMaxConfirmWindowBars", 8);
        smc.put("mssInvalidationRule", "CLOSE_BACK_THROUGH_LEVEL");
        smc.put("mssAnchorLevel", "LAST_SWING_HIGH_LOW");
        smc.put("bosEnabled", false);
        smc.put("bosAnchorType", "LAST_CONFIRMED_SWING");
        smc.put("bosBreakMode", "CLOSE_ONLY");
        smc.put("bosMinBreakDistancePips", 0.5);
        smc.put("bosHoldBars", 2);
        smc.put("bosDirectionRule", "WITH_TREND_ONLY");

        smc.put("requireKillzone", true);
        ObjectNode killzones = smc.putObject("killzoneWindowsUtc");
        killzones.putObject("LONDON").put("start", "07:00").put("end", "10:00").put("zoneId", "UTC");
        killzones.putObject("NY_AM").put("start", "12:30").put("end", "15:30").put("zoneId", "UTC");

        smc.put("retraceRequired", true);
        smc.put("retraceReference", "GAP_FILL");
        smc.put("retraceMinPct", 50);
        smc.put("retraceMaxWaitBars", 6);
        smc.put("retraceAcceptWickTouch", true);

        smc.put("entryRequiresFvgRetest", false);
        smc.put("entryRequiresDiscountPremium", false);
        smc.put("fillPolicy", "BID_ASK_SIM");
        smc.put("emitDebugFields", true);
        smc.put("storeIntermediateLevels", true);

        return root;
    }

    private JsonNode path(JsonNode root, String... keys) {
        JsonNode node = root;
        if (node == null) {
            return null;
        }
        for (String key : keys) {
            if (node == null) {
                return null;
            }
            node = node.path(key);
        }
        return node;
    }

    private JsonNode firstPresent(JsonNode... nodes) {
        if (nodes == null || nodes.length == 0) {
            return null;
        }
        for (JsonNode node : nodes) {
            if (node != null && !node.isMissingNode() && !node.isNull()) {
                return node;
            }
        }
        return null;
    }

    private BacktestTimeframe parseTimeframe(JsonNode node, BacktestTimeframe fallback) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return fallback;
        }
        try {
            return BacktestTimeframe.from(node.asText());
        } catch (Exception ex) {
            return fallback;
        }
    }

    private Set<String> parseStringSet(JsonNode node, Set<String> fallback) {
        Set<String> out = new LinkedHashSet<>();
        if (node != null && !node.isMissingNode() && !node.isNull()) {
            if (node.isArray()) {
                for (JsonNode item : node) {
                    if (item != null && item.isTextual()) {
                        String value = normalizeOptionalText(item.asText());
                        if (value != null) {
                            out.add(value.toUpperCase(Locale.ROOT).replace('-', '_'));
                        }
                    }
                }
            } else if (node.isTextual()) {
                String raw = normalizeOptionalText(node.asText());
                if (raw != null) {
                    for (String token : raw.split(",")) {
                        String value = normalizeOptionalText(token);
                        if (value != null) {
                            out.add(value.toUpperCase(Locale.ROOT).replace('-', '_'));
                        }
                    }
                }
            }
        }
        if (!out.isEmpty()) {
            return out;
        }
        return fallback == null ? Set.of() : new LinkedHashSet<>(fallback);
    }

    private String evidenceText(JsonNode evidence, String field, String fallback) {
        if (evidence != null && evidence.path(field).isTextual()) {
            String value = evidence.path(field).asText(null);
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return fallback;
    }

    private Integer evidenceInt(JsonNode evidence, String field) {
        if (evidence == null) {
            return null;
        }
        JsonNode node = evidence.path(field);
        if (node.isIntegralNumber()) {
            return node.asInt();
        }
        return null;
    }

    private String isoUtc(OffsetDateTime value) {
        if (value == null) {
            return null;
        }
        return value.toInstant().toString();
    }

    private Instant parseInstantUtc(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(raw).withOffsetSameInstant(ZoneOffset.UTC).toInstant();
        } catch (Exception ex) {
            return null;
        }
    }

    private String text(JsonNode node, String fallback) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return fallback;
        }
        if (node.isTextual()) {
            String value = node.asText();
            return value == null || value.isBlank() ? fallback : value;
        }
        String value = node.asText();
        return value == null || value.isBlank() ? fallback : value;
    }

    private int integer(JsonNode node, int fallback) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return fallback;
        }
        if (node.isInt() || node.isLong()) {
            return node.asInt();
        }
        try {
            return Integer.parseInt(node.asText());
        } catch (Exception ex) {
            return fallback;
        }
    }

    private boolean bool(JsonNode node, boolean fallback) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return fallback;
        }
        if (node.isBoolean()) {
            return node.asBoolean();
        }
        return Boolean.parseBoolean(node.asText());
    }

    private BigDecimal decimal(JsonNode node, BigDecimal fallback) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return fallback;
        }
        try {
            if (node.isNumber()) {
                return node.decimalValue();
            }
            String value = node.asText();
            if (value == null || value.isBlank()) {
                return fallback;
            }
            return new BigDecimal(value);
        } catch (Exception ex) {
            return fallback;
        }
    }

    private String normalizeInstrument(String instrumentRaw) {
        String normalized = normalizeOptionalText(instrumentRaw);
        if (normalized == null) {
            return "UNKNOWN";
        }
        normalized = normalized.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        return normalized.isBlank() ? "UNKNOWN" : normalized;
    }

    private String detectInstrumentFromFileName(String fileName) {
        String normalized = normalizeOptionalText(fileName);
        if (normalized == null) {
            return null;
        }
        String upper = normalized.toUpperCase(Locale.ROOT);
        String[] parts = upper.split("[^A-Z0-9]+");
        Set<String> candidates = new LinkedHashSet<>();
        for (String part : parts) {
            if (part.length() >= 6 && part.length() <= 7 && part.chars().allMatch(Character::isLetterOrDigit)) {
                candidates.add(part);
            }
        }
        return candidates.stream().findFirst().orElse(null);
    }

    private String normalizeTimezoneBasis(String value) {
        if (value == null || value.isBlank()) {
            return "UTC";
        }
        String normalized = value.trim();
        try {
            ZoneId.of(normalized);
            return normalized;
        } catch (Exception ignored) {
            return "UTC";
        }
    }

    private String normalizeName(String value, String fallback) {
        String normalized = normalizeOptionalText(value);
        return normalized == null ? fallback : normalized;
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private LocalTime parseLocalTime(String raw) {
        if (raw == null || raw.isBlank()) {
            return LocalTime.of(8, 0);
        }
        try {
            return LocalTime.parse(raw);
        } catch (Exception ex) {
            return LocalTime.of(8, 0);
        }
    }

    private OffsetDateTime rangeMin(BacktestDataset dataset) {
        if (dataset == null) {
            return null;
        }
        return dataset.getMinTimeUtc() != null ? dataset.getMinTimeUtc() : dataset.getDataFrom();
    }

    private OffsetDateTime rangeMax(BacktestDataset dataset) {
        if (dataset == null) {
            return null;
        }
        return dataset.getMaxTimeUtc() != null ? dataset.getMaxTimeUtc() : dataset.getDataTo();
    }

    private OffsetDateTime clampToRange(OffsetDateTime value, OffsetDateTime min, OffsetDateTime max) {
        OffsetDateTime safe = value == null ? min : value.withOffsetSameInstant(ZoneOffset.UTC);
        if (safe.isBefore(min)) {
            return min;
        }
        if (safe.isAfter(max)) {
            return max;
        }
        return safe;
    }

    private OffsetDateTime normalizeUtc(OffsetDateTime value) {
        return value == null ? null : value.withOffsetSameInstant(ZoneOffset.UTC);
    }

    private int minRequiredCandles() {
        return Math.max(1, minRequiredCandles);
    }

    private List<String> deduplicateWarnings(List<String> warnings) {
        if (warnings == null || warnings.isEmpty()) {
            return List.of();
        }
        List<String> normalized = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (String warning : warnings) {
            if (warning == null || warning.isBlank()) {
                continue;
            }
            if (seen.add(warning)) {
                normalized.add(warning);
            }
        }
        return normalized;
    }

    private RunDiagnostics diagnosticsFromRange(RangeResolution range, int candleCount, int minRequired) {
        if (range == null) {
            return null;
        }
        return new RunDiagnostics(
                range.datasetMinUtc(),
                range.datasetMaxUtc(),
                range.requestedFromUtc(),
                range.requestedToUtc(),
                range.effectiveFromUtc(),
                range.effectiveToUtc(),
                candleCount,
                minRequired,
                range.warnings()
        );
    }

    private void logRangeFailure(BacktestDatasetSet set,
                                 BacktestRun run,
                                 DatasetSelection selection,
                                 RunDiagnostics diagnostics,
                                 String message) {
        log.warn(
                "Backtest range check failed [datasetSetId={}, runId={}, timeframe={}, selectedDatasetId={}, selectedDatasetTimeframe={}, selectedSourceId={}, storeTable=candle_chunks]: {} | datasetMinUtc={} datasetMaxUtc={} requestedFromUtc={} requestedToUtc={} effectiveFromUtc={} effectiveToUtc={} candleCount={} minRequiredCandles={}",
                set.getId(),
                run.getId(),
                selection.executionTimeframe().name(),
                selection.sourceDataset().getId(),
                selection.sourceDataset().getTimeframe().name(),
                selection.sourceDataset().getSourceId(),
                message,
                diagnostics.datasetMinUtc(),
                diagnostics.datasetMaxUtc(),
                diagnostics.requestedFromUtc(),
                diagnostics.requestedToUtc(),
                diagnostics.effectiveFromUtc(),
                diagnostics.effectiveToUtc(),
                diagnostics.candleCountInRange(),
                diagnostics.minRequiredCandles()
        );
    }

    private BigDecimal inferPipSize(String instrumentRaw) {
        String instrument = instrumentRaw == null ? "" : instrumentRaw.toUpperCase(Locale.ROOT);
        if (instrument.contains("JPY")) {
            return BigDecimal.valueOf(0.01);
        }
        if (instrument.contains("XAU") || instrument.contains("XAG")) {
            return BigDecimal.valueOf(0.1);
        }
        return BigDecimal.valueOf(0.0001);
    }

    private String formatPct(BigDecimal value) {
        if (value == null) {
            return "0.00%";
        }
        return value.setScale(2, RoundingMode.HALF_UP) + "%";
    }

    private String formatSigned(BigDecimal value) {
        if (value == null) {
            return "0.00";
        }
        BigDecimal rounded = value.setScale(2, RoundingMode.HALF_UP);
        return rounded.compareTo(BigDecimal.ZERO) > 0 ? "+" + rounded : rounded.toPlainString();
    }

    private String truncate(String value, int maxLen) {
        if (value == null || value.length() <= maxLen) {
            return value;
        }
        return value.substring(0, Math.max(0, maxLen));
    }

    private record SessionWindow(
            String name,
            String zoneId,
            LocalTime startLocal,
            LocalTime endLocal,
            boolean enabled,
            boolean canGeneratePools,
            boolean canFilterEvaluation,
            boolean canFilterEntry,
            int displayOrder
    ) {
    }

    private record SessionStamp(String sessionName, LocalDate sessionDateKey) {
    }

    private record ParsedConfig(
            String strategyName,
            BigDecimal pipSize,
            BigDecimal spreadPips,
            BigDecimal slippagePips,
            BigDecimal touchTolerancePips,
            String timezoneBasis,
            BacktestTimeframe executionTimeframeRequested,
            List<SessionWindow> sessions,
            String setupSessionName,
            String sweepType,
            String confirmationType,
            String directionMode,
            String entryModelType,
            BigDecimal retracePercent,
            int entryWindowBars,
            String stopRule,
            BigDecimal fixedR,
            BigDecimal minRR,
            BigDecimal displacementMultiplier,
            int bodyLookback,
            boolean antiChop,
            int maxTradesPerSession,
            int maxTradesPerDay,
            int pivotLeft,
            int pivotRight,
            BigDecimal confirmBreakBufferPips,
            String sessionTimezone,
            Set<String> evaluationSessions,
            Set<String> sweepSourceSessions,
            Set<String> poolTypesEnabled,
            BacktestTimeframe poolTimeframeForDetection,
            BigDecimal poolTouchTolerancePips,
            int poolMinTouches,
            int poolMinSeparationBars,
            int poolMinAgeBars,
            String poolRankRule,
            BigDecimal sweepMinDepthPips,
            int sweepMaxDurationBars,
            boolean sweepRequiresReclaim,
            boolean sweepRequiresLiquidityType,
            String sweepSelectRule,
            BacktestTimeframe displacementTimeframe,
            int displacementMaxDelayBarsAfterSweep,
            BigDecimal displacementMinBodyPips,
            BigDecimal displacementMinBodyVsAvgMult,
            boolean displacementRequiresCloseBeyondLevel,
            int displacementNoInstantOverlapBars,
            String displacementType,
            String displacementGapDefinition,
            BigDecimal displacementGapMinPips,
            BacktestTimeframe mssTimeframe,
            String swingDetectionMethod,
            int swingPivotN,
            boolean mssRequiresClose,
            int mssMinConfirmCandles,
            int mssMaxConfirmWindowBars,
            String mssInvalidationRule,
            String mssAnchorLevel,
            boolean entryRequiresFvgRetest,
            boolean entryRequiresDiscountPremium,
            String fillPolicy,
            boolean emitDebugFields,
            boolean storeIntermediateLevels,
            boolean requireKillzone,
            Map<String, SessionWindow> killzoneWindowsUtc,
            boolean retraceRequired,
            String retraceReference,
            BigDecimal retraceMinPct,
            int retraceMaxWaitBars,
            boolean retraceAcceptWickTouch,
            BacktestTimeframe contextTf,
            BacktestTimeframe poolTf,
            BacktestTimeframe confirmationTf,
            BacktestTimeframe entryTf,
            BacktestTimeframe executionTf,
            boolean allowNonHierarchicalTimeframes,
            Set<String> entrySessions,
            boolean requireCrossSessionSweep,
            boolean requireSameSessionForSweepAndEntry,
            boolean sweepRequiresUnsweptPool,
            boolean bosEnabled,
            String bosAnchorType,
            String bosBreakMode,
            BigDecimal bosMinBreakDistancePips,
            int bosHoldBars,
            String bosDirectionRule,
            boolean mssEnabled,
            String mssBreakMode,
            boolean mssRequiresLiquiditySweep,
            boolean mssRequiresDisplacement,
            BigDecimal mssMinBreakDistancePips,
            String mssStructureTier,
            BigDecimal minSwingDistancePips,
            int minSwingSeparationBars,
            String structureTier
    ) {
    }

    private record DatasetSelection(
            BacktestDataset sourceDataset,
            BacktestTimeframe executionTimeframe,
            boolean resample,
            OffsetDateTime minTimeUtc,
            OffsetDateTime maxTimeUtc
    ) {
    }

    private record RangeResolution(
            OffsetDateTime datasetMinUtc,
            OffsetDateTime datasetMaxUtc,
            OffsetDateTime requestedFromUtc,
            OffsetDateTime requestedToUtc,
            OffsetDateTime effectiveFromUtc,
            OffsetDateTime effectiveToUtc,
            List<String> warnings
    ) {
    }

    private record RunDiagnostics(
            OffsetDateTime datasetMinUtc,
            OffsetDateTime datasetMaxUtc,
            OffsetDateTime requestedFromUtc,
            OffsetDateTime requestedToUtc,
            OffsetDateTime effectiveFromUtc,
            OffsetDateTime effectiveToUtc,
            Integer candleCountInRange,
            Integer minRequiredCandles,
            List<String> warnings
    ) {
    }

    private record DatasetValidationResult(
            String status,
            boolean runnable,
            int minRequiredCandles,
            List<BacktestDatasetValidationIssueResponse> warnings,
            List<BacktestDatasetValidationIssueResponse> fatalErrors
    ) {
    }

    private static final class BacktestRunDiagnosticsException extends IllegalArgumentException {
        private final RunDiagnostics diagnostics;

        private BacktestRunDiagnosticsException(String message, RunDiagnostics diagnostics) {
            super(message);
            this.diagnostics = diagnostics;
        }

        private RunDiagnostics diagnostics() {
            return diagnostics;
        }
    }

    private enum SweepSide {
        HIGH,
        LOW
    }

    private record Sweep(
            SweepSide side,
            BigDecimal levelPrice,
            BigDecimal depth,
            BigDecimal sweepExtreme,
            OffsetDateTime sweepExtremeTime,
            String poolId,
            String poolType,
            BigDecimal firstBreachPrice,
            OffsetDateTime firstBreachTime,
            int sweepStartIndex,
            int sweepDurationBars,
            boolean reclaimConfirmed,
            String confirmationTf,
            int sweepEndIndex,
            int sweepExtremeIndex,
            int poolCreatedIndex,
            OffsetDateTime poolCreatedTime,
            String sourceSessionName,
            double rankScore
    ) {
    }

    private record DisplacementSignal(
            int index,
            OffsetDateTime time,
            BigDecimal attackedLevel,
            BigDecimal bodyAbs,
            BigDecimal bodyPips,
            BigDecimal avgBodyPips,
            BigDecimal bodyRatio,
            boolean gapDetected,
            BigDecimal gapSizePips,
            BigDecimal gapLow,
            BigDecimal gapHigh,
            BigDecimal open,
            BigDecimal close,
            BigDecimal high,
            BigDecimal low
    ) {
    }

    private record GapMetrics(
            boolean detected,
            BigDecimal low,
            BigDecimal high,
            BigDecimal sizePips
    ) {
        private static GapMetrics none() {
            return new GapMetrics(false, null, null, BigDecimal.ZERO);
        }
    }

    private record MssSignal(
            int triggerIndex,
            int confirmIndex,
            OffsetDateTime triggerTime,
            OffsetDateTime confirmTime,
            BigDecimal anchorLevel,
            BigDecimal breakPrice
    ) {
    }

    private record RetraceGate(
            boolean satisfied,
            int targetIndex,
            OffsetDateTime targetTime,
            BigDecimal targetPrice,
            Integer retraceOkIndex,
            OffsetDateTime retraceOkTime,
            BigDecimal retraceTouchPrice,
            String referenceUsed,
            BigDecimal referenceLow,
            BigDecimal referenceHigh
    ) {
    }

    private record EntryOutcome(
            boolean filled,
            Integer fillIndex,
            OffsetDateTime entryTime,
            BigDecimal entryPrice,
            OffsetDateTime displacementTime,
            OffsetDateTime confirmTime,
            String model
    ) {
    }

    private record ExecutionCostBreakdown(
            BigDecimal rawPrice,
            BigDecimal spreadAdjustment,
            BigDecimal slippageAdjustment,
            BigDecimal finalPrice
    ) {
    }

    private record ExitOutcome(
            int exitIndex,
            OffsetDateTime exitTime,
            BigDecimal exitPrice,
            BacktestExitReason exitReason
    ) {
    }

    private record Excursion(BigDecimal maeR, BigDecimal mfeR) {
    }

    private record VariantMetrics(
            int variantIndex,
            JsonNode params,
            Integer trades,
            Integer sampleSize,
            BigDecimal winRate,
            BigDecimal profitFactor,
            BigDecimal expectancyR,
            BigDecimal avgR,
            BigDecimal maxDdR,
            BigDecimal fillRate,
            BigDecimal avgMaeR,
            BigDecimal avgMfeR,
            BigDecimal avgDurationSec,
            String confidenceNote
    ) {
    }

    private record EngineTrade(
            String sessionName,
            String sweepType,
            String confirmType,
            Direction direction,
            BacktestOrderType orderType,
            OffsetDateTime sweepTimeUtc,
            OffsetDateTime displacementTimeUtc,
            OffsetDateTime confirmTimeUtc,
            OffsetDateTime entryTimeUtc,
            BigDecimal entryPrice,
            BigDecimal stopLossPrice,
            BigDecimal takeProfitPrice,
            OffsetDateTime exitTimeUtc,
            BigDecimal exitPrice,
            BacktestExitReason exitReason,
            String fillStatus,
            BigDecimal rMultiple,
            BigDecimal maeR,
            BigDecimal mfeR,
            Integer durationSec,
            JsonNode metadata,
            JsonNode setupEvidence,
            JsonNode tradeEvidence
    ) {
    }

    private record EngineOutput(
            BacktestTimeframe executionTimeframe,
            BacktestDataset sourceDataset,
            List<BacktestCandle> candles,
            List<EngineTrade> trades,
            JsonNode filtersSnapshot,
            RunDiagnostics diagnostics
    ) {
    }

    private record SessionStats(BigDecimal high, BigDecimal low) {
    }

    private record SessionLevelRecord(
            String sessionName,
            LocalDate sessionDate,
            BigDecimal high,
            BigDecimal low,
            int firstIndex,
            int lastIndex,
            OffsetDateTime firstTime,
            OffsetDateTime lastTime
    ) {
    }

    private static final class SessionStatsMutable {
        private BigDecimal high;
        private BigDecimal low;
        private int count;

        void include(BigDecimal highValue, BigDecimal lowValue) {
            if (high == null || highValue.compareTo(high) > 0) {
                high = highValue;
            }
            if (low == null || lowValue.compareTo(low) < 0) {
                low = lowValue;
            }
            count++;
        }
    }

    private static final class SessionLevelMutable {
        private BigDecimal high;
        private BigDecimal low;
        private int firstIndex = -1;
        private int lastIndex = -1;
        private OffsetDateTime firstTime;
        private OffsetDateTime lastTime;

        void include(BigDecimal highValue, BigDecimal lowValue, int index, OffsetDateTime time) {
            if (high == null || highValue.compareTo(high) > 0) {
                high = highValue;
            }
            if (low == null || lowValue.compareTo(low) < 0) {
                low = lowValue;
            }
            if (firstIndex < 0 || index < firstIndex) {
                firstIndex = index;
                firstTime = time;
            }
            if (lastIndex < 0 || index > lastIndex) {
                lastIndex = index;
                lastTime = time;
            }
        }
    }

    private record DayStats(BigDecimal high, BigDecimal low) {
    }

    private static final class DayStatsMutable {
        private BigDecimal high;
        private BigDecimal low;

        void include(BigDecimal highValue, BigDecimal lowValue) {
            if (high == null || highValue.compareTo(high) > 0) {
                high = highValue;
            }
            if (low == null || lowValue.compareTo(low) < 0) {
                low = lowValue;
            }
        }
    }

    private record WeekStats(BigDecimal high, BigDecimal low) {
    }

    private static final class WeekStatsMutable {
        private BigDecimal high;
        private BigDecimal low;

        void include(BigDecimal highValue, BigDecimal lowValue) {
            if (high == null || highValue.compareTo(high) > 0) {
                high = highValue;
            }
            if (low == null || lowValue.compareTo(low) < 0) {
                low = lowValue;
            }
        }
    }

    private record LiquidityPoolCandidate(
            String id,
            String type,
            SweepSide side,
            BigDecimal levelPrice,
            int touches,
            int createdIndex,
            OffsetDateTime createdTime,
            BigDecimal significance,
            String sourceSessionName
    ) {
    }

    private record PivotMarkers(boolean[] pivotHigh, boolean[] pivotLow) {
    }

    private record SwingPair(
            int previousIndex,
            BigDecimal previousPrice,
            int latestIndex,
            BigDecimal latestPrice
    ) {
    }

    private record StructureContext(
            BigDecimal previousSwingHigh,
            BigDecimal latestSwingHigh,
            String highLabel,
            BigDecimal previousSwingLow,
            BigDecimal latestSwingLow,
            String lowLabel,
            String trend
    ) {
        private static StructureContext empty() {
            return new StructureContext(null, null, "N/A", null, null, "N/A", "MIXED");
        }
    }

    private static final class PoolCluster {
        private int firstTouchIndex;
        private int lastTouchIndex;
        private OffsetDateTime lastTouchTime;
        private BigDecimal level;
        private int touches;
        private BigDecimal minPrice;
        private BigDecimal maxPrice;

        static PoolCluster seed(int touchIndex, BigDecimal touchPrice, OffsetDateTime touchTime) {
            PoolCluster cluster = new PoolCluster();
            cluster.firstTouchIndex = touchIndex;
            cluster.lastTouchIndex = touchIndex;
            cluster.lastTouchTime = touchTime;
            cluster.level = touchPrice;
            cluster.touches = 1;
            cluster.minPrice = touchPrice;
            cluster.maxPrice = touchPrice;
            return cluster;
        }

        void touch(int touchIndex, BigDecimal touchPrice, OffsetDateTime touchTime) {
            touches++;
            lastTouchIndex = touchIndex;
            lastTouchTime = touchTime;
            level = level.multiply(BigDecimal.valueOf(touches - 1L))
                    .add(touchPrice)
                    .divide(BigDecimal.valueOf(touches), 8, RoundingMode.HALF_UP);
            if (touchPrice.compareTo(minPrice) < 0) {
                minPrice = touchPrice;
            }
            if (touchPrice.compareTo(maxPrice) > 0) {
                maxPrice = touchPrice;
            }
        }

        int lastTouchIndex() {
            return lastTouchIndex;
        }

        OffsetDateTime lastTouchTime() {
            return lastTouchTime;
        }

        BigDecimal level() {
            return level;
        }

        int touches() {
            return touches;
        }

        BigDecimal significance() {
            return maxPrice.subtract(minPrice).abs();
        }
    }

    private static final class AggState {
        private BigDecimal open;
        private BigDecimal high;
        private BigDecimal low;
        private BigDecimal close;
        private long volume;

        void include(BacktestCandle candle) {
            if (open == null) {
                open = candle.open();
            }
            close = candle.close();
            if (high == null || candle.high().compareTo(high) > 0) {
                high = candle.high();
            }
            if (low == null || candle.low().compareTo(low) < 0) {
                low = candle.low();
            }
            volume += candle.volume();
        }
    }

    private record PivotState(BigDecimal[] lastPivotHigh, BigDecimal[] lastPivotLow) {
        BigDecimal lastPivotHighPrice(int index) {
            if (index < 0 || index >= lastPivotHigh.length) {
                return null;
            }
            return lastPivotHigh[index];
        }

        BigDecimal lastPivotLowPrice(int index) {
            if (index < 0 || index >= lastPivotLow.length) {
                return null;
            }
            return lastPivotLow[index];
        }
    }
}
