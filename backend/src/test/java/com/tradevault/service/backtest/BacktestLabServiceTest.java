package com.tradevault.service.backtest;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.domain.entity.BacktestDataset;
import com.tradevault.domain.entity.BacktestDatasetSet;
import com.tradevault.domain.entity.BacktestRun;
import com.tradevault.domain.entity.BacktestRunReport;
import com.tradevault.domain.entity.BacktestStrategyConfig;
import com.tradevault.domain.entity.BacktestTrade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestRunStatus;
import com.tradevault.domain.enums.BacktestTimeframe;
import com.tradevault.domain.enums.Direction;
import com.tradevault.dto.backtest.BacktestDatasetResponse;
import com.tradevault.dto.backtest.BacktestCandidateReviewRequest;
import com.tradevault.dto.backtest.BacktestLabRunRequest;
import com.tradevault.dto.backtest.BacktestLabRunResponse;
import com.tradevault.dto.backtest.BacktestOptimizerGridRequest;
import com.tradevault.dto.backtest.BacktestOptimizerRunRequest;
import com.tradevault.dto.backtest.BacktestPromotePlaybookRequest;
import com.tradevault.dto.backtest.BacktestDatasetSetDatasetsResponse;
import com.tradevault.dto.backtest.CsvIngestResponse;
import com.tradevault.dto.backtest.CsvUploadResponse;
import com.tradevault.repository.BacktestDatasetRepository;
import com.tradevault.repository.BacktestDatasetSetRepository;
import com.tradevault.repository.BacktestOptimizerRunRepository;
import com.tradevault.repository.BacktestRunReportRepository;
import com.tradevault.repository.BacktestRunRepository;
import com.tradevault.repository.BacktestCandidateReviewRepository;
import com.tradevault.repository.BacktestSetupRepository;
import com.tradevault.repository.BacktestStrategyConfigRepository;
import com.tradevault.repository.BacktestTradeRepository;
import com.tradevault.repository.StrategyPlaybookRepository;
import com.tradevault.service.CurrentUserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Constructor;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BacktestLabServiceTest {

    private CurrentUserService currentUserService;
    private BacktestDatasetSetRepository datasetSetRepository;
    private BacktestDatasetRepository datasetRepository;
    private BacktestStrategyConfigRepository strategyConfigRepository;
    private BacktestRunRepository runRepository;
    private BacktestSetupRepository setupRepository;
    private BacktestTradeRepository tradeRepository;
    private BacktestRunReportRepository reportRepository;
    private BacktestOptimizerRunRepository optimizerRunRepository;
    private BacktestCandidateReviewRepository candidateReviewRepository;
    private StrategyPlaybookRepository strategyPlaybookRepository;
    private BacktestCsvService backtestCsvService;
    private CandleDataService candleDataService;

    private BacktestLabService service;
    private User user;
    private BacktestDatasetSet datasetSet;
    private BacktestDataset dataset;
    private BacktestStrategyConfig strategyConfig;

    @BeforeEach
    void setup() {
        currentUserService = mock(CurrentUserService.class);
        datasetSetRepository = mock(BacktestDatasetSetRepository.class);
        datasetRepository = mock(BacktestDatasetRepository.class);
        strategyConfigRepository = mock(BacktestStrategyConfigRepository.class);
        runRepository = mock(BacktestRunRepository.class);
        setupRepository = mock(BacktestSetupRepository.class);
        tradeRepository = mock(BacktestTradeRepository.class);
        reportRepository = mock(BacktestRunReportRepository.class);
        optimizerRunRepository = mock(BacktestOptimizerRunRepository.class);
        candidateReviewRepository = mock(BacktestCandidateReviewRepository.class);
        strategyPlaybookRepository = mock(StrategyPlaybookRepository.class);
        backtestCsvService = mock(BacktestCsvService.class);
        candleDataService = mock(CandleDataService.class);

        service = new BacktestLabService(
                currentUserService,
                datasetSetRepository,
                datasetRepository,
                strategyConfigRepository,
                runRepository,
                setupRepository,
                tradeRepository,
                reportRepository,
                optimizerRunRepository,
                candidateReviewRepository,
                strategyPlaybookRepository,
                backtestCsvService,
                candleDataService,
                new ObjectMapper().findAndRegisterModules()
        );
        ReflectionTestUtils.setField(service, "minRequiredCandles", 30);

        user = User.builder().id(UUID.randomUUID()).email("lab@test.com").build();
        datasetSet = BacktestDatasetSet.builder()
                .id(UUID.randomUUID())
                .user(user)
                .instrument("EURUSD")
                .timezoneBasis("UTC")
                .build();
        dataset = BacktestDataset.builder()
                .id(UUID.randomUUID())
                .user(user)
                .datasetSet(datasetSet)
                .provider(BacktestCandleSource.CSV)
                .sourceId("SRC-1")
                .name("EURUSD_M5.csv")
                .symbolCanonical("EURUSD")
                .symbolDisplay("EURUSD")
                .timeframe(BacktestTimeframe.M5)
                .dataFrom(OffsetDateTime.parse("2026-02-03T00:00:00Z"))
                .dataTo(OffsetDateTime.parse("2026-02-05T23:59:59Z"))
                .minTimeUtc(OffsetDateTime.parse("2026-02-03T00:00:00Z"))
                .maxTimeUtc(OffsetDateTime.parse("2026-02-05T23:59:59Z"))
                .rowCount(500)
                .candleCount(500)
                .parsedOk(true)
                .build();

        strategyConfig = BacktestStrategyConfig.builder()
                .id(UUID.randomUUID())
                .datasetSet(datasetSet)
                .name("Asia Raid -> London Reversal")
                .configJson(buildFixtureReadyConfig())
                .build();

        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(datasetSetRepository.findByIdAndUser_Id(datasetSet.getId(), user.getId())).thenReturn(Optional.of(datasetSet));
        when(strategyConfigRepository.findByIdAndDatasetSet_User_Id(strategyConfig.getId(), user.getId())).thenReturn(Optional.of(strategyConfig));
        when(datasetRepository.findByDatasetSet_IdOrderByCreatedAtAsc(datasetSet.getId())).thenReturn(List.of(dataset));
        Map<UUID, com.tradevault.domain.entity.StrategyPlaybook> playbookStore = new HashMap<>();
        when(strategyPlaybookRepository.findFirstByRun_IdAndUser_IdOrderByUpdatedAtUtcDesc(any(), any())).thenAnswer(invocation -> {
            UUID runId = invocation.getArgument(0);
            UUID userId = invocation.getArgument(1);
            return playbookStore.values().stream()
                    .filter(item -> item.getRun() != null && runId.equals(item.getRun().getId()))
                    .filter(item -> item.getUser() != null && userId.equals(item.getUser().getId()))
                    .max(Comparator.comparing(item -> item.getUpdatedAtUtc() == null ? OffsetDateTime.MIN : item.getUpdatedAtUtc()));
        });
        when(strategyPlaybookRepository.save(any())).thenAnswer(invocation -> {
            com.tradevault.domain.entity.StrategyPlaybook playbook = invocation.getArgument(0);
            if (playbook.getId() == null) {
                playbook.setId(UUID.randomUUID());
            }
            playbookStore.put(playbook.getId(), playbook);
            return playbook;
        });
        when(strategyPlaybookRepository.findByIdAndUser_Id(any(), any())).thenAnswer(invocation -> {
            UUID playbookId = invocation.getArgument(0);
            UUID userId = invocation.getArgument(1);
            var playbook = playbookStore.get(playbookId);
            if (playbook == null || playbook.getUser() == null || !userId.equals(playbook.getUser().getId())) {
                return Optional.empty();
            }
            return Optional.of(playbook);
        });
        when(strategyPlaybookRepository.findByUser_IdOrderByUpdatedAtUtcDesc(any())).thenAnswer(invocation -> {
            UUID userId = invocation.getArgument(0);
            return playbookStore.values().stream()
                    .filter(item -> item.getUser() != null && userId.equals(item.getUser().getId()))
                    .sorted(Comparator.comparing((com.tradevault.domain.entity.StrategyPlaybook item) ->
                            item.getUpdatedAtUtc() == null ? OffsetDateTime.MIN : item.getUpdatedAtUtc()).reversed())
                    .toList();
        });

        Map<UUID, BacktestRun> runStore = new HashMap<>();
        when(runRepository.save(any())).thenAnswer(invocation -> {
            BacktestRun run = invocation.getArgument(0);
            if (run.getId() == null) {
                run.setId(UUID.randomUUID());
            }
            runStore.put(run.getId(), run);
            return run;
        });
        when(runRepository.findByIdAndUser_Id(any(), any())).thenAnswer(invocation -> {
            UUID runId = invocation.getArgument(0);
            UUID userId = invocation.getArgument(1);
            BacktestRun run = runStore.get(runId);
            if (run == null || run.getUser() == null || !userId.equals(run.getUser().getId())) {
                return Optional.empty();
            }
            return Optional.of(run);
        });

        List<com.tradevault.domain.entity.BacktestSetup> setupStore = new ArrayList<>();
        when(setupRepository.save(any())).thenAnswer(invocation -> {
            com.tradevault.domain.entity.BacktestSetup setup = invocation.getArgument(0);
            if (setup.getId() == null) {
                setup.setId(UUID.randomUUID());
            }
            setupStore.removeIf(existing -> setup.getId().equals(existing.getId()));
            setupStore.add(setup);
            return setup;
        });
        when(setupRepository.findByRun_IdAndRun_User_IdOrderByCreatedAtAsc(any(), any())).thenAnswer(invocation -> {
            UUID runId = invocation.getArgument(0);
            UUID userId = invocation.getArgument(1);
            return setupStore.stream()
                    .filter(item -> item.getRun() != null && runId.equals(item.getRun().getId()))
                    .filter(item -> item.getRun().getUser() != null && userId.equals(item.getRun().getUser().getId()))
                    .sorted(Comparator.comparing(item -> item.getCreatedAt() == null ? OffsetDateTime.MIN : item.getCreatedAt()))
                    .toList();
        });
        when(setupRepository.findByIdAndRun_User_Id(any(), any())).thenAnswer(invocation -> {
            UUID setupId = invocation.getArgument(0);
            UUID userId = invocation.getArgument(1);
            return setupStore.stream()
                    .filter(item -> setupId.equals(item.getId()))
                    .filter(item -> item.getRun() != null && item.getRun().getUser() != null && userId.equals(item.getRun().getUser().getId()))
                    .findFirst();
        });
        when(candidateReviewRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        List<BacktestTrade> tradeStore = new ArrayList<>();
        when(tradeRepository.save(any())).thenAnswer(invocation -> {
            BacktestTrade trade = invocation.getArgument(0);
            if (trade.getId() == null) {
                trade.setId(UUID.randomUUID());
            }
            tradeStore.add(trade);
            return trade;
        });
        when(tradeRepository.findByRun_IdOrderByEntryTimeAscCreatedAtAsc(any())).thenAnswer(invocation -> {
            UUID runId = invocation.getArgument(0);
            return tradeStore.stream()
                    .filter(item -> item.getRun() != null && runId.equals(item.getRun().getId()))
                    .sorted(Comparator.comparing(item -> item.getEntryTime() == null ? item.getCreatedAt() : item.getEntryTime()))
                    .toList();
        });

        List<BacktestRunReport> reportStore = new ArrayList<>();
        when(reportRepository.save(any())).thenAnswer(invocation -> {
            BacktestRunReport report = invocation.getArgument(0);
            if (report.getId() == null) {
                report.setId(UUID.randomUUID());
            }
            reportStore.add(report);
            return report;
        });
        when(reportRepository.findFirstByRun_IdOrderByCreatedAtUtcDesc(any())).thenAnswer(invocation -> {
            UUID runId = invocation.getArgument(0);
            return reportStore.stream()
                    .filter(item -> item.getRun() != null && runId.equals(item.getRun().getId()))
                    .max(Comparator.comparing(item -> item.getCreatedAtUtc() == null ? OffsetDateTime.MIN : item.getCreatedAtUtc()));
        });

        Map<UUID, com.tradevault.domain.entity.BacktestOptimizerRun> optimizerStore = new HashMap<>();
        when(optimizerRunRepository.save(any())).thenAnswer(invocation -> {
            com.tradevault.domain.entity.BacktestOptimizerRun row = invocation.getArgument(0);
            if (row.getId() == null) {
                row.setId(UUID.randomUUID());
            }
            optimizerStore.put(row.getId(), row);
            return row;
        });
        when(optimizerRunRepository.findByIdAndUser_Id(any(), any())).thenAnswer(invocation -> {
            UUID id = invocation.getArgument(0);
            UUID userId = invocation.getArgument(1);
            var row = optimizerStore.get(id);
            if (row == null || row.getUser() == null || !userId.equals(row.getUser().getId())) {
                return Optional.empty();
            }
            return Optional.of(row);
        });
    }

    @Test
    void runBuildsTradeTimelineAndPersistsReportSnapshot() {
        when(candleDataService.getCandles(any(), any(), any(), any(), any(), any(), any(), anyBoolean()))
                .thenReturn(buildDeterministicCandles());

        BacktestLabRunRequest request = new BacktestLabRunRequest();
        request.setStrategyConfigId(strategyConfig.getId());
        request.setFromUtc(OffsetDateTime.parse("2026-02-03T00:00:00Z"));
        request.setToUtc(OffsetDateTime.parse("2026-02-05T23:59:59Z"));
        request.setAutoGenerateReport(true);

        BacktestLabRunResponse response = service.run(datasetSet.getId(), request);

        assertThat(response.getStatus())
                .withFailMessage("Run failed with error: %s", response.getErrorMsg())
                .isEqualTo(BacktestRunStatus.COMPLETED.name());
        assertThat(response.getRunId()).isNotNull();

        List<BacktestTrade> savedTrades = tradeRepository.findByRun_IdOrderByEntryTimeAscCreatedAtAsc(response.getRunId());
        assertThat(savedTrades).isNotNull();
        if (!savedTrades.isEmpty()) {
            BacktestTrade first = savedTrades.get(0);
            assertThat(first.getEvidenceJson()).isNotNull();
            assertThat(first.getEvidenceJson().path("timeline").isArray()).isTrue();
            assertThat(first.getEvidenceJson().path("timeline").size()).isGreaterThanOrEqualTo(3);
        }

        BacktestRunReport report = reportRepository.findFirstByRun_IdOrderByCreatedAtUtcDesc(response.getRunId()).orElse(null);
        assertThat(report).isNotNull();
        assertThat(report.getReportMarkdown()).contains("Strategy Diagnostics Report");
        assertThat(report.getStrategyNameSnapshot()).isEqualTo("Asia Raid -> London Reversal");
    }

    @Test
    void runResultsExposeCandidatesAndCandidateSummary() {
        when(candleDataService.getCandles(any(), any(), any(), any(), any(), any(), any(), anyBoolean()))
                .thenReturn(buildDeterministicCandles());

        BacktestLabRunRequest request = new BacktestLabRunRequest();
        request.setStrategyConfigId(strategyConfig.getId());
        request.setFromUtc(OffsetDateTime.parse("2026-02-03T00:00:00Z"));
        request.setToUtc(OffsetDateTime.parse("2026-02-05T23:59:59Z"));
        request.setAutoGenerateReport(false);

        BacktestLabRunResponse response = service.run(datasetSet.getId(), request);
        assertThat(response.getStatus()).isEqualTo(BacktestRunStatus.COMPLETED.name());

        var results = service.getRunResults(response.getRunId());
        assertThat(results.getCandidates()).isNotNull();
        assertThat(results.getCandidateSummary()).isNotNull();
        assertThat(results.getCandidateSummary().getTotalCandidates()).isEqualTo(results.getCandidates().size());
        assertThat(results.getCandidateSummary().getConvertedTrades()).isGreaterThanOrEqualTo(0);
    }

    @Test
    void candidateReviewAndPlaybookPromotionPersistDomainConcepts() {
        List<BacktestCandle> fixtureM5 = loadFixtureM5Candles();
        when(candleDataService.getCandles(any(), any(), any(), any(), any(), any(), any(), anyBoolean()))
                .thenAnswer(invocation -> {
                    String timeframe = invocation.getArgument(4);
                    OffsetDateTime from = invocation.getArgument(5);
                    OffsetDateTime to = invocation.getArgument(6);
                    List<BacktestCandle> ranged = fixtureM5.stream()
                            .filter(candle -> !candle.timestamp().isBefore(from) && !candle.timestamp().isAfter(to))
                            .toList();
                    if ("M5".equals(timeframe)) {
                        return ranged;
                    }
                    return aggregateDaily(ranged);
                });

        strategyConfig.setConfigJson(buildFixtureFeb4Config());

        BacktestLabRunRequest request = new BacktestLabRunRequest();
        request.setStrategyConfigId(strategyConfig.getId());
        request.setFromUtc(OffsetDateTime.parse("2026-02-04T00:00:00Z"));
        request.setToUtc(OffsetDateTime.parse("2026-02-04T23:59:59Z"));
        request.setAutoGenerateReport(false);

        BacktestLabRunResponse run = service.run(datasetSet.getId(), request);
        assertThat(run.getStatus()).isEqualTo(BacktestRunStatus.COMPLETED.name());

        var candidates = service.getRunCandidates(run.getRunId());
        assertThat(candidates).isNotEmpty();
        var firstCandidate = candidates.get(0);

        BacktestCandidateReviewRequest reviewRequest = new BacktestCandidateReviewRequest();
        reviewRequest.setDecision("ACCEPT");
        reviewRequest.setNote("Looks valid for manual validation.");
        var review = service.reviewCandidate(firstCandidate.getCandidateId(), reviewRequest);
        assertThat(review.getCandidateId()).isEqualTo(firstCandidate.getCandidateId());
        assertThat(review.getDecision()).isEqualTo("ACCEPT");

        BacktestPromotePlaybookRequest playbookRequest = new BacktestPromotePlaybookRequest();
        playbookRequest.setName("Fixture Playbook");
        var playbook = service.promoteRunToPlaybook(run.getRunId(), playbookRequest);
        assertThat(playbook.getPlaybookId()).isNotNull();
        assertThat(playbook.getName()).isEqualTo("Fixture Playbook");
        assertThat(playbook.getValidationSummary()).isNotNull();
        assertThat(service.listPlaybooks()).extracting(item -> item.getPlaybookId()).contains(playbook.getPlaybookId());
    }

    @Test
    void listDatasetsReturnsSessionPreviewRows() {
        when(candleDataService.getCandles(any(), any(), any(), any(), any(), any(), any(), anyBoolean()))
                .thenReturn(buildSessionPreviewCandles());

        BacktestDatasetSetDatasetsResponse response = service.listDatasets(datasetSet.getId());

        assertThat(response.getDatasets()).hasSize(1);
        assertThat(response.getSessionPreview()).isNotEmpty();
        assertThat(response.getSessionPreview().stream().map(item -> item.getSessionName()))
                .contains("LONDON");
    }

    @Test
    void listDatasetsKeepsWarnStatusRunnableWhenOnlyWarningsExist() {
        ObjectNode metadata = new ObjectMapper().createObjectNode();
        ArrayNode warnings = metadata.putArray("warnings");
        warnings.add("Removed 2 duplicate timestamps.");
        dataset.setMetadataJson(metadata);
        dataset.setParsedOk(true);
        dataset.setErrorMsg(null);
        dataset.setCandleCount(500);

        BacktestDatasetSetDatasetsResponse response = service.listDatasets(datasetSet.getId());

        assertThat(response.getDatasets()).hasSize(1);
        assertThat(response.getDatasets().get(0).getStatus()).isEqualTo("WARN");
        assertThat(response.getDatasets().get(0).isRunnable()).isTrue();
        assertThat(response.getDatasets().get(0).getWarnings())
                .extracting(item -> item.getCode())
                .contains("DUPLICATES_REMOVED");
        assertThat(response.getDatasets().get(0).getFatalErrors()).isEmpty();
    }

    @Test
    void listDatasetsMarksDatasetAsErrorWhenFatalValidationExists() {
        dataset.setMetadataJson(new ObjectMapper().createObjectNode());
        dataset.setParsedOk(false);
        dataset.setErrorMsg("Invalid timestamp value at row 3.");
        dataset.setCandleCount(0);
        dataset.setMinTimeUtc(null);
        dataset.setMaxTimeUtc(null);

        BacktestDatasetSetDatasetsResponse response = service.listDatasets(datasetSet.getId());

        assertThat(response.getDatasets()).hasSize(1);
        assertThat(response.getDatasets().get(0).getStatus()).isEqualTo("ERROR");
        assertThat(response.getDatasets().get(0).isRunnable()).isFalse();
        assertThat(response.getDatasets().get(0).getFatalErrors())
                .extracting(item -> item.getCode())
                .contains("PARSE_FAILED");
    }

    @Test
    void uploadCsvSetsPersistedCandleCountFromStoredCandles() {
        UUID fileId = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "EURUSD_M5.csv",
                "text/csv",
                "time,open,high,low,close\n1762725600,1.1,1.11,1.09,1.105\n".getBytes()
        );
        CsvUploadResponse uploadResponse = CsvUploadResponse.builder()
                .fileId(fileId)
                .fileName("EURUSD_M5.csv")
                .headers(List.of("time", "open", "high", "low", "close"))
                .mappingRequired(false)
                .warnings(List.of())
                .build();
        CsvIngestResponse ingestResponse = CsvIngestResponse.builder()
                .dataset(BacktestDatasetResponse.builder().id(dataset.getId()).build())
                .warnings(List.of())
                .build();

        when(backtestCsvService.upload(user, file)).thenReturn(uploadResponse);
        when(backtestCsvService.ingest(eq(user), eq(fileId), any())).thenReturn(ingestResponse);
        when(datasetRepository.findById(dataset.getId())).thenReturn(Optional.of(dataset));
        when(candleDataService.getCandles(
                eq(user.getId()),
                eq("CSV"),
                eq(dataset.getSourceId()),
                eq(dataset.getSymbolDisplay()),
                eq(dataset.getTimeframe().name()),
                eq(dataset.getDataFrom()),
                eq(dataset.getDataTo()),
                eq(false)
        )).thenReturn(buildSmallCandleWindow());

        var response = service.uploadCsv(datasetSet.getId(), file);

        assertThat(response.getCandleCount()).isEqualTo(5);
        assertThat(response.getStatus()).isEqualTo("ERROR");
        assertThat(response.isRunnable()).isFalse();
        assertThat(dataset.getCandleCount()).isEqualTo(5);
        assertThat(dataset.getMinTimeUtc()).isEqualTo(OffsetDateTime.parse("2026-02-03T08:00:00Z"));
        assertThat(dataset.getMaxTimeUtc()).isEqualTo(OffsetDateTime.parse("2026-02-03T08:20:00Z"));
    }

    @Test
    void runDefaultsToDatasetBoundsWhenFromToMissing() {
        when(candleDataService.getCandles(any(), any(), any(), any(), any(), any(), any(), anyBoolean()))
                .thenReturn(buildDeterministicCandles());

        BacktestLabRunRequest request = new BacktestLabRunRequest();
        request.setStrategyConfigId(strategyConfig.getId());
        request.setAutoGenerateReport(false);

        BacktestLabRunResponse response = service.run(datasetSet.getId(), request);

        assertThat(response.getStatus()).isEqualTo(BacktestRunStatus.COMPLETED.name());
        assertThat(response.getRequestedFromUtc()).isNull();
        assertThat(response.getRequestedToUtc()).isNull();
        assertThat(response.getDatasetMinUtc()).isEqualTo(dataset.getMinTimeUtc());
        assertThat(response.getDatasetMaxUtc()).isEqualTo(dataset.getMaxTimeUtc());
        assertThat(response.getEffectiveFromUtc()).isEqualTo(dataset.getMinTimeUtc());
        assertThat(response.getEffectiveToUtc()).isEqualTo(dataset.getMaxTimeUtc());
        assertThat(response.getWarnings()).isEmpty();
        assertThat(response.getCandleCountInRange()).isGreaterThanOrEqualTo(30);
        assertThat(response.getMinRequiredCandles()).isEqualTo(30);
    }

    @Test
    void runUsesExecutionTimeframeDatasetBoundsWhenMultipleTimeframesExist() {
        BacktestDataset dailyDataset = BacktestDataset.builder()
                .id(UUID.randomUUID())
                .user(user)
                .datasetSet(datasetSet)
                .provider(BacktestCandleSource.CSV)
                .sourceId("SRC-D1")
                .name("EURUSD_D1.csv")
                .symbolCanonical("EURUSD")
                .symbolDisplay("EURUSD")
                .timeframe(BacktestTimeframe.D1)
                .dataFrom(OffsetDateTime.parse("2002-05-05T00:00:00Z"))
                .dataTo(OffsetDateTime.parse("2026-02-19T22:00:00Z"))
                .minTimeUtc(OffsetDateTime.parse("2002-05-05T00:00:00Z"))
                .maxTimeUtc(OffsetDateTime.parse("2026-02-19T22:00:00Z"))
                .rowCount(6000)
                .candleCount(6000)
                .parsedOk(true)
                .build();
        when(datasetRepository.findByDatasetSet_IdOrderByCreatedAtAsc(datasetSet.getId())).thenReturn(List.of(dataset, dailyDataset));

        when(candleDataService.getCandles(any(), any(), any(), any(), any(), any(), any(), anyBoolean()))
                .thenAnswer(invocation -> {
                    String timeframe = invocation.getArgument(4);
                    if ("M5".equals(timeframe)) {
                        return buildDeterministicCandles();
                    }
                    return buildDailyCandles();
                });

        BacktestLabRunRequest request = new BacktestLabRunRequest();
        request.setStrategyConfigId(strategyConfig.getId());
        request.setAutoGenerateReport(false);

        BacktestLabRunResponse response = service.run(datasetSet.getId(), request);

        assertThat(response.getStatus()).isEqualTo(BacktestRunStatus.COMPLETED.name());
        assertThat(response.getRequestedFromUtc()).isNull();
        assertThat(response.getRequestedToUtc()).isNull();
        assertThat(response.getDatasetMinUtc()).isEqualTo(dataset.getMinTimeUtc());
        assertThat(response.getDatasetMaxUtc()).isEqualTo(dataset.getMaxTimeUtc());
        assertThat(response.getEffectiveFromUtc()).isEqualTo(dataset.getMinTimeUtc());
        assertThat(response.getEffectiveToUtc()).isEqualTo(dataset.getMaxTimeUtc());
    }

    @Test
    void runClampsRequestedRangeAndReturnsWarnings() {
        when(candleDataService.getCandles(any(), any(), any(), any(), any(), any(), any(), anyBoolean()))
                .thenReturn(buildDeterministicCandles());

        BacktestLabRunRequest request = new BacktestLabRunRequest();
        request.setStrategyConfigId(strategyConfig.getId());
        request.setFromUtc(OffsetDateTime.parse("2025-01-01T00:00:00Z"));
        request.setToUtc(OffsetDateTime.parse("2027-01-01T00:00:00Z"));
        request.setAutoGenerateReport(false);

        BacktestLabRunResponse response = service.run(datasetSet.getId(), request);

        assertThat(response.getStatus()).isEqualTo(BacktestRunStatus.COMPLETED.name());
        assertThat(response.getRequestedFromUtc()).isEqualTo(OffsetDateTime.parse("2025-01-01T00:00:00Z"));
        assertThat(response.getRequestedToUtc()).isEqualTo(OffsetDateTime.parse("2027-01-01T00:00:00Z"));
        assertThat(response.getEffectiveFromUtc()).isEqualTo(dataset.getMinTimeUtc());
        assertThat(response.getEffectiveToUtc()).isEqualTo(dataset.getMaxTimeUtc());
        assertThat(response.getWarnings()).anyMatch(item -> item.toLowerCase().contains("clamped"));
    }

    @Test
    void runFailsWithNoCandlesDiagnostic() {
        when(candleDataService.getCandles(any(), any(), any(), any(), any(), any(), any(), anyBoolean()))
                .thenReturn(List.of());

        BacktestLabRunRequest request = new BacktestLabRunRequest();
        request.setStrategyConfigId(strategyConfig.getId());
        request.setFromUtc(OffsetDateTime.parse("2026-02-03T00:00:00Z"));
        request.setToUtc(OffsetDateTime.parse("2026-02-05T23:59:59Z"));
        request.setAutoGenerateReport(false);

        BacktestLabRunResponse response = service.run(datasetSet.getId(), request);

        assertThat(response.getStatus()).isEqualTo(BacktestRunStatus.FAILED.name());
        assertThat(response.getErrorMsg()).isEqualTo("No candles found for timeframe M5 in effective range. Import may be incomplete or storage mismatch.");
        assertThat(response.getCandleCountInRange()).isEqualTo(0);
        assertThat(response.getMinRequiredCandles()).isEqualTo(30);
    }

    @Test
    void runFailsWithInsufficientCandlesDiagnostic() {
        when(candleDataService.getCandles(any(), any(), any(), any(), any(), any(), any(), anyBoolean()))
                .thenReturn(buildSmallCandleWindow());

        BacktestLabRunRequest request = new BacktestLabRunRequest();
        request.setStrategyConfigId(strategyConfig.getId());
        request.setFromUtc(OffsetDateTime.parse("2026-02-03T00:00:00Z"));
        request.setToUtc(OffsetDateTime.parse("2026-02-05T23:59:59Z"));
        request.setAutoGenerateReport(false);

        BacktestLabRunResponse response = service.run(datasetSet.getId(), request);

        assertThat(response.getStatus()).isEqualTo(BacktestRunStatus.FAILED.name());
        assertThat(response.getErrorMsg()).isEqualTo("Not enough candles: found 5, need >= 30");
        assertThat(response.getCandleCountInRange()).isEqualTo(5);
        assertThat(response.getMinRequiredCandles()).isEqualTo(30);
    }

    @Test
    void fixtureRunMarksSweepAtExcursionExtremeCandle() {
        List<BacktestCandle> fixtureM5 = loadFixtureM5Candles();
        when(candleDataService.getCandles(any(), any(), any(), any(), any(), any(), any(), anyBoolean()))
                .thenAnswer(invocation -> {
                    String timeframe = invocation.getArgument(4);
                    OffsetDateTime from = invocation.getArgument(5);
                    OffsetDateTime to = invocation.getArgument(6);
                    List<BacktestCandle> ranged = fixtureM5.stream()
                            .filter(candle -> !candle.timestamp().isBefore(from) && !candle.timestamp().isAfter(to))
                            .toList();
                    if ("M5".equals(timeframe)) {
                        return ranged;
                    }
                    return aggregateDaily(ranged);
                });

        strategyConfig.setConfigJson(buildFixtureFeb4Config());

        BacktestLabRunRequest request = new BacktestLabRunRequest();
        request.setStrategyConfigId(strategyConfig.getId());
        request.setFromUtc(OffsetDateTime.parse("2026-02-04T00:00:00Z"));
        request.setToUtc(OffsetDateTime.parse("2026-02-04T23:59:59Z"));
        request.setAutoGenerateReport(false);

        BacktestLabRunResponse run = service.run(datasetSet.getId(), request);
        assertThat(run.getStatus())
                .withFailMessage("Run failed with error: %s", run.getErrorMsg())
                .isEqualTo(BacktestRunStatus.COMPLETED.name());

        var results = service.getRunResults(run.getRunId());
        String sweepSummary = results.getTrades().stream()
                .flatMap(row -> row.getTimeline().stream()
                        .filter(event -> "SWEEP".equals(event.getStage()))
                        .map(event -> String.format(
                                "trade=%s,time=%s,poolType=%s,poolLevel=%s,firstBreach=%s,extreme=%s",
                                row.getTradeId(),
                                event.getTimeUtc(),
                                event.getDetails().path("poolType").asText(),
                                event.getDetails().path("poolLevel").asText(),
                                event.getDetails().path("firstBreachTime").asText(),
                                event.getDetails().path("sweepExtremePrice").asText())))
                .collect(java.util.stream.Collectors.joining(" | "));
        var trade = results.getTrades().stream()
                .filter(row -> row.getTimeline().stream().anyMatch(event ->
                        "SWEEP".equals(event.getStage())
                                && "1.183800".equals(event.getDetails().path("sweepExtremePrice").asText())))
                .findFirst()
                .orElseThrow(() -> new AssertionError("No trade with expected sweep extreme. Sweeps: " + sweepSummary));

        var sweep = trade.getTimeline().stream()
                .filter(event -> "SWEEP".equals(event.getStage()))
                .findFirst()
                .orElseThrow();

        assertThat(sweep.getTimeUtc()).isEqualTo(Instant.parse("2026-02-04T08:10:00Z"));
        assertThat(sweep.getDetails().path("sweepExtremePrice").asText()).isEqualTo("1.183800");
        assertThat(sweep.getDetails().path("poolType").asText()).isEqualTo("ASIA_H");
        assertThat(sweep.getDetails().path("poolLevel").asText()).isNotBlank();
        assertThat(sweep.getDetails().path("firstBreachTime").asText()).isNotBlank();
    }

    @Test
    void fixtureRunKeepsSweepDisplacementMssEntryOrderingAndDelays() {
        List<BacktestCandle> fixtureM5 = loadFixtureM5Candles();
        when(candleDataService.getCandles(any(), any(), any(), any(), any(), any(), any(), anyBoolean()))
                .thenAnswer(invocation -> {
                    String timeframe = invocation.getArgument(4);
                    OffsetDateTime from = invocation.getArgument(5);
                    OffsetDateTime to = invocation.getArgument(6);
                    List<BacktestCandle> ranged = fixtureM5.stream()
                            .filter(candle -> !candle.timestamp().isBefore(from) && !candle.timestamp().isAfter(to))
                            .toList();
                    if ("M5".equals(timeframe)) {
                        return ranged;
                    }
                    return aggregateDaily(ranged);
                });

        strategyConfig.setConfigJson(buildFixtureFeb4Config());

        BacktestLabRunRequest request = new BacktestLabRunRequest();
        request.setStrategyConfigId(strategyConfig.getId());
        request.setFromUtc(OffsetDateTime.parse("2026-02-04T00:00:00Z"));
        request.setToUtc(OffsetDateTime.parse("2026-02-04T23:59:59Z"));
        request.setAutoGenerateReport(false);

        BacktestLabRunResponse run = service.run(datasetSet.getId(), request);
        assertThat(run.getStatus())
                .withFailMessage("Run failed with error: %s", run.getErrorMsg())
                .isEqualTo(BacktestRunStatus.COMPLETED.name());

        var results = service.getRunResults(run.getRunId());
        String sweepSummary = results.getTrades().stream()
                .flatMap(row -> row.getTimeline().stream()
                        .filter(event -> "SWEEP".equals(event.getStage()))
                        .map(event -> String.format(
                                "trade=%s,fill=%s,time=%s,poolType=%s,poolLevel=%s,firstBreach=%s,extreme=%s",
                                row.getTradeId(),
                                row.getFillStatus(),
                                event.getTimeUtc(),
                                event.getDetails().path("poolType").asText(),
                                event.getDetails().path("poolLevel").asText(),
                                event.getDetails().path("firstBreachTime").asText(),
                                event.getDetails().path("sweepExtremePrice").asText())))
                .collect(java.util.stream.Collectors.joining(" | "));
        var trade = results.getTrades().stream()
                .filter(row -> "FILLED".equals(row.getFillStatus()))
                .filter(row -> row.getTimeline().stream().anyMatch(event ->
                        "SWEEP".equals(event.getStage())
                                && "1.183800".equals(event.getDetails().path("sweepExtremePrice").asText())))
                .findFirst()
                .orElseThrow(() -> new AssertionError("No filled trade with expected sweep extreme. Sweeps: " + sweepSummary));

        var byStage = new HashMap<String, Instant>();
        trade.getTimeline().forEach(event -> byStage.put(event.getStage(), event.getTimeUtc()));

        Instant sweepTime = byStage.get("SWEEP");
        Instant displacementTime = byStage.get("DISPLACEMENT");
        Instant mssTime = byStage.get("MSS_BOS");
        Instant entryTime = byStage.get("ENTRY");

        assertThat(sweepTime).isNotNull();
        assertThat(displacementTime).isNotNull();
        assertThat(mssTime).isNotNull();
        assertThat(entryTime).isNotNull();

        assertThat(sweepTime.isAfter(displacementTime)).isFalse();
        assertThat(displacementTime.isAfter(mssTime)).isFalse();
        assertThat(mssTime.isAfter(entryTime)).isFalse();

        Map<Instant, Integer> indexByTime = new HashMap<>();
        for (int i = 0; i < fixtureM5.size(); i++) {
            indexByTime.put(fixtureM5.get(i).timestamp().toInstant(), i);
        }
        int sweepIndex = indexByTime.getOrDefault(sweepTime, -1);
        int displacementIndex = indexByTime.getOrDefault(displacementTime, -1);
        int mssIndex = indexByTime.getOrDefault(mssTime, -1);

        assertThat(sweepIndex).isGreaterThanOrEqualTo(0);
        assertThat(displacementIndex).isGreaterThanOrEqualTo(0);
        assertThat(mssIndex).isGreaterThanOrEqualTo(0);
        assertThat(displacementIndex - sweepIndex).isLessThanOrEqualTo(8);
        assertThat(mssIndex - displacementIndex).isLessThanOrEqualTo(8);
    }

    @Test
    void fixtureRunEmitsUtcTimelineAndMultiCandleMssConfirmation() {
        List<BacktestCandle> fixtureM5 = loadFixtureM5Candles();
        when(candleDataService.getCandles(any(), any(), any(), any(), any(), any(), any(), anyBoolean()))
                .thenAnswer(invocation -> {
                    String timeframe = invocation.getArgument(4);
                    OffsetDateTime from = invocation.getArgument(5);
                    OffsetDateTime to = invocation.getArgument(6);
                    List<BacktestCandle> ranged = fixtureM5.stream()
                            .filter(candle -> !candle.timestamp().isBefore(from) && !candle.timestamp().isAfter(to))
                            .toList();
                    if ("M5".equals(timeframe)) {
                        return ranged;
                    }
                    return aggregateDaily(ranged);
                });

        ObjectNode cfg = buildFixtureFeb4Config();
        ObjectNode smc = (ObjectNode) cfg.path("smc");
        smc.put("mssMinConfirmCandles", 3);
        smc.put("mssMaxConfirmWindowBars", 8);
        smc.put("mssInvalidationRule", "CLOSE_BACK_THROUGH_LEVEL");
        smc.put("retraceRequired", true);
        smc.put("retraceReference", "GAP_FILL");
        smc.put("retraceMinPct", 50);
        smc.put("retraceMaxWaitBars", 6);
        strategyConfig.setConfigJson(cfg);

        BacktestLabRunRequest request = new BacktestLabRunRequest();
        request.setStrategyConfigId(strategyConfig.getId());
        request.setFromUtc(OffsetDateTime.parse("2026-02-04T00:00:00Z"));
        request.setToUtc(OffsetDateTime.parse("2026-02-04T23:59:59Z"));
        request.setAutoGenerateReport(false);

        BacktestLabRunResponse run = service.run(datasetSet.getId(), request);
        assertThat(run.getStatus()).isEqualTo(BacktestRunStatus.COMPLETED.name());

        var results = service.getRunResults(run.getRunId());
        var trade = results.getTrades().stream()
                .filter(row -> "FILLED".equals(row.getFillStatus()))
                .findFirst()
                .orElseThrow();

        Instant trigger = trade.getTimeline().stream()
                .filter(event -> "MSS_TRIGGER".equals(event.getStage()))
                .map(event -> event.getTimeUtc())
                .findFirst()
                .orElseThrow();
        Instant confirm = trade.getTimeline().stream()
                .filter(event -> "MSS_CONFIRMED".equals(event.getStage()))
                .map(event -> event.getTimeUtc())
                .findFirst()
                .orElseThrow();
        assertThat(confirm.isBefore(trigger)).isFalse();

        Map<Instant, Integer> indexByTime = new HashMap<>();
        for (int i = 0; i < fixtureM5.size(); i++) {
            indexByTime.put(fixtureM5.get(i).timestamp().toInstant(), i);
        }
        int triggerIndex = indexByTime.getOrDefault(trigger, -1);
        int confirmIndex = indexByTime.getOrDefault(confirm, -1);
        assertThat(triggerIndex).isGreaterThanOrEqualTo(0);
        assertThat(confirmIndex).isGreaterThanOrEqualTo(0);
        assertThat(confirmIndex - triggerIndex).isGreaterThanOrEqualTo(2);

        assertThat(trade.getTimeline())
                .allMatch(event -> event.getTimeUtc() == null || event.getTimeUtc().toString().endsWith("Z"));
    }

    @Test
    void fixtureRunRequiresRetraceOkBeforeEntryWhenRetraceGateEnabled() {
        List<BacktestCandle> fixtureM5 = loadFixtureM5Candles();
        when(candleDataService.getCandles(any(), any(), any(), any(), any(), any(), any(), anyBoolean()))
                .thenAnswer(invocation -> {
                    String timeframe = invocation.getArgument(4);
                    OffsetDateTime from = invocation.getArgument(5);
                    OffsetDateTime to = invocation.getArgument(6);
                    List<BacktestCandle> ranged = fixtureM5.stream()
                            .filter(candle -> !candle.timestamp().isBefore(from) && !candle.timestamp().isAfter(to))
                            .toList();
                    if ("M5".equals(timeframe)) {
                        return ranged;
                    }
                    return aggregateDaily(ranged);
                });

        ObjectNode cfg = buildFixtureFeb4Config();
        ObjectNode smc = (ObjectNode) cfg.path("smc");
        smc.put("retraceRequired", true);
        smc.put("retraceReference", "GAP_FILL");
        smc.put("retraceMinPct", 50);
        smc.put("retraceMaxWaitBars", 6);
        strategyConfig.setConfigJson(cfg);

        BacktestLabRunRequest request = new BacktestLabRunRequest();
        request.setStrategyConfigId(strategyConfig.getId());
        request.setFromUtc(OffsetDateTime.parse("2026-02-04T00:00:00Z"));
        request.setToUtc(OffsetDateTime.parse("2026-02-04T23:59:59Z"));
        request.setAutoGenerateReport(false);

        BacktestLabRunResponse run = service.run(datasetSet.getId(), request);
        assertThat(run.getStatus()).isEqualTo(BacktestRunStatus.COMPLETED.name());
        var results = service.getRunResults(run.getRunId());

        var trade = results.getTrades().stream()
                .filter(row -> "FILLED".equals(row.getFillStatus()))
                .filter(row -> row.getTimeline().stream().anyMatch(event -> "RETRACE_OK".equals(event.getStage())))
                .findFirst()
                .orElseThrow();

        Instant retraceOk = trade.getTimeline().stream()
                .filter(event -> "RETRACE_OK".equals(event.getStage()))
                .map(event -> event.getTimeUtc())
                .findFirst()
                .orElseThrow();
        Instant entryTime = trade.getTimeline().stream()
                .filter(event -> "ENTRY".equals(event.getStage()))
                .map(event -> event.getTimeUtc())
                .findFirst()
                .orElseThrow();

        assertThat(entryTime.isBefore(retraceOk)).isFalse();
    }

    @Test
    void fixtureRunGapDefinitionsCanProduceGapDetectedDisplacement() {
        List<BacktestCandle> candles = List.of(
                candle("2026-02-04T08:00:00Z", 1.1000, 1.1000, 1.0990, 1.0995),
                candle("2026-02-04T08:05:00Z", 1.0995, 1.1010, 1.0992, 1.1008),
                candle("2026-02-04T08:10:00Z", 1.1008, 1.1020, 1.1012, 1.1018)
        );

        for (String gapDefinition : List.of("THREE_CANDLE_FVG", "TWO_CANDLE_GAP")) {
            ObjectNode cfg = buildFixtureReadyConfig();
            ObjectNode smc = (ObjectNode) cfg.path("smc");
            smc.put("displacementGapDefinition", gapDefinition);
            strategyConfig.setConfigJson(cfg);

            Object parsedConfig = ReflectionTestUtils.invokeMethod(service, "parseConfig", strategyConfig, datasetSet);
            Object metrics = ReflectionTestUtils.invokeMethod(service, "detectDisplacementGap", candles, 2, Direction.LONG, parsedConfig);

            boolean detected = Boolean.TRUE.equals(ReflectionTestUtils.invokeMethod(metrics, "detected"));
            BigDecimal gapSizePips = (BigDecimal) ReflectionTestUtils.invokeMethod(metrics, "sizePips");
            assertThat(detected).isTrue();
            assertThat(gapSizePips).isNotNull();
            assertThat(gapSizePips.compareTo(BigDecimal.ZERO)).isGreaterThan(0);
        }
    }

    @Test
    void fixtureRunFallsBackToImpulseLegRetraceReferenceWhenNoGapIsUsed() {
        List<BacktestCandle> fixtureM5 = loadFixtureM5Candles();
        when(candleDataService.getCandles(any(), any(), any(), any(), any(), any(), any(), anyBoolean()))
                .thenAnswer(invocation -> {
                    String timeframe = invocation.getArgument(4);
                    OffsetDateTime from = invocation.getArgument(5);
                    OffsetDateTime to = invocation.getArgument(6);
                    List<BacktestCandle> ranged = fixtureM5.stream()
                            .filter(candle -> !candle.timestamp().isBefore(from) && !candle.timestamp().isAfter(to))
                            .toList();
                    if ("M5".equals(timeframe)) {
                        return ranged;
                    }
                    return aggregateDaily(ranged);
                });

        ObjectNode cfg = buildFixtureFeb4Config();
        ObjectNode smc = (ObjectNode) cfg.path("smc");
        smc.put("displacementType", "NO_GAP_ONLY");
        smc.put("retraceRequired", true);
        smc.put("retraceReference", "GAP_FILL");
        smc.put("retraceMinPct", 50);
        strategyConfig.setConfigJson(cfg);

        BacktestLabRunRequest request = new BacktestLabRunRequest();
        request.setStrategyConfigId(strategyConfig.getId());
        request.setFromUtc(OffsetDateTime.parse("2026-02-04T00:00:00Z"));
        request.setToUtc(OffsetDateTime.parse("2026-02-04T23:59:59Z"));
        request.setAutoGenerateReport(false);

        BacktestLabRunResponse run = service.run(datasetSet.getId(), request);
        assertThat(run.getStatus()).isEqualTo(BacktestRunStatus.COMPLETED.name());
        var results = service.getRunResults(run.getRunId());

        boolean usedImpulseFallback = results.getTrades().stream()
                .flatMap(row -> row.getTimeline().stream())
                .filter(event -> "RETRACE_TARGET_CALC".equals(event.getStage()))
                .anyMatch(event -> "IMPULSE_LEG".equals(event.getDetails().path("reference").asText()));
        assertThat(usedImpulseFallback).isTrue();
    }

    @Test
    void fixtureRunCanInvalidateWhenRetraceTimeoutIsTooStrict() {
        List<BacktestCandle> candles = List.of(
                candle("2026-02-04T08:00:00Z", 1.1000, 1.1006, 1.0997, 1.1004),
                candle("2026-02-04T08:05:00Z", 1.1004, 1.1012, 1.1002, 1.1009),
                candle("2026-02-04T08:10:00Z", 1.1010, 1.1010, 1.1000, 1.1001),
                candle("2026-02-04T08:15:00Z", 1.1002, 1.1007, 1.0998, 1.1004),
                candle("2026-02-04T08:20:00Z", 1.1003, 1.1008, 1.0999, 1.1005)
        );

        ObjectNode cfg = buildFixtureReadyConfig();
        ObjectNode smc = (ObjectNode) cfg.path("smc");
        smc.put("retraceRequired", true);
        smc.put("retraceReference", "IMPULSE_LEG");
        smc.put("retraceMinPct", 95);
        smc.put("retraceMaxWaitBars", 2);
        smc.put("retraceAcceptWickTouch", false);
        strategyConfig.setConfigJson(cfg);
        Object parsedConfig = ReflectionTestUtils.invokeMethod(service, "parseConfig", strategyConfig, datasetSet);

        try {
            Class<?> sweepSideClass = Class.forName("com.tradevault.service.backtest.BacktestLabService$SweepSide");
            Class<?> sweepClass = Class.forName("com.tradevault.service.backtest.BacktestLabService$Sweep");
            Class<?> displacementClass = Class.forName("com.tradevault.service.backtest.BacktestLabService$DisplacementSignal");

            @SuppressWarnings("unchecked")
            Enum<?> sweepSide = Enum.valueOf((Class<Enum>) sweepSideClass.asSubclass(Enum.class), "HIGH");

            Constructor<?> sweepCtor = sweepClass.getDeclaredConstructors()[0];
            sweepCtor.setAccessible(true);
            Object sweep = sweepCtor.newInstance(
                    sweepSide,
                    new BigDecimal("1.1012"),
                    new BigDecimal("0.0003"),
                    new BigDecimal("1.1015"),
                    OffsetDateTime.parse("2026-02-04T08:05:00Z"),
                    "pool-1",
                    "ASIA_H",
                    new BigDecimal("1.1013"),
                    OffsetDateTime.parse("2026-02-04T08:05:00Z"),
                    1,
                    1,
                    false,
                    "M5",
                    1,
                    1,
                    0,
                    OffsetDateTime.parse("2026-02-04T07:00:00Z"),
                    "ASIA",
                    1.0d
            );

            Constructor<?> displacementCtor = displacementClass.getDeclaredConstructors()[0];
            displacementCtor.setAccessible(true);
            Object displacement = displacementCtor.newInstance(
                    2,
                    OffsetDateTime.parse("2026-02-04T08:10:00Z"),
                    new BigDecimal("1.1012"),
                    new BigDecimal("0.0009"),
                    new BigDecimal("9"),
                    new BigDecimal("4"),
                    new BigDecimal("2.25"),
                    false,
                    BigDecimal.ZERO,
                    null,
                    null,
                    new BigDecimal("1.1010"),
                    new BigDecimal("1.1001"),
                    new BigDecimal("1.1010"),
                    new BigDecimal("1.1000")
            );

            Object gate = ReflectionTestUtils.invokeMethod(service, "resolveRetraceGate", candles, sweep, displacement, Direction.SHORT, parsedConfig);
            boolean satisfied = Boolean.TRUE.equals(ReflectionTestUtils.invokeMethod(gate, "satisfied"));
            OffsetDateTime retraceOkTime = (OffsetDateTime) ReflectionTestUtils.invokeMethod(gate, "retraceOkTime");
            assertThat(satisfied).isFalse();
            assertThat(retraceOkTime).isNull();
        } catch (ReflectiveOperationException ex) {
            throw new AssertionError("Failed to construct private backtest records for retrace timeout test", ex);
        }
    }

    @Test
    void optimizerRunsDeterministicallyAndAggregatesMetrics() {
        when(candleDataService.getCandles(any(), any(), any(), any(), any(), any(), any(), anyBoolean()))
                .thenReturn(buildDeterministicCandles());

        BacktestOptimizerRunRequest request = new BacktestOptimizerRunRequest();
        request.setStrategyConfigId(strategyConfig.getId());
        request.setFromUtc(OffsetDateTime.parse("2026-02-03T00:00:00Z"));
        request.setToUtc(OffsetDateTime.parse("2026-02-05T23:59:59Z"));
        request.setMaxVariants(4);
        BacktestOptimizerGridRequest grid = new BacktestOptimizerGridRequest();
        grid.setMssMinConfirmCandles(List.of(2, 3));
        grid.setDisplacementType(List.of("GAP_OPTIONAL"));
        grid.setRetraceRequired(List.of(true));
        grid.setRetraceMinPct(List.of(BigDecimal.valueOf(50)));
        grid.setSweepMinDepthPips(List.of(BigDecimal.valueOf(3), BigDecimal.valueOf(4)));
        request.setGrid(grid);

        var first = service.runOptimizer(datasetSet.getId(), request);
        var second = service.runOptimizer(datasetSet.getId(), request);

        assertThat(first.getVariantCount()).isEqualTo(4);
        assertThat(second.getVariantCount()).isEqualTo(4);
        assertThat(first.getVariants()).hasSize(4);
        assertThat(first.getVariants().get(0).getParams()).isEqualTo(second.getVariants().get(0).getParams());
        assertThat(first.getVariants())
                .allMatch(item -> item.getExpectancyR() != null)
                .allMatch(item -> item.getWinRate() != null)
                .allMatch(item -> item.getProfitFactor() != null);
    }

    @Test
    void runFailsWhenTimeframeHierarchyIsInvalid() {
        ObjectNode cfg = buildFixtureReadyConfig();
        ObjectNode smc = (ObjectNode) cfg.path("smc");
        smc.put("contextTf", "M5");
        smc.put("poolTf", "H1");
        strategyConfig.setConfigJson(cfg);

        BacktestLabRunRequest request = new BacktestLabRunRequest();
        request.setStrategyConfigId(strategyConfig.getId());
        request.setAutoGenerateReport(false);

        assertThatThrownBy(() -> service.run(datasetSet.getId(), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid timeframe roles");
    }

    @Test
    void runEmitsEntryFillTransparencyAndEventGraphStages() {
        List<BacktestCandle> fixtureM5 = loadFixtureM5Candles();
        when(candleDataService.getCandles(any(), any(), any(), any(), any(), any(), any(), anyBoolean()))
                .thenAnswer(invocation -> {
                    String timeframe = invocation.getArgument(4);
                    OffsetDateTime from = invocation.getArgument(5);
                    OffsetDateTime to = invocation.getArgument(6);
                    List<BacktestCandle> ranged = fixtureM5.stream()
                            .filter(candle -> !candle.timestamp().isBefore(from) && !candle.timestamp().isAfter(to))
                            .toList();
                    if ("M5".equals(timeframe)) {
                        return ranged;
                    }
                    return aggregateDaily(ranged);
                });

        strategyConfig.setConfigJson(buildFixtureFeb4Config());

        BacktestLabRunRequest request = new BacktestLabRunRequest();
        request.setStrategyConfigId(strategyConfig.getId());
        request.setFromUtc(OffsetDateTime.parse("2026-02-04T00:00:00Z"));
        request.setToUtc(OffsetDateTime.parse("2026-02-04T23:59:59Z"));
        request.setAutoGenerateReport(false);

        BacktestLabRunResponse run = service.run(datasetSet.getId(), request);
        assertThat(run.getStatus()).isEqualTo(BacktestRunStatus.COMPLETED.name());
        var results = service.getRunResults(run.getRunId());
        var filled = results.getTrades().stream()
                .filter(item -> "FILLED".equals(item.getFillStatus()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Expected at least one filled trade for fixture day"));

        assertThat(filled.getEvidence().path("entryTriggerPrice").asText()).isNotBlank();
        assertThat(filled.getEvidence().path("entryRawPrice").asText()).isNotBlank();
        assertThat(filled.getEvidence().path("entrySpreadAdjustmentPrice").asText()).isNotBlank();
        assertThat(filled.getEvidence().path("entrySlippageAdjustmentPrice").asText()).isNotBlank();
        assertThat(filled.getEvidence().path("entryFinalExecutionPrice").asText()).isNotBlank();
        assertThat(filled.getEvidence().path("structureHighLabel").asText()).isNotBlank();
        assertThat(filled.getEvidence().path("structureLowLabel").asText()).isNotBlank();
        assertThat(filled.getEvidence().path("eventGraph").isArray()).isTrue();

        assertThat(filled.getTimeline().stream().map(item -> item.getStage()))
                .contains("POOL_CREATED", "SWEEP_FIRST_BREACH", "SWEEP_EXTREME", "ENTRY_FILLED");

        var sweepEvent = filled.getTimeline().stream()
                .filter(item -> "SWEEP".equals(item.getStage()))
                .findFirst()
                .orElseThrow();
        assertThat(sweepEvent.getDetails().path("durationBars").asInt()).isGreaterThan(0);
        assertThat(sweepEvent.getDetails().path("poolStatus").asText()).isEqualTo("CONSUMED");
    }

    @Test
    void runSupportsLimitFvgFillEntryModel() {
        List<BacktestCandle> fixtureM5 = loadFixtureM5Candles();
        when(candleDataService.getCandles(any(), any(), any(), any(), any(), any(), any(), anyBoolean()))
                .thenAnswer(invocation -> {
                    String timeframe = invocation.getArgument(4);
                    OffsetDateTime from = invocation.getArgument(5);
                    OffsetDateTime to = invocation.getArgument(6);
                    List<BacktestCandle> ranged = fixtureM5.stream()
                            .filter(candle -> !candle.timestamp().isBefore(from) && !candle.timestamp().isAfter(to))
                            .toList();
                    if ("M5".equals(timeframe)) {
                        return ranged;
                    }
                    return aggregateDaily(ranged);
                });

        ObjectNode cfg = buildFixtureFeb4Config();
        ((ObjectNode) cfg.path("entryModel")).put("type", "LIMIT_FVG_FILL");
        ((ObjectNode) cfg.path("entryModel")).put("entryWindowBars", 10);
        ((ObjectNode) cfg.path("riskModel")).put("minRR", 0.8);
        strategyConfig.setConfigJson(cfg);

        BacktestLabRunRequest request = new BacktestLabRunRequest();
        request.setStrategyConfigId(strategyConfig.getId());
        request.setFromUtc(OffsetDateTime.parse("2026-02-04T00:00:00Z"));
        request.setToUtc(OffsetDateTime.parse("2026-02-04T23:59:59Z"));
        request.setAutoGenerateReport(false);

        BacktestLabRunResponse run = service.run(datasetSet.getId(), request);
        assertThat(run.getStatus()).isEqualTo(BacktestRunStatus.COMPLETED.name());

        var results = service.getRunResults(run.getRunId());
        assertThat(results.getTrades()).isNotEmpty();
        assertThat(results.getTrades())
                .anyMatch(trade -> "LIMIT_FVG_FILL".equals(trade.getEvidence().path("entryModel").asText())
                        || trade.getTimeline().stream().anyMatch(event ->
                        "ENTRY".equals(event.getStage()) && "LIMIT_FVG_FILL".equals(event.getDetails().path("model").asText())));
    }

    @Test
    void runCanUseBosConfirmationPath() {
        List<BacktestCandle> fixtureM5 = loadFixtureM5Candles();
        when(candleDataService.getCandles(any(), any(), any(), any(), any(), any(), any(), anyBoolean()))
                .thenAnswer(invocation -> {
                    String timeframe = invocation.getArgument(4);
                    OffsetDateTime from = invocation.getArgument(5);
                    OffsetDateTime to = invocation.getArgument(6);
                    List<BacktestCandle> ranged = fixtureM5.stream()
                            .filter(candle -> !candle.timestamp().isBefore(from) && !candle.timestamp().isAfter(to))
                            .toList();
                    if ("M5".equals(timeframe)) {
                        return ranged;
                    }
                    return aggregateDaily(ranged);
                });

        ObjectNode cfg = buildFixtureFeb4Config();
        ((ObjectNode) cfg.path("setupRule")).put("confirmationType", "BOS");
        ObjectNode smc = (ObjectNode) cfg.path("smc");
        smc.put("bosEnabled", true);
        smc.put("bosBreakMode", "WICK_ALLOWED");
        smc.put("bosDirectionRule", "ANY_DIRECTION");
        smc.put("bosMinBreakDistancePips", 0.0);
        smc.put("bosHoldBars", 1);
        ((ObjectNode) cfg.path("riskModel")).put("minRR", 0.6);
        strategyConfig.setConfigJson(cfg);

        BacktestLabRunRequest request = new BacktestLabRunRequest();
        request.setStrategyConfigId(strategyConfig.getId());
        request.setFromUtc(OffsetDateTime.parse("2026-02-04T00:00:00Z"));
        request.setToUtc(OffsetDateTime.parse("2026-02-04T23:59:59Z"));
        request.setAutoGenerateReport(false);

        BacktestLabRunResponse run = service.run(datasetSet.getId(), request);
        assertThat(run.getStatus()).isEqualTo(BacktestRunStatus.COMPLETED.name());

        var results = service.getRunResults(run.getRunId());
        assertThat(results.getTrades()).isNotEmpty();
        assertThat(results.getTrades().stream().flatMap(trade -> trade.getTimeline().stream()).map(item -> item.getStage()))
                .anyMatch(stage -> stage.startsWith("BOS"));
    }

    @Test
    void sessionAssignmentRespectsDstForLondonAndNewYork() throws ReflectiveOperationException {
        Class<?> sessionWindowClass = Class.forName("com.tradevault.service.backtest.BacktestLabService$SessionWindow");
        Constructor<?> ctor = sessionWindowClass.getDeclaredConstructors()[0];
        ctor.setAccessible(true);

        Object london = ctor.newInstance(
                "LONDON",
                "Europe/London",
                LocalTime.of(7, 0),
                LocalTime.of(12, 0),
                true,
                true,
                true,
                true,
                0
        );
        Object ny = ctor.newInstance(
                "NY_AM",
                "America/New_York",
                LocalTime.of(9, 30),
                LocalTime.of(12, 0),
                true,
                true,
                true,
                true,
                1
        );

        Object londonWinter = ReflectionTestUtils.invokeMethod(service, "assignSession", OffsetDateTime.parse("2026-01-15T07:30:00Z"), london);
        Object londonSummer = ReflectionTestUtils.invokeMethod(service, "assignSession", OffsetDateTime.parse("2026-07-15T06:30:00Z"), london);
        Object nyWinter = ReflectionTestUtils.invokeMethod(service, "assignSession", OffsetDateTime.parse("2026-01-15T15:00:00Z"), ny);
        Object nySummer = ReflectionTestUtils.invokeMethod(service, "assignSession", OffsetDateTime.parse("2026-07-15T14:00:00Z"), ny);

        assertThat(londonWinter).isNotNull();
        assertThat(londonSummer).isNotNull();
        assertThat(nyWinter).isNotNull();
        assertThat(nySummer).isNotNull();
        assertThat((LocalDate) ReflectionTestUtils.invokeMethod(londonWinter, "sessionDateKey"))
                .isEqualTo(LocalDate.parse("2026-01-15"));
        assertThat((LocalDate) ReflectionTestUtils.invokeMethod(londonSummer, "sessionDateKey"))
                .isEqualTo(LocalDate.parse("2026-07-15"));
    }

    @Test
    void consumedPoolHelperMarksMeaningfulPriorBreachAsConsumed() throws ReflectiveOperationException {
        Class<?> sideClass = Class.forName("com.tradevault.service.backtest.BacktestLabService$SweepSide");
        @SuppressWarnings("unchecked")
        Enum<?> highSide = Enum.valueOf((Class<Enum>) sideClass.asSubclass(Enum.class), "HIGH");

        Class<?> poolClass = Class.forName("com.tradevault.service.backtest.BacktestLabService$LiquidityPoolCandidate");
        Constructor<?> ctor = poolClass.getDeclaredConstructors()[0];
        ctor.setAccessible(true);
        Object pool = ctor.newInstance(
                "pool-eqh-1",
                "EQH",
                highSide,
                new BigDecimal("1.1000"),
                2,
                0,
                OffsetDateTime.parse("2026-02-03T08:00:00Z"),
                new BigDecimal("0.0010"),
                "ASIA"
        );

        List<BacktestCandle> candles = List.of(
                candle("2026-02-03T08:00:00Z", 1.0995, 1.1001, 1.0992, 1.0998),
                candle("2026-02-03T08:05:00Z", 1.0998, 1.1004, 1.0994, 1.1002),
                candle("2026-02-03T08:10:00Z", 1.1002, 1.1008, 1.0999, 1.1004),
                candle("2026-02-03T08:15:00Z", 1.1004, 1.1005, 1.1001, 1.1003)
        );
        Boolean consumed = ReflectionTestUtils.invokeMethod(
                service,
                "isPoolConsumedBeforeIndex",
                pool,
                candles,
                3,
                new BigDecimal("0.00005"),
                new BigDecimal("0.00020")
        );
        assertThat(consumed).isTrue();
    }

    private List<BacktestCandle> buildDeterministicCandles() {
        List<BacktestCandle> rows = new ArrayList<>();

        rows.add(candle("2026-02-03T08:00:00Z", 1.1000, 1.1010, 1.0990, 1.1005));
        rows.add(candle("2026-02-03T08:05:00Z", 1.1005, 1.1015, 1.1000, 1.1010));
        rows.add(candle("2026-02-03T08:10:00Z", 1.1010, 1.1018, 1.1005, 1.1012));

        OffsetDateTime start = OffsetDateTime.parse("2026-02-04T05:30:00Z");
        for (int i = 0; i < 30; i++) {
            OffsetDateTime ts = start.plusMinutes(i * 5L);
            double base = 1.1010 + ((i % 3) - 1) * 0.00005;
            double open = base;
            double close = base + (i % 2 == 0 ? 0.00003 : -0.00002);
            double high = Math.max(open, close) + 0.00012;
            double low = Math.min(open, close) - 0.00012;
            if (i == 20) {
                low = 1.10030;
            }
            rows.add(candle(ts, open, high, low, close));
        }

        rows.add(candle("2026-02-04T08:00:00Z", 1.1012, 1.1022, 1.1008, 1.1015));
        rows.add(candle("2026-02-04T08:05:00Z", 1.1014, 1.1015, 1.1000, 1.1002));
        rows.add(candle("2026-02-04T08:10:00Z", 1.1003, 1.1004, 1.0997, 1.0998));
        rows.add(candle("2026-02-04T08:15:00Z", 1.0998, 1.1000, 1.0940, 1.0950));
        rows.add(candle("2026-02-04T08:20:00Z", 1.0950, 1.0955, 1.0948, 1.0951));

        return rows;
    }

    private List<BacktestCandle> buildSmallCandleWindow() {
        return List.of(
                candle("2026-02-03T08:00:00Z", 1.1, 1.101, 1.099, 1.1005),
                candle("2026-02-03T08:05:00Z", 1.1005, 1.1015, 1.1, 1.101),
                candle("2026-02-03T08:10:00Z", 1.101, 1.1018, 1.1004, 1.1013),
                candle("2026-02-03T08:15:00Z", 1.1013, 1.1019, 1.1008, 1.1011),
                candle("2026-02-03T08:20:00Z", 1.1011, 1.1017, 1.1007, 1.101)
        );
    }

    private List<BacktestCandle> buildSessionPreviewCandles() {
        return List.of(
                candle("2026-02-04T08:00:00Z", 1.1, 1.101, 1.099, 1.1005),
                candle("2026-02-04T08:05:00Z", 1.1005, 1.102, 1.1, 1.1015),
                candle("2026-02-04T08:10:00Z", 1.1015, 1.103, 1.101, 1.1025),
                candle("2026-02-04T13:00:00Z", 1.1025, 1.104, 1.102, 1.103)
        );
    }

    private List<BacktestCandle> buildDailyCandles() {
        return List.of(
                candle("2026-02-01T00:00:00Z", 1.1, 1.105, 1.095, 1.102),
                candle("2026-02-02T00:00:00Z", 1.102, 1.106, 1.098, 1.104),
                candle("2026-02-03T00:00:00Z", 1.104, 1.108, 1.101, 1.106)
        );
    }

    private BacktestCandle candle(String iso, double open, double high, double low, double close) {
        return candle(OffsetDateTime.parse(iso), open, high, low, close);
    }

    private BacktestCandle candle(OffsetDateTime ts, double open, double high, double low, double close) {
        return new BacktestCandle(
                ts.withOffsetSameInstant(ZoneOffset.UTC),
                BigDecimal.valueOf(open),
                BigDecimal.valueOf(high),
                BigDecimal.valueOf(low),
                BigDecimal.valueOf(close),
                100L
        );
    }

    private List<BacktestCandle> loadFixtureM5Candles() {
        List<BacktestCandle> rows = new ArrayList<>();
        try (InputStream in = BacktestLabServiceTest.class.getResourceAsStream("/fixtures/backtest/OANDA_EURUSD_5_89c7a.csv")) {
            assertThat(in).isNotNull();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                String line = reader.readLine();
                if (line == null) {
                    return List.of();
                }
                while ((line = reader.readLine()) != null) {
                    if (line.isBlank()) {
                        continue;
                    }
                    String[] parts = line.split(",");
                    if (parts.length < 5) {
                        continue;
                    }
                    long epochSec = Long.parseLong(parts[0].trim());
                    rows.add(new BacktestCandle(
                            OffsetDateTime.ofInstant(Instant.ofEpochSecond(epochSec), ZoneOffset.UTC),
                            new BigDecimal(parts[1].trim()),
                            new BigDecimal(parts[2].trim()),
                            new BigDecimal(parts[3].trim()),
                            new BigDecimal(parts[4].trim()),
                            100L
                    ));
                }
            }
        } catch (Exception ex) {
            throw new RuntimeException("Could not load fixture candles", ex);
        }
        return rows;
    }

    private List<BacktestCandle> aggregateDaily(List<BacktestCandle> candles) {
        Map<String, List<BacktestCandle>> grouped = new HashMap<>();
        for (BacktestCandle candle : candles) {
            String day = candle.timestamp().toLocalDate().toString();
            grouped.computeIfAbsent(day, ignored -> new ArrayList<>()).add(candle);
        }
        List<BacktestCandle> out = new ArrayList<>();
        for (Map.Entry<String, List<BacktestCandle>> entry : grouped.entrySet()) {
            List<BacktestCandle> dayCandles = entry.getValue();
            dayCandles.sort(Comparator.comparing(BacktestCandle::timestamp));
            BacktestCandle first = dayCandles.get(0);
            BacktestCandle last = dayCandles.get(dayCandles.size() - 1);
            BigDecimal high = dayCandles.stream().map(BacktestCandle::high).max(BigDecimal::compareTo).orElse(first.high());
            BigDecimal low = dayCandles.stream().map(BacktestCandle::low).min(BigDecimal::compareTo).orElse(first.low());
            out.add(new BacktestCandle(
                    OffsetDateTime.parse(entry.getKey() + "T00:00:00Z"),
                    first.open(),
                    high,
                    low,
                    last.close(),
                    0L
            ));
        }
        out.sort(Comparator.comparing(BacktestCandle::timestamp));
        return out;
    }

    private ObjectNode buildFixtureReadyConfig() {
        ObjectMapper mapper = new ObjectMapper();
        ObjectNode root = mapper.createObjectNode();
        root.put("name", "Fixture London Sweep");

        ObjectNode context = root.putObject("context");
        context.put("pipSize", 0.0001);
        context.put("spreadPips", 0.0);
        context.put("slippagePips", 0.0);
        context.put("touchTolerancePips", 0.1);
        context.put("timezoneBasis", "UTC");
        context.put("executionTimeframe", "M5");

        ArrayNode sessions = root.putArray("sessions");
        sessions.addObject().put("name", "ASIA").put("zoneId", "UTC").put("startLocal", "00:00").put("endLocal", "07:00");
        sessions.addObject().put("name", "LONDON").put("zoneId", "UTC").put("startLocal", "07:00").put("endLocal", "12:00");
        sessions.addObject().put("name", "NY_AM").put("zoneId", "UTC").put("startLocal", "13:00").put("endLocal", "17:00");
        sessions.addObject().put("name", "NY_PM").put("zoneId", "UTC").put("startLocal", "17:00").put("endLocal", "22:00");

        ObjectNode setupRule = root.putObject("setupRule");
        setupRule.put("session", "LONDON");
        setupRule.put("sweepType", "ASIA_H");
        setupRule.put("confirmationType", "MSS");
        setupRule.put("direction", "AUTO_FROM_SWEEP");

        ObjectNode entryModel = root.putObject("entryModel");
        entryModel.put("type", "MARKET_ON_CONFIRM_CLOSE");
        entryModel.put("retracePercent", 50);
        entryModel.put("entryWindowBars", 5);

        ObjectNode riskModel = root.putObject("riskModel");
        riskModel.put("stopRule", "SWEEP_EXTREME_PLUS_BUFFER");
        riskModel.put("fixedR", 2.0);
        riskModel.put("minRR", 1.2);

        ObjectNode quality = root.putObject("qualityFilters");
        quality.put("displacementMultiplier", 1.2);
        quality.put("bodyLookback", 20);
        quality.put("antiChop", false);
        quality.put("maxTradesPerSession", 5);
        quality.put("maxTradesPerDay", 10);
        quality.put("pivotLeft", 2);
        quality.put("pivotRight", 2);
        quality.put("confirmBreakBufferPips", 0.0);

        ObjectNode smc = root.putObject("smc");
        smc.put("sessionTimezone", "UTC");
        smc.put("contextTf", "H1");
        smc.put("poolTf", "M15");
        smc.put("confirmationTf", "M5");
        smc.put("entryTf", "M5");
        smc.put("executionTf", "M5");
        smc.put("allowNonHierarchicalTimeframes", false);
        smc.putArray("sessionsEnabled").add("ASIA").add("LONDON").add("NY_AM").add("NY_PM");

        ObjectNode ranges = smc.putObject("sessionTimeRanges");
        ranges.putObject("ASIA").put("start", "00:00").put("end", "07:00").put("zoneId", "UTC");
        ranges.putObject("LONDON").put("start", "07:00").put("end", "12:00").put("zoneId", "UTC");
        ranges.putObject("NY_AM").put("start", "13:00").put("end", "17:00").put("zoneId", "UTC");
        ranges.putObject("NY_PM").put("start", "17:00").put("end", "22:00").put("zoneId", "UTC");

        smc.putArray("evaluationSessionFilter").add("LONDON");
        smc.putArray("sweepSourceSessions").add("ASIA").add("LONDON");
        smc.putArray("poolTypesEnabled").add("ASIA_H").add("ASIA_L").add("PDH").add("PDL").add("EQH").add("EQL");
        smc.put("poolTimeframeForDetection", "M15");
        smc.put("poolTouchTolerancePips", 0.5);
        smc.put("poolMinTouches", 2);
        smc.put("poolMinSeparationBars", 2);
        smc.put("poolMinAgeBars", 1);
        smc.put("poolRankRule", "TOUCH_COUNT");
        smc.put("sweepMinDepthPips", 2.0);
        smc.put("sweepMaxDurationBars", 4);
        smc.put("sweepRequiresReclaim", false);
        smc.put("sweepRequiresLiquidityType", true);
        smc.put("sweepSelectRule", "LARGEST_DEPTH");
        smc.put("displacementTimeframe", "M5");
        smc.put("displacementMaxDelayBarsAfterSweep", 6);
        smc.put("displacementMinBodyPips", 3.0);
        smc.put("displacementMinBodyVsAvgMult", 1.2);
        smc.put("displacementRequiresCloseBeyondLevel", true);
        smc.put("displacementNoInstantOverlap", false);
        smc.put("structureTimeframe", "M5");
        smc.put("swingDetectionMethod", "PIVOT_N");
        smc.put("swingPivotN", 2);
        smc.put("mssRequiresClose", true);
        smc.put("mssMaxDelayBarsAfterDisplacement", 6);
        smc.put("mssAnchorLevel", "LAST_SWING_HIGH_LOW");
        smc.put("entryRequiresFvgRetest", false);
        smc.put("entryRequiresDiscountPremium", false);
        smc.put("fillPolicy", "MID");
        smc.put("emitDebugFields", true);
        smc.put("storeIntermediateLevels", true);
        smc.put("requireKillzone", false);
        smc.put("retraceRequired", false);
        return root;
    }

    private ObjectNode buildFixtureFeb4Config() {
        ObjectNode root = buildFixtureReadyConfig().deepCopy();
        ObjectNode smc = (ObjectNode) root.path("smc");
        ArrayNode poolTypes = smc.putArray("poolTypesEnabled");
        poolTypes.add("ASIA_H");
        poolTypes.add("ASIA_L");
        smc.putArray("sweepSourceSessions").add("ASIA");
        smc.put("sweepSelectRule", "NEWEST_SESSION_LEVEL");
        smc.put("sweepMinDepthPips", 1.0);
        smc.put("sweepRequiresReclaim", false);
        smc.put("sweepMaxDurationBars", 6);
        smc.put("displacementMaxDelayBarsAfterSweep", 8);
        smc.put("displacementMinBodyPips", 0.5);
        smc.put("displacementMinBodyVsAvgMult", 0.1);
        smc.put("displacementRequiresCloseBeyondLevel", false);
        smc.put("mssMaxDelayBarsAfterDisplacement", 8);
        smc.put("mssAnchorLevel", "INTERNAL_STRUCTURE");
        return root;
    }
}
