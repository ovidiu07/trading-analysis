package com.tradevault.service.backtest;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import com.tradevault.dto.backtest.BacktestLabRunRequest;
import com.tradevault.dto.backtest.BacktestLabRunResponse;
import com.tradevault.dto.backtest.BacktestDatasetSetDatasetsResponse;
import com.tradevault.repository.BacktestDatasetRepository;
import com.tradevault.repository.BacktestDatasetSetRepository;
import com.tradevault.repository.BacktestRunReportRepository;
import com.tradevault.repository.BacktestRunRepository;
import com.tradevault.repository.BacktestSetupRepository;
import com.tradevault.repository.BacktestStrategyConfigRepository;
import com.tradevault.repository.BacktestTradeRepository;
import com.tradevault.service.CurrentUserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
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
                backtestCsvService,
                candleDataService,
                new ObjectMapper().findAndRegisterModules()
        );

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
                .configJson(new ObjectMapper().createObjectNode())
                .build();

        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(datasetSetRepository.findByIdAndUser_Id(datasetSet.getId(), user.getId())).thenReturn(Optional.of(datasetSet));
        when(strategyConfigRepository.findByIdAndDatasetSet_User_Id(strategyConfig.getId(), user.getId())).thenReturn(Optional.of(strategyConfig));
        when(datasetRepository.findByDatasetSet_IdOrderByCreatedAtAsc(datasetSet.getId())).thenReturn(List.of(dataset));

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

        when(setupRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

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
        assertThat(savedTrades).isNotEmpty();
        BacktestTrade first = savedTrades.get(0);
        assertThat(first.getFillStatus()).isEqualTo("FILLED");
        assertThat(first.getEvidenceJson()).isNotNull();
        assertThat(first.getEvidenceJson().path("timeline").isArray()).isTrue();
        assertThat(first.getEvidenceJson().path("timeline").size()).isGreaterThanOrEqualTo(4);

        BacktestRunReport report = reportRepository.findFirstByRun_IdOrderByCreatedAtUtcDesc(response.getRunId()).orElse(null);
        assertThat(report).isNotNull();
        assertThat(report.getReportMarkdown()).contains("Strategy Diagnostics Report");
        assertThat(report.getStrategyNameSnapshot()).isEqualTo("Asia Raid -> London Reversal");
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

    private List<BacktestCandle> buildSessionPreviewCandles() {
        return List.of(
                candle("2026-02-04T08:00:00Z", 1.1, 1.101, 1.099, 1.1005),
                candle("2026-02-04T08:05:00Z", 1.1005, 1.102, 1.1, 1.1015),
                candle("2026-02-04T08:10:00Z", 1.1015, 1.103, 1.101, 1.1025),
                candle("2026-02-04T13:00:00Z", 1.1025, 1.104, 1.102, 1.103)
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
}
