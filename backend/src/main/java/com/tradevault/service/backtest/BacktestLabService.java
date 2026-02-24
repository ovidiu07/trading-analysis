package com.tradevault.service.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.domain.entity.BacktestDataset;
import com.tradevault.domain.entity.BacktestDatasetSet;
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
import com.tradevault.dto.backtest.BacktestLabRunRequest;
import com.tradevault.dto.backtest.BacktestLabRunResponse;
import com.tradevault.dto.backtest.BacktestLabRunResultsResponse;
import com.tradevault.dto.backtest.BacktestLabSummaryResponse;
import com.tradevault.dto.backtest.BacktestLabTimelineEventResponse;
import com.tradevault.dto.backtest.BacktestLabTradeResultResponse;
import com.tradevault.dto.backtest.BacktestRunReportResponse;
import com.tradevault.dto.backtest.BacktestSessionPreviewResponse;
import com.tradevault.dto.backtest.BacktestStrategyConfigResponse;
import com.tradevault.dto.backtest.BacktestStrategyConfigUpsertRequest;
import com.tradevault.dto.backtest.CsvIngestRequest;
import com.tradevault.dto.backtest.CsvUploadResponse;
import com.tradevault.repository.BacktestDatasetRepository;
import com.tradevault.repository.BacktestDatasetSetRepository;
import com.tradevault.repository.BacktestRunReportRepository;
import com.tradevault.repository.BacktestRunRepository;
import com.tradevault.repository.BacktestSetupRepository;
import com.tradevault.repository.BacktestStrategyConfigRepository;
import com.tradevault.repository.BacktestTradeRepository;
import com.tradevault.service.CurrentUserService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
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

@Service
@RequiredArgsConstructor
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
    private final BacktestCsvService backtestCsvService;
    private final CandleDataService candleDataService;
    private final ObjectMapper objectMapper;

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

        dataset.setDatasetSet(set);
        dataset.setOriginalFilename(file == null ? dataset.getName() : file.getOriginalFilename());
        dataset.setMinTimeUtc(dataset.getDataFrom());
        dataset.setMaxTimeUtc(dataset.getDataTo());
        dataset.setCandleCount(dataset.getRowCount());
        dataset.setParsedOk(Boolean.TRUE);
        dataset.setErrorMsg(null);
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

        Range range = resolveRunRange(set, request == null ? null : request.getFromUtc(), request == null ? null : request.getToUtc());

        BacktestRun run = BacktestRun.builder()
                .user(user)
                .symbol(set.getInstrument())
                .timeframe("M5")
                .rangeFrom(range.fromUtc())
                .rangeTo(range.toUtc())
                .sessionWindow(normalizeOptionalText(request == null ? null : request.getSessionFilter()))
                .provider("CSV")
                .sourceId(set.getId().toString())
                .datasetSet(set)
                .strategyConfig(strategyConfig)
                .fromUtc(range.fromUtc())
                .toUtc(range.toUtc())
                .status(BacktestRunStatus.RUNNING)
                .candleCount(0)
                .build();
        run = runRepository.save(run);

        try {
            EngineOutput output = executeRunEngine(run, set, strategyConfig, request);

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

            return toRunResponse(run);
        } catch (Exception ex) {
            run.setStatus(BacktestRunStatus.FAILED);
            run.setCompletedAt(OffsetDateTime.now(ZoneOffset.UTC));
            run.setErrorMsg(truncate(ex.getMessage(), 800));
            runRepository.save(run);
            return toRunResponse(run);
        }
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
                                          BacktestStrategyConfig strategyConfig,
                                          BacktestLabRunRequest request) {
        List<BacktestDataset> datasets = datasetRepository.findByDatasetSet_IdOrderByCreatedAtAsc(set.getId());
        if (datasets.isEmpty()) {
            throw new IllegalArgumentException("No datasets found for this dataset set");
        }

        ParsedConfig config = parseConfig(strategyConfig, set);
        DatasetSelection selection = chooseExecutionDataset(datasets, config.executionTimeframeRequested());

        OffsetDateTime fromUtc = clampToRange(run.getFromUtc(), selection.minTimeUtc(), selection.maxTimeUtc());
        OffsetDateTime toUtc = clampToRange(run.getToUtc(), selection.minTimeUtc(), selection.maxTimeUtc());
        if (fromUtc.isAfter(toUtc)) {
            throw new IllegalArgumentException("Selected date range does not overlap dataset range");
        }

        List<BacktestCandle> sourceCandles = loadDatasetCandles(run.getUser().getId(), selection.sourceDataset(), fromUtc, toUtc);
        List<BacktestCandle> execCandles = selection.resample()
                ? resampleCandles(sourceCandles, selection.executionTimeframe())
                : sourceCandles;

        List<BacktestCandle> candles = execCandles.stream()
                .sorted(Comparator.comparing(BacktestCandle::timestamp))
                .toList();
        if (candles.size() < 30) {
            throw new IllegalArgumentException("Not enough candles in selected range");
        }

        List<BacktestCandle> dailyCandles = loadDailyCandles(run.getUser().getId(), datasets, selection.sourceDataset(), fromUtc, toUtc, candles);

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
                filters
        );
    }

    private List<EngineTrade> simulateTrades(List<BacktestCandle> candles,
                                             ParsedConfig config,
                                             SessionWindow setupSession,
                                             Map<LocalDate, SessionStats> sessionStats,
                                             Map<LocalDate, DayStats> dailyStats,
                                             PivotState pivots) {
        List<EngineTrade> trades = new ArrayList<>();
        Map<String, Integer> sessionCounter = new HashMap<>();
        Map<LocalDate, Integer> dayCounter = new HashMap<>();

        BigDecimal buffer = config.touchTolerancePips().multiply(config.pipSize());
        BigDecimal confirmBreakBuffer = config.confirmBreakBufferPips().multiply(config.pipSize());
        BigDecimal cost = config.spreadPips().add(config.slippagePips()).multiply(config.pipSize());

        for (int i = Math.max(3, config.bodyLookback()); i < candles.size() - 3; i++) {
            BacktestCandle sweepCandle = candles.get(i);
            SessionStamp stamp = assignSession(sweepCandle.timestamp(), setupSession);
            if (stamp == null) {
                continue;
            }

            LocalDate sessionDate = stamp.sessionDateKey();
            LevelPair levels = resolveLevels(config.sweepType(), sessionDate, sessionStats, dailyStats);
            if (levels == null || levels.high() == null || levels.low() == null) {
                continue;
            }

            Sweep sweep = detectSweep(sweepCandle, levels, buffer);
            if (sweep == null) {
                continue;
            }

            String directionMode = config.directionMode();
            Direction direction = switch (directionMode) {
                case "LONG" -> Direction.LONG;
                case "SHORT" -> Direction.SHORT;
                default -> sweep.side() == SweepSide.HIGH ? Direction.SHORT : Direction.LONG;
            };

            int displacementIndex = findDisplacementIndex(candles, i + 1, sweep.side(), sweep.levelPrice(), buffer, config.displacementMultiplier(), config.bodyLookback());
            if (displacementIndex < 0) {
                continue;
            }

            BacktestCandle displacement = candles.get(displacementIndex);
            BigDecimal displacementRatio = bodyRatio(candles, displacementIndex, config.bodyLookback());

            int confirmIndex = findConfirmIndex(candles, pivots, displacementIndex + 1, direction, confirmBreakBuffer, config.confirmationType());
            if (confirmIndex < 0) {
                continue;
            }

            BacktestCandle confirm = candles.get(confirmIndex);
            if (config.antiChop() && confirmIndex + 1 < candles.size()) {
                BacktestCandle next = candles.get(confirmIndex + 1);
                if (next.high().compareTo(displacement.high()) >= 0 && next.low().compareTo(displacement.low()) <= 0) {
                    continue;
                }
            }

            String sessionKey = setupSession.name() + ":" + sessionDate;
            int usedInSession = sessionCounter.getOrDefault(sessionKey, 0);
            if (config.maxTradesPerSession() > 0 && usedInSession >= config.maxTradesPerSession()) {
                continue;
            }
            int usedInDay = dayCounter.getOrDefault(sessionDate, 0);
            if (config.maxTradesPerDay() > 0 && usedInDay >= config.maxTradesPerDay()) {
                continue;
            }

            EntryOutcome entry = resolveEntry(config, candles, displacementIndex, confirmIndex, direction);
            if (!entry.filled()) {
                EngineTrade noFill = buildNoFillTrade(config, setupSession, sessionDate, sweep, displacementIndex, confirmIndex, entry, displacementRatio, direction);
                trades.add(noFill);
                sessionCounter.put(sessionKey, usedInSession + 1);
                dayCounter.put(sessionDate, usedInDay + 1);
                i = Math.max(i, confirmIndex);
                continue;
            }

            BigDecimal stopLoss = resolveStop(config, candles, pivots, sweep, entry.fillIndex(), direction, buffer);
            if (stopLoss == null) {
                continue;
            }
            BigDecimal takeProfit = resolveTakeProfit(config, entry.entryPrice(), stopLoss, direction);
            BigDecimal rr = rr(entry.entryPrice(), stopLoss, takeProfit);
            if (rr == null || rr.compareTo(config.minRR()) < 0) {
                continue;
            }

            BigDecimal entryPrice = applyEntryCost(entry.entryPrice(), direction, cost);
            BigDecimal risk = entryPrice.subtract(stopLoss).abs();
            if (risk.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            ExitOutcome exit = resolveExit(candles, entry.fillIndex(), direction, stopLoss, takeProfit);
            BigDecimal exitPrice = applyExitCost(exit.exitPrice(), direction, cost);
            BigDecimal rMultiple = calcR(direction, entryPrice, exitPrice, risk);
            Excursion excursion = computeExcursion(candles, entry.fillIndex(), exit.exitIndex(), direction, entryPrice, risk);
            Integer durationSec = null;
            if (entry.entryTime() != null && exit.exitTime() != null) {
                durationSec = Math.toIntExact(Math.max(0, Duration.between(entry.entryTime(), exit.exitTime()).toSeconds()));
            }

            ObjectNode setupEvidence = objectMapper.createObjectNode();
            setupEvidence.put("sessionName", setupSession.name());
            setupEvidence.put("sessionDate", sessionDate.toString());
            setupEvidence.put("sweepSide", sweep.side().name());
            setupEvidence.put("sweepDepth", sweep.depth().setScale(6, RoundingMode.HALF_UP).toPlainString());
            setupEvidence.put("levelPrice", sweep.levelPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());

            ObjectNode tradeEvidence = objectMapper.createObjectNode();
            tradeEvidence.put("sessionName", setupSession.name());
            tradeEvidence.put("sessionDate", sessionDate.toString());
            tradeEvidence.put("sweepSide", sweep.side().name());
            tradeEvidence.put("displacementRatio", displacementRatio == null ? 0 : displacementRatio.setScale(4, RoundingMode.HALF_UP).doubleValue());
            tradeEvidence.put("pivotBroken", direction == Direction.LONG ? "HIGH" : "LOW");
            tradeEvidence.put("confirmToExitBars", Math.max(1, exit.exitIndex() - confirmIndex + 1));
            tradeEvidence.set("timeline", buildTimeline(sweep, candles.get(displacementIndex), confirm, entry, exit));

            ObjectNode metadata = objectMapper.createObjectNode();
            metadata.put("entryModel", config.entryModelType());
            metadata.put("stopRule", config.stopRule());
            metadata.put("tpRule", "FIXED_R");

            EngineTrade trade = new EngineTrade(
                    setupSession.name(),
                    config.sweepType(),
                    config.confirmationType(),
                    direction,
                    BacktestOrderType.valueOf(config.entryModelType().startsWith("LIMIT") ? "LIMIT" : "MARKET"),
                    sweepCandle.timestamp(),
                    displacement.timestamp(),
                    confirm.timestamp(),
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
            dayCounter.put(sessionDate, usedInDay + 1);
            i = Math.max(i, confirmIndex);
        }

        return trades;
    }

    private EngineTrade buildNoFillTrade(ParsedConfig config,
                                         SessionWindow setupSession,
                                         LocalDate sessionDate,
                                         Sweep sweep,
                                         int displacementIndex,
                                         int confirmIndex,
                                         EntryOutcome entry,
                                         BigDecimal displacementRatio,
                                         Direction direction) {
        ObjectNode metadata = objectMapper.createObjectNode();
        metadata.put("entryModel", config.entryModelType());
        metadata.put("status", "NO_FILL");

        ObjectNode setupEvidence = objectMapper.createObjectNode();
        setupEvidence.put("sessionName", setupSession.name());
        setupEvidence.put("sessionDate", sessionDate.toString());
        setupEvidence.put("sweepSide", sweep.side().name());

        ObjectNode tradeEvidence = objectMapper.createObjectNode();
        tradeEvidence.put("sessionName", setupSession.name());
        tradeEvidence.put("sessionDate", sessionDate.toString());
        tradeEvidence.put("displacementRatio", displacementRatio == null ? 0 : displacementRatio.setScale(4, RoundingMode.HALF_UP).doubleValue());
        tradeEvidence.set("timeline", buildNoFillTimeline(sweep, entry));

        return new EngineTrade(
                setupSession.name(),
                config.sweepType(),
                config.confirmationType(),
                direction,
                BacktestOrderType.valueOf(config.entryModelType().startsWith("LIMIT") ? "LIMIT" : "MARKET"),
                sweep.sweepTime(),
                entry.displacementTime(),
                entry.confirmTime(),
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

    private ArrayNode buildNoFillTimeline(Sweep sweep, EntryOutcome entry) {
        ArrayNode timeline = objectMapper.createArrayNode();
        timeline.add(timelineNode("SWEEP", sweep.sweepTime(), objectMapper.createObjectNode().put("side", sweep.side().name())));
        if (entry.displacementTime() != null) {
            timeline.add(timelineNode("DISPLACEMENT", entry.displacementTime(), objectMapper.createObjectNode()));
        }
        if (entry.confirmTime() != null) {
            timeline.add(timelineNode("CONFIRM", entry.confirmTime(), objectMapper.createObjectNode()));
        }
        timeline.add(timelineNode("ENTRY", null, objectMapper.createObjectNode().put("status", "NO_FILL")));
        return timeline;
    }

    private ArrayNode buildTimeline(Sweep sweep,
                                    BacktestCandle displacement,
                                    BacktestCandle confirm,
                                    EntryOutcome entry,
                                    ExitOutcome exit) {
        ArrayNode timeline = objectMapper.createArrayNode();

        ObjectNode sweepDetails = objectMapper.createObjectNode();
        sweepDetails.put("side", sweep.side().name());
        sweepDetails.put("level", sweep.levelPrice().setScale(6, RoundingMode.HALF_UP).toPlainString());
        sweepDetails.put("depth", sweep.depth().setScale(6, RoundingMode.HALF_UP).toPlainString());
        timeline.add(timelineNode("SWEEP", sweep.sweepTime(), sweepDetails));

        ObjectNode displacementDetails = objectMapper.createObjectNode();
        displacementDetails.put("open", displacement.open().toPlainString());
        displacementDetails.put("close", displacement.close().toPlainString());
        timeline.add(timelineNode("DISPLACEMENT", displacement.timestamp(), displacementDetails));

        ObjectNode confirmDetails = objectMapper.createObjectNode();
        confirmDetails.put("close", confirm.close().toPlainString());
        timeline.add(timelineNode("MSS_BOS", confirm.timestamp(), confirmDetails));

        ObjectNode entryDetails = objectMapper.createObjectNode();
        entryDetails.put("price", entry.entryPrice().toPlainString());
        timeline.add(timelineNode("ENTRY", entry.entryTime(), entryDetails));

        ObjectNode exitDetails = objectMapper.createObjectNode();
        exitDetails.put("reason", exit.exitReason().name());
        if (exit.exitPrice() != null) {
            exitDetails.put("price", exit.exitPrice().toPlainString());
        }
        timeline.add(timelineNode("EXIT", exit.exitTime(), exitDetails));

        return timeline;
    }

    private ObjectNode timelineNode(String stage, OffsetDateTime timeUtc, ObjectNode details) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("stage", stage);
        if (timeUtc != null) {
            node.put("timeUtc", timeUtc.toString());
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
                                      int displacementIndex,
                                      int confirmIndex,
                                      Direction direction) {
        BacktestCandle displacement = candles.get(displacementIndex);
        BacktestCandle confirm = candles.get(confirmIndex);

        if ("MARKET_ON_CONFIRM_CLOSE".equals(config.entryModelType())) {
            return new EntryOutcome(
                    true,
                    confirmIndex,
                    confirm.timestamp(),
                    confirm.close(),
                    displacement.timestamp(),
                    confirm.timestamp()
            );
        }

        BigDecimal retrace = config.retracePercent().divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);
        BigDecimal range = displacement.high().subtract(displacement.low()).abs();
        BigDecimal entryPrice;
        if (direction == Direction.LONG) {
            entryPrice = displacement.high().subtract(range.multiply(retrace));
        } else {
            entryPrice = displacement.low().add(range.multiply(retrace));
        }

        int until = Math.min(candles.size() - 1, confirmIndex + Math.max(1, config.entryWindowBars()));
        for (int i = confirmIndex + 1; i <= until; i++) {
            BacktestCandle candle = candles.get(i);
            if (candle.low().compareTo(entryPrice) <= 0 && candle.high().compareTo(entryPrice) >= 0) {
                return new EntryOutcome(true, i, candle.timestamp(), entryPrice, displacement.timestamp(), confirm.timestamp());
            }
        }

        return new EntryOutcome(false, null, null, entryPrice, displacement.timestamp(), confirm.timestamp());
    }

    private int findConfirmIndex(List<BacktestCandle> candles,
                                 PivotState pivots,
                                 int start,
                                 Direction direction,
                                 BigDecimal buffer,
                                 String confirmationType) {
        int until = Math.min(candles.size() - 1, start + 20);
        for (int i = start; i <= until; i++) {
            BacktestCandle candle = candles.get(i);
            if (direction == Direction.LONG) {
                BigDecimal pivotHigh = pivots.lastPivotHighPrice(i - 1);
                if (pivotHigh != null && candle.close().compareTo(pivotHigh.add(buffer)) > 0) {
                    return i;
                }
            } else {
                BigDecimal pivotLow = pivots.lastPivotLowPrice(i - 1);
                if (pivotLow != null && candle.close().compareTo(pivotLow.subtract(buffer)) < 0) {
                    return i;
                }
            }
        }
        return -1;
    }

    private int findDisplacementIndex(List<BacktestCandle> candles,
                                      int start,
                                      SweepSide sweepSide,
                                      BigDecimal levelPrice,
                                      BigDecimal buffer,
                                      BigDecimal displacementMultiplier,
                                      int lookback) {
        int until = Math.min(candles.size() - 1, start + 20);
        for (int i = start; i <= until; i++) {
            BacktestCandle candle = candles.get(i);
            BigDecimal ratio = bodyRatio(candles, i, lookback);
            if (ratio == null || ratio.compareTo(displacementMultiplier) < 0) {
                continue;
            }

            boolean away;
            if (sweepSide == SweepSide.HIGH) {
                away = candle.close().compareTo(levelPrice.subtract(buffer)) <= 0 && candle.close().compareTo(candle.open()) < 0;
            } else {
                away = candle.close().compareTo(levelPrice.add(buffer)) >= 0 && candle.close().compareTo(candle.open()) > 0;
            }
            if (away) {
                return i;
            }
        }
        return -1;
    }

    private BigDecimal bodyRatio(List<BacktestCandle> candles, int index, int lookback) {
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
        BigDecimal avg = total.divide(BigDecimal.valueOf(count), 8, RoundingMode.HALF_UP);
        if (avg.compareTo(BigDecimal.ZERO) == 0) {
            return null;
        }
        BigDecimal current = candles.get(index).close().subtract(candles.get(index).open()).abs();
        return current.divide(avg, 8, RoundingMode.HALF_UP);
    }

    private Sweep detectSweep(BacktestCandle candle, LevelPair levels, BigDecimal buffer) {
        boolean highSweep = candle.high().compareTo(levels.high().add(buffer)) >= 0
                && candle.close().compareTo(levels.high()) < 0;
        boolean lowSweep = candle.low().compareTo(levels.low().subtract(buffer)) <= 0
                && candle.close().compareTo(levels.low()) > 0;

        if (!highSweep && !lowSweep) {
            return null;
        }

        if (highSweep && lowSweep) {
            BigDecimal highDepth = candle.high().subtract(levels.high()).abs();
            BigDecimal lowDepth = levels.low().subtract(candle.low()).abs();
            if (highDepth.compareTo(lowDepth) >= 0) {
                return new Sweep(SweepSide.HIGH, levels.high(), highDepth, candle.high(), candle.timestamp());
            }
            return new Sweep(SweepSide.LOW, levels.low(), lowDepth, candle.low(), candle.timestamp());
        }

        if (highSweep) {
            return new Sweep(SweepSide.HIGH, levels.high(), candle.high().subtract(levels.high()).abs(), candle.high(), candle.timestamp());
        }
        return new Sweep(SweepSide.LOW, levels.low(), levels.low().subtract(candle.low()).abs(), candle.low(), candle.timestamp());
    }

    private LevelPair resolveLevels(String sweepType,
                                    LocalDate sessionDate,
                                    Map<LocalDate, SessionStats> sessionStats,
                                    Map<LocalDate, DayStats> dailyStats) {
        String normalized = normalizeOptionalText(sweepType);
        if (normalized == null || normalized.equals("SESSION_HL") || normalized.equals("EQH_EQL") || normalized.equals("HTF_SWING")) {
            SessionStats previous = sessionStats.get(sessionDate.minusDays(1));
            if (previous == null) {
                return null;
            }
            return new LevelPair(previous.high(), previous.low());
        }

        DayStats previousDay = dailyStats.get(sessionDate.minusDays(1));
        if (previousDay == null) {
            return null;
        }
        return new LevelPair(previousDay.high(), previousDay.low());
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
        Map<BacktestTimeframe, BacktestDataset> byTf = new LinkedHashMap<>();
        for (BacktestDataset dataset : datasets) {
            byTf.putIfAbsent(dataset.getTimeframe(), dataset);
        }

        BacktestDataset exact = byTf.get(requestedTimeframe);
        if (exact != null) {
            return new DatasetSelection(exact, requestedTimeframe, false, rangeMin(exact), rangeMax(exact));
        }

        List<BacktestDataset> sorted = datasets.stream()
                .sorted(Comparator.comparing(item -> item.getTimeframe().duration()))
                .toList();

        BacktestDataset source = null;
        for (BacktestDataset dataset : sorted) {
            if (dataset.getTimeframe().duration().compareTo(requestedTimeframe.duration()) <= 0) {
                source = dataset;
            }
        }

        if (source != null) {
            return new DatasetSelection(source, requestedTimeframe, source.getTimeframe() != requestedTimeframe, rangeMin(source), rangeMax(source));
        }

        BacktestDataset fallback = sorted.get(0);
        return new DatasetSelection(fallback, fallback.getTimeframe(), false, rangeMin(fallback), rangeMax(fallback));
    }

    private ParsedConfig parseConfig(BacktestStrategyConfig strategyConfig, BacktestDatasetSet set) {
        JsonNode root = strategyConfig.getConfigJson() == null ? JsonNodeFactory.instance.objectNode() : strategyConfig.getConfigJson();

        BacktestTimeframe requestedTf;
        try {
            requestedTf = BacktestTimeframe.from(text(path(root, "context", "executionTimeframe"), "M5"));
        } catch (Exception ex) {
            requestedTf = BacktestTimeframe.M5;
        }

        List<SessionWindow> sessions = parseSessions(root, text(path(root, "context", "timezoneBasis"), set.getTimezoneBasis()));

        return new ParsedConfig(
                text(path(root, "name"), STRATEGY_DEFAULT_NAME),
                decimal(path(root, "context", "pipSize"), inferPipSize(set.getInstrument())),
                decimal(path(root, "context", "spreadPips"), BigDecimal.ZERO),
                decimal(path(root, "context", "slippagePips"), BigDecimal.ZERO),
                decimal(path(root, "context", "touchTolerancePips"), BigDecimal.valueOf(0.1)),
                text(path(root, "context", "timezoneBasis"), set.getTimezoneBasis()),
                requestedTf,
                sessions,
                text(path(root, "setupRule", "session"), "LONDON"),
                text(path(root, "setupRule", "sweepType"), "SESSION_HL"),
                text(path(root, "setupRule", "confirmationType"), "MSS"),
                text(path(root, "setupRule", "direction"), "AUTO_FROM_SWEEP"),
                text(path(root, "entryModel", "type"), "MARKET_ON_CONFIRM_CLOSE"),
                decimal(path(root, "entryModel", "retracePercent"), BigDecimal.valueOf(50)),
                integer(path(root, "entryModel", "entryWindowBars"), 5),
                text(path(root, "riskModel", "stopRule"), "SWEEP_EXTREME_PLUS_BUFFER"),
                decimal(path(root, "riskModel", "fixedR"), BigDecimal.valueOf(2.0)),
                decimal(path(root, "riskModel", "minRR"), BigDecimal.valueOf(1.5)),
                decimal(path(root, "qualityFilters", "displacementMultiplier"), BigDecimal.valueOf(1.5)),
                integer(path(root, "qualityFilters", "bodyLookback"), 20),
                bool(path(root, "qualityFilters", "antiChop"), true),
                integer(path(root, "qualityFilters", "maxTradesPerSession"), 1),
                integer(path(root, "qualityFilters", "maxTradesPerDay"), 3),
                integer(path(root, "qualityFilters", "pivotLeft"), 2),
                integer(path(root, "qualityFilters", "pivotRight"), 2),
                decimal(path(root, "qualityFilters", "confirmBreakBufferPips"), BigDecimal.ZERO)
        );
    }

    private List<SessionWindow> parseSessions(JsonNode root, String timezoneBasis) {
        JsonNode sessionsNode = path(root, "sessions");
        if (sessionsNode != null && sessionsNode.isArray()) {
            List<SessionWindow> rows = new ArrayList<>();
            for (JsonNode item : sessionsNode) {
                String name = text(item.path("name"), null);
                String zone = text(item.path("zoneId"), "UTC");
                String start = text(item.path("startLocal"), "08:00");
                String end = text(item.path("endLocal"), "17:00");
                if (name == null) {
                    continue;
                }
                rows.add(new SessionWindow(name, zone, parseLocalTime(start), parseLocalTime(end)));
            }
            if (!rows.isEmpty()) {
                return rows;
            }
        }
        return defaultSessions(timezoneBasis);
    }

    private List<SessionWindow> defaultSessions(String timezoneBasisRaw) {
        String basis = normalizeTimezoneBasis(timezoneBasisRaw);
        if ("UTC".equalsIgnoreCase(basis)) {
            return List.of(
                    new SessionWindow("ASIA", "UTC", LocalTime.of(0, 0), LocalTime.of(7, 0)),
                    new SessionWindow("LONDON", "UTC", LocalTime.of(8, 0), LocalTime.of(17, 0)),
                    new SessionWindow("NY", "UTC", LocalTime.of(13, 0), LocalTime.of(22, 0))
            );
        }

        return List.of(
                new SessionWindow("ASIA", "Asia/Tokyo", LocalTime.of(8, 0), LocalTime.of(17, 0)),
                new SessionWindow("LONDON", "Europe/London", LocalTime.of(8, 0), LocalTime.of(17, 0)),
                new SessionWindow("NY", "America/New_York", LocalTime.of(8, 0), LocalTime.of(17, 0))
        );
    }

    private SessionWindow resolveSessionWindow(List<SessionWindow> sessions, String sessionName) {
        if (sessions == null || sessions.isEmpty()) {
            return new SessionWindow("LONDON", "Europe/London", LocalTime.of(8, 0), LocalTime.of(17, 0));
        }
        if (sessionName == null || sessionName.isBlank()) {
            return sessions.get(0);
        }
        for (SessionWindow session : sessions) {
            if (session.name().equalsIgnoreCase(sessionName.trim())) {
                return session;
            }
        }
        return sessions.get(0);
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

    private Range resolveRunRange(BacktestDatasetSet set, OffsetDateTime requestedFrom, OffsetDateTime requestedTo) {
        List<BacktestDataset> datasets = datasetRepository.findByDatasetSet_IdOrderByCreatedAtAsc(set.getId());
        if (datasets.isEmpty()) {
            throw new IllegalArgumentException("No datasets in selected set");
        }

        OffsetDateTime min = null;
        OffsetDateTime max = null;
        for (BacktestDataset dataset : datasets) {
            OffsetDateTime from = rangeMin(dataset);
            OffsetDateTime to = rangeMax(dataset);
            if (from != null && (min == null || from.isBefore(min))) {
                min = from;
            }
            if (to != null && (max == null || to.isAfter(max))) {
                max = to;
            }
        }
        if (min == null || max == null) {
            throw new IllegalArgumentException("Dataset range unavailable");
        }

        OffsetDateTime to = requestedTo == null ? max : requestedTo.withOffsetSameInstant(ZoneOffset.UTC);
        OffsetDateTime from = requestedFrom == null ? to.minusDays(30) : requestedFrom.withOffsetSameInstant(ZoneOffset.UTC);

        if (from.isBefore(min)) {
            from = min;
        }
        if (to.isAfter(max)) {
            to = max;
        }
        if (from.isAfter(to)) {
            from = min;
            to = max;
        }

        return new Range(from, to);
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

        List<String> warnings = new ArrayList<>();
        JsonNode warningNode = dataset.getMetadataJson() == null ? null : dataset.getMetadataJson().path("warnings");
        if (warningNode != null && warningNode.isArray()) {
            warningNode.forEach(item -> warnings.add(item.asText()));
        }

        String status;
        if (Boolean.FALSE.equals(dataset.getParsedOk())) {
            status = "ERROR";
        } else if (warnings.isEmpty()) {
            status = "READY";
        } else {
            status = "WARN";
        }

        return BacktestDatasetFileResponse.builder()
                .datasetId(dataset.getId())
                .timeframe(dataset.getTimeframe().name())
                .originalFilename(dataset.getOriginalFilename() == null ? dataset.getName() : dataset.getOriginalFilename())
                .minTimeUtc(rangeMin(dataset))
                .maxTimeUtc(rangeMax(dataset))
                .candleCount(dataset.getCandleCount() == null ? dataset.getRowCount() : dataset.getCandleCount())
                .columnsMapped(columnsMapped)
                .status(status)
                .errorMsg(dataset.getErrorMsg())
                .warnings(warnings)
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

    private BacktestLabRunResponse toRunResponse(BacktestRun run) {
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
                OffsetDateTime eventTime = parseOffset(item.path("timeUtc").asText(null));
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

        ObjectNode context = root.putObject("context");
        context.put("pipSize", inferPipSize(set.getInstrument()).doubleValue());
        context.put("spreadPips", 0.0);
        context.put("slippagePips", 0.0);
        context.put("touchTolerancePips", 0.1);
        context.put("timezoneBasis", normalizeTimezoneBasis(set.getTimezoneBasis()));
        context.put("executionTimeframe", "M5");

        ArrayNode sessions = root.putArray("sessions");
        for (SessionWindow window : defaultSessions(set.getTimezoneBasis())) {
            ObjectNode node = sessions.addObject();
            node.put("name", window.name());
            node.put("zoneId", window.zoneId());
            node.put("startLocal", window.startLocal().toString());
            node.put("endLocal", window.endLocal().toString());
        }

        ObjectNode setupRule = root.putObject("setupRule");
        setupRule.put("session", "LONDON");
        setupRule.put("sweepType", "SESSION_HL");
        setupRule.put("confirmationType", "MSS");
        setupRule.put("confirmationTf", "M5");
        setupRule.put("direction", "AUTO_FROM_SWEEP");

        ObjectNode entryModel = root.putObject("entryModel");
        entryModel.put("type", "MARKET_ON_CONFIRM_CLOSE");
        entryModel.put("retracePercent", 50);
        entryModel.put("entryWindowBars", 5);

        ObjectNode riskModel = root.putObject("riskModel");
        riskModel.put("stopRule", "SWEEP_EXTREME_PLUS_BUFFER");
        riskModel.put("tpRule", "FIXED_R");
        riskModel.put("fixedR", 2.0);
        riskModel.put("minRR", 1.5);

        ObjectNode quality = root.putObject("qualityFilters");
        quality.put("displacementMultiplier", 1.5);
        quality.put("bodyLookback", 20);
        quality.put("antiChop", true);
        quality.put("maxTradesPerSession", 1);
        quality.put("maxTradesPerDay", 3);
        quality.put("pivotLeft", 2);
        quality.put("pivotRight", 2);
        quality.put("confirmBreakBufferPips", 0.0);

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

    private OffsetDateTime parseOffset(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(raw);
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
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            return "UTC";
        }
        try {
            ZoneId.of(normalized);
            return normalized;
        } catch (Exception ex) {
            if ("CENTER_LOCAL".equalsIgnoreCase(normalized) || "CENTER-LOCAL".equalsIgnoreCase(normalized)) {
                return "CENTER_LOCAL";
            }
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

    private record SessionWindow(String name, String zoneId, LocalTime startLocal, LocalTime endLocal) {
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
            BigDecimal confirmBreakBufferPips
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

    private record Range(OffsetDateTime fromUtc, OffsetDateTime toUtc) {
    }

    private record LevelPair(BigDecimal high, BigDecimal low) {
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
            OffsetDateTime sweepTime
    ) {
    }

    private record EntryOutcome(
            boolean filled,
            Integer fillIndex,
            OffsetDateTime entryTime,
            BigDecimal entryPrice,
            OffsetDateTime displacementTime,
            OffsetDateTime confirmTime
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
            JsonNode filtersSnapshot
    ) {
    }

    private record SessionStats(BigDecimal high, BigDecimal low) {
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
