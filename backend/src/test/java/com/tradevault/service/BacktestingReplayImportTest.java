package com.tradevault.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.*;
import com.tradevault.domain.enums.*;
import com.tradevault.repository.*;
import com.tradevault.dto.backtesting.BacktestingTradeRequest;
import org.springframework.test.util.ReflectionTestUtils;
import com.tradevault.service.backtesting.ReplayCsvParser;
import org.apache.commons.csv.CSVFormat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BacktestingReplayImportTest {
    static final String NAME = "Replay_Trading_PEPPERSTONE_GER40F_2025-10-06_to_2025-10-30_combined.csv";
    BacktestingWorkspaceRepository workspaces = mock(BacktestingWorkspaceRepository.class);
    BacktestingTradeRepository trades = mock(BacktestingTradeRepository.class);
    CurrentUserService currentUser = mock(CurrentUserService.class);
    BacktestingResearchService service = new BacktestingResearchService(workspaces, trades, null, null, currentUser, new ObjectMapper(), null, null);
    User user = User.builder().id(UUID.randomUUID()).build();
    BacktestingWorkspace workspace = BacktestingWorkspace.builder().id(UUID.randomUUID()).symbol("GER40U2026").user(user).build();
    byte[] fixture() throws Exception { return Objects.requireNonNull(getClass().getResourceAsStream("/backtesting/tradingview-replay-ger40f.csv")).readAllBytes(); }
    MockMultipartFile file(byte[] content) { return new MockMultipartFile("file", NAME, "text/csv", content); }
    @BeforeEach void setup() {
        when(currentUser.getCurrentUser()).thenReturn(user);
        when(workspaces.findByIdAndUser_Id(workspace.getId(), user.getId())).thenReturn(Optional.of(workspace));
        when(trades.findByWorkspace_IdAndUser_IdOrderByDateAscEntryTimeAscCreatedAtAsc(workspace.getId(), user.getId())).thenReturn(List.of());
    }
    ReplayCsvParser.Result parse(String text) throws Exception {
        try (var parser = CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).setTrim(true).build().parse(new java.io.StringReader(text))) {
            return ReplayCsvParser.parse(parser.getRecords(), parser.getHeaderNames(), "PEPPERSTONE:GER40F", null, NAME);
        }
    }
    @Test void importsTheExactCombinedFileOnceAndPreservesSourceFields() throws Exception {
        var result = service.importCsv(workspace.getId(), file(fixture()));
        assertThat(result.getImported()).isEqualTo(25);
        assertThat(result.getRowCount()).isEqualTo(50);
        assertThat(result.getInvalid()).isZero();
        assertThat(result.getTrades()).allSatisfy(t -> {
            assertThat(t.getInstrument()).isEqualTo("PEPPERSTONE:GER40F");
            assertThat(t.getPnlR()).isNull(); assertThat(t.getRiskPercent()).isNull();
            assertThat(t.getTradeScope()).isEqualTo(BacktestingTradeScope.REPLAY);
            assertThat(t.getSource()).isEqualTo(BacktestingTradeSource.IMPORT);
            assertThat(t.getSourceTimezone()).isNull(); assertThat(t.getImportFileName()).isEqualTo(NAME);
        });
        var first = result.getTrades().get(0);
        assertThat(first.getEntryPrice()).isEqualByComparingTo("24487.2");
        assertThat(first.getExitPrice()).isEqualByComparingTo("24527.7");
        assertThat(first.getQuantity()).isEqualByComparingTo("3");
        assertThat(first.getNetPnl()).isEqualByComparingTo("-121.5");
        assertThat(first.getDurationBars()).isEqualTo(15);
        verify(trades).saveAll(anyList());
    }
    @Test void previewsAndImportsOriginalDateHashExportWithoutAnExplicitInstrument() throws Exception {
        String filename = "Replay_Trading_PEPPERSTONE_GER40F_2026-10-09_0eb11.csv";
        byte[] content = Objects.requireNonNull(getClass().getResourceAsStream("/backtesting/tradingview-replay-ger40f-single-export.csv")).readAllBytes();
        var export = new MockMultipartFile("file", filename, "text/csv", content);
        var preview = service.importCsv(workspace.getId(), export, null, null, true);
        assertThat(preview.isPreview()).isTrue();
        assertThat(preview.getRowCount()).isEqualTo(4);
        assertThat(preview.getImported()).isEqualTo(2);
        assertThat(preview.getInvalid()).isZero();
        assertThat(preview.getErrors()).isEmpty();
        assertThat(preview.getTrades()).allSatisfy(trade -> {
            assertThat(trade.getInstrument()).isEqualTo("PEPPERSTONE:GER40F");
            assertThat(trade.getDate()).isEqualTo(LocalDate.of(2025, 10, 31));
            assertThat(trade.getImportFileName()).isEqualTo(filename);
        });
        assertThat(preview.getTrades().get(0).getNetPnl()).isEqualByComparingTo("-121.2");
        assertThat(preview.getTrades().get(1).getNetPnl()).isEqualByComparingTo("111.2");
        verify(trades, never()).saveAll(anyList());

        var imported = service.importCsv(workspace.getId(), export, "", null, false);
        assertThat(imported.getImported()).isEqualTo(2);
        assertThat(imported.getInvalid()).isZero();
        verify(trades).saveAll(argThat(saved -> {
            List<BacktestingTrade> values = new ArrayList<>();
            saved.forEach(values::add);
            return values.size() == 2 && values.stream().map(BacktestingTrade::getNetPnl)
                    .reduce(BigDecimal.ZERO, BigDecimal::add).compareTo(new BigDecimal("-10")) == 0;
        }));
    }
    @Test void fullFixtureAnalyticsAgreeWithIndependentTotalsDespiteCumulativeResets() throws Exception {
        var parsed = parse(new String(fixture(), StandardCharsets.UTF_8));
        var metrics = service.calculateMetrics(parsed.trades());
        assertThat(metrics.getTrades()).isEqualTo(25); assertThat(metrics.getWins()).isEqualTo(15); assertThat(metrics.getLosses()).isEqualTo(10);
        assertThat(metrics.getWinRate()).isEqualByComparingTo("60"); assertThat(metrics.getRSampleSize()).isZero();
        assertThat(metrics.getTotalR()).isNull(); assertThat(metrics.getExpectancy()).isNull(); assertThat(metrics.getProfitFactor()).isNull();
        var eur = metrics.getCurrencyMetrics().get("EUR");
        assertThat(eur.getNetPnl()).isEqualByComparingTo("1768.4"); assertThat(eur.getExpectancy()).isEqualByComparingTo("70.74");
        assertThat(eur.getGrossProfit()).isEqualByComparingTo("2920.6"); assertThat(eur.getGrossLoss()).isEqualByComparingTo("1152.2");
        assertThat(eur.getProfitFactor()).isEqualByComparingTo("2.53"); assertThat(eur.getMaximumDrawdown()).isEqualByComparingTo("265");
        assertThat(eur.getAverageFavorableExcursion()).isEqualByComparingTo("159.68"); assertThat(eur.getAverageAdverseExcursion()).isEqualByComparingTo("-79.3");
        assertThat(eur.getAverageDurationBars()).isEqualByComparingTo("12.32"); assertThat(eur.getCommission()).isZero();
    }
    @Test void previewDoesNotPersistAndReportsInstrumentAndTimezoneWarnings() throws Exception {
        var result = service.importCsv(workspace.getId(), file(fixture()), null, null, true);
        assertThat(result.isPreview()).isTrue(); assertThat(result.getImported()).isEqualTo(25);
        assertThat(result.getWarnings()).anyMatch(s -> s.contains("differs from workspace"));
        assertThat(workspace.getUpdatedAt()).isNull(); verify(trades, never()).saveAll(anyList());
    }
    @Test void renamedFileRequiresExplicitSymbolAndAllowsVerifiedTimezone() throws Exception {
        var renamed = new MockMultipartFile("file", "replay.csv", "text/csv", fixture());
        assertThatThrownBy(() -> service.importCsv(workspace.getId(), renamed))
                .hasMessageContaining("instrument is required").hasMessageContaining("CSV instrument field");
        assertThatThrownBy(() -> service.importCsv(workspace.getId(), renamed, "X".repeat(65), null, true))
                .hasMessageContaining("at most 64 characters").hasMessageNotContaining("is required");
        var result = service.importCsv(workspace.getId(), renamed, "GER40F", "Europe/Bucharest", true);
        assertThat(result.getTrades()).allSatisfy(t -> assertThat(t.getSourceTimezone()).isEqualTo("Europe/Bucharest"));
        assertThatThrownBy(() -> service.importCsv(workspace.getId(), renamed, "GER40F", "Invalid/Zone", true)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void repeatImportSkipsAllExecutionFingerprintsEvenWhenFilenameChanges() throws Exception {
        var parsed = parse(new String(fixture(), StandardCharsets.UTF_8));
        when(trades.findByWorkspace_IdAndUser_IdOrderByDateAscEntryTimeAscCreatedAtAsc(workspace.getId(), user.getId())).thenReturn(parsed.trades());
        var result = service.importCsv(workspace.getId(), file(fixture()));
        assertThat(result.getImported()).isZero(); assertThat(result.getDuplicates()).isEqualTo(25); verify(trades, never()).saveAll(anyList());
    }
    @Test void reorderedExportStillPairsRestartedTradeNumbers() throws Exception {
        List<String> lines = new ArrayList<>(new String(fixture(), StandardCharsets.UTF_8).lines().toList());
        String header = lines.remove(0); Collections.reverse(lines);
        var result = parse(header + "\n" + String.join("\n", lines));
        assertThat(result.trades()).hasSize(25); assertThat(result.errors()).isEmpty();
    }
    @Test void orphanRowsAndPartialExitsAreRejectedWithoutFabricatingTrades() throws Exception {
        var lines = new String(fixture(), StandardCharsets.UTF_8).lines().toList();
        assertThat(parse(lines.get(0) + "\n" + lines.get(1)).errors()).anyMatch(s -> s.contains("no matching exit"));
        assertThat(parse(lines.get(0) + "\n" + lines.get(2)).errors()).anyMatch(s -> s.contains("no matching entry"));
        var bad = parse(lines.get(0) + "\n" + lines.get(1) + "\n" + lines.get(2).replace(",3,73461.6,", ",2,73461.6,"));
        assertThat(bad.trades()).isEmpty(); assertThat(bad.errors()).anyMatch(s -> s.contains("quantity differs"));
    }
    @Test void repeatedRowsAreDeduplicatedAndInconsistentCopiesAreRejected() throws Exception {
        var lines = new String(fixture(), StandardCharsets.UTF_8).lines().toList();
        String pair = lines.get(1) + "\n" + lines.get(2);
        var duplicate = parse(lines.get(0) + "\n" + pair + "\n" + pair);
        assertThat(duplicate.trades()).hasSize(1); assertThat(duplicate.duplicates()).isEqualTo(1);
        var conflict = parse(lines.get(0) + "\n" + lines.get(1) + "\n" + lines.get(2).replace("-121.5", "-122.5"));
        assertThat(conflict.trades()).isEmpty(); assertThat(conflict.errors()).anyMatch(s -> s.contains("disagree"));
    }
    @Test void utf8BomIsAcceptedAndLegacyCsvStillRequiresExplicitR() throws Exception {
        var bom = ("\ufeff" + new String(fixture(), StandardCharsets.UTF_8)).getBytes(StandardCharsets.UTF_8);
        assertThat(service.importCsv(workspace.getId(), file(bom), null, null, true).getImported()).isEqualTo(25);
        var legacy = file("Date,Time,Instrument,Direction,Result,P&L(R)\n2025-10-06,09:30,GER40,SHORT,WIN,2".getBytes(StandardCharsets.UTF_8));
        assertThat(service.importCsv(workspace.getId(), legacy, null, null, true).getTrades().get(0).getPnlR()).isEqualByComparingTo("2");
    }
    @Test void mixedCurrencySamplesStaySeparateAndDrawdownUsesExitOrder() {
        var a = cash("100", "EUR", "2025-10-06", "12:00");
        var b = cash("-50", "EUR", "2025-10-06", "11:00");
        var usd = cash("1000", "USD", "2025-10-06", "10:00");
        var m = service.calculateMetrics(List.of(a, b, usd));
        assertThat(m.getCurrencyMetrics().get("EUR").getNetPnl()).isEqualByComparingTo("50");
        assertThat(m.getCurrencyMetrics().get("EUR").getMaximumDrawdown()).isEqualByComparingTo("50");
        assertThat(m.getCurrencyMetrics().get("USD").getNetPnl()).isEqualByComparingTo("1000");
        assertThat(m.getCurrencyMetrics().get("USD").getProfitFactor()).isNull();
        assertThat(m.getTotalR()).isNull();
    }
    @Test void oneUnknownRInvalidatesFullSampleRMetricsAndPreservesWinCounts() {
        var a = cash("100", "EUR", "2025-10-06", "12:00"); a.setPnlR(BigDecimal.ONE);
        var b = cash("-50", "EUR", "2025-10-06", "11:00");
        var m = service.calculateMetrics(List.of(a, b));
        assertThat(m.getRSampleSize()).isEqualTo(1); assertThat(m.getExpectancy()).isNull(); assertThat(m.getWins()).isEqualTo(1); assertThat(m.getLosses()).isEqualTo(1);
    }
    @Test void editingContextPreservesReplaySourceAndRejectsChangedExecutionIdentity() throws Exception {
        var trade = parse(new String(fixture(), StandardCharsets.UTF_8)).trades().get(0);
        var request = new BacktestingTradeRequest();
        request.setDate(trade.getDate()); request.setEntryTime(trade.getEntryTime()); request.setInstrument(trade.getInstrument());
        request.setDirection(trade.getDirection()); request.setResult(trade.getResult());
        request.setSource(BacktestingTradeSource.MANUAL); request.setTradeScope(BacktestingTradeScope.BACKTEST); request.setNotes("Reviewed replay");
        ReflectionTestUtils.invokeMethod(service, "applyTradeRequest", trade, request, BacktestingTradeSource.IMPORT);
        assertThat(trade.getSource()).isEqualTo(BacktestingTradeSource.IMPORT);
        assertThat(trade.getTradeScope()).isEqualTo(BacktestingTradeScope.REPLAY); assertThat(trade.getPnlR()).isNull();
        assertThat(trade.getNotes()).isEqualTo("Reviewed replay");
        request.setInstrument("OTHER");
        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(service, "applyTradeRequest", trade, request, BacktestingTradeSource.IMPORT))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("execution fields are preserved");
    }

    private BacktestingTrade cash(String pnl, String currency, String date, String exitTime) {
        var value = new BigDecimal(pnl);
        return BacktestingTrade.builder().date(LocalDate.parse(date)).entryTime(LocalTime.of(9, 0)).exitDate(LocalDate.parse(date)).exitTime(LocalTime.parse(exitTime))
                .netPnl(value).currency(currency).result(value.signum() > 0 ? BacktestingTradeResult.WIN : BacktestingTradeResult.LOSS).build();
    }
}
