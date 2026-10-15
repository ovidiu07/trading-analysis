package com.tradevault.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.*;
import com.tradevault.domain.enums.*;
import com.tradevault.repository.*;
import com.tradevault.dto.backtesting.BacktestingTradeRequest;
import org.springframework.test.util.ReflectionTestUtils;
import com.tradevault.service.backtesting.ReplayCsvParser;
import com.tradevault.service.backtesting.FvgSignalMetadata;
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
    byte[] strategyFixture() throws Exception { return Objects.requireNonNull(getClass().getResourceAsStream("/backtesting/tradingview-strategy-ger40f-usd.csv")).readAllBytes(); }
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

    static final String FVG_ENTRY = "SHORT GER / 2 | FVGv1 tf=5 lo=19198.5 hi=19210.0 size=11.5 sizePct=0.0599 created=1728397200000 mode=TOUCH depth=0 rr=3 BE=90/30";
    static String fvgCsv(String entrySignal, String exitSignal, String price) {
        return "Trade number,Type,Date and time,Signal,Price EUR,Size (qty),Net PnL USD\n"
                + "1,Entry short,2024-10-08 17:20," + entrySignal + "," + price + ",2.7,-94.82\n"
                + "1,Exit short,2024-10-08 18:50," + exitSignal + ",19230.5,2.7,-94.82\n";
    }

    @Test void preservesLongEntryAndExitSignalsAndParsesOnlyTheFvgSection() throws Exception {
        String entry = FVG_ENTRY + " | FVGAGEv1 id=PEPPERSTONE:GER40F:5:1728397200000:-1 srcBar=851 orderAge=0 ageOn=1 maxAge=3 session=3 sessionName=New_York submitted=1728397200000 sl=19230.5";
        String exit = "SL | audit=" + "x".repeat(1000);
        var result = parse(fvgCsv(entry, exit, "19198.5"));
        assertThat(result.errors()).isEmpty();
        var trade = result.trades().getFirst();
        assertThat(trade.getEntrySignal()).isEqualTo(entry);
        assertThat(trade.getExitSignal()).isEqualTo(exit);
        assertThat(trade.isGapPresent()).isTrue();
        assertThat(trade.getGapLow()).isEqualByComparingTo("19198.5");
        assertThat(FvgSignalMetadata.protectedProfitPercent(entry)).isEqualByComparingTo("30");
    }

    @Test void importsVersionedGapFactsAndKeepsUnavailableNativeFieldsBlank() throws Exception {
        var result = parse(fvgCsv(FVG_ENTRY, "SL | fillPct=0 fillBars=1 touchBars=1 ageMin=0", "19198.5"));
        assertThat(result.errors()).isEmpty();
        var gap = result.trades().getFirst();
        assertThat(gap.isGapPresent()).isTrue();
        assertThat(gap.getGapType()).isEqualTo(BacktestingGapType.BEARISH);
        assertThat(gap.getGapTimeframe()).isEqualTo("5");
        assertThat(gap.getGapLow()).isEqualByComparingTo("19198.5");
        assertThat(gap.getGapHigh()).isEqualByComparingTo("19210");
        assertThat(gap.getGapMidpoint()).isEqualByComparingTo("19204.25");
        assertThat(gap.getGapSizePercent()).isEqualByComparingTo("0.0599");
        assertThat(gap.getGapEntryPositionPercent()).isZero();
        assertThat(gap.getGapCreatedAt()).isNull(); // No verified exported-clock timezone.
        assertThat(gap.getGapSizePoints()).isNull();
        assertThat(gap.getGapMitigatedAt()).isNull();
        assertThat(gap.getGapFillStatus()).isNull();
        assertThat(gap.getPnlR()).isNull();
        assertThat(gap.getPlannedRR()).isNull();
        var file = file(fvgCsv(FVG_ENTRY, "SL", "19198.5").getBytes(StandardCharsets.UTF_8));
        var preview = service.importCsv(workspace.getId(), file, "GER40F", "Europe/Bucharest", true);
        assertThat(preview.getTrades().getFirst().getGapCreatedAt()).isEqualTo(LocalTime.of(17, 20));
    }

    @Test void sameCandleAndOutOfZoneFillsKeepTheirGeometryWithoutInventingDepthAnnotations() throws Exception {
        String text = fvgCsv(FVG_ENTRY, "SL", "19221.5").replace("18:50", "17:20");
        var result = parse(text);
        assertThat(result.errors()).isEmpty();
        var gap = result.trades().getFirst();
        assertThat(gap.isGapPresent()).isTrue();
        assertThat(gap.getGapEntryPositionPercent()).isNull(); // Actual 200% stays in raw execution/geometry.
        assertThat(gap.getEntrySignal()).isEqualTo(FVG_ENTRY);
        assertThat(gap.getExitSignal()).isEqualTo("SL");
    }

    @Test void rejectsMalformedVersionedGeometryInsteadOfImportingFalseGapFacts() throws Exception {
        for (String signal : List.of(FVG_ENTRY.replace("size=11.5", "size=12"), FVG_ENTRY + " lo=1",
                FVG_ENTRY.replace("BE=90/30", "BE=30/90"), FVG_ENTRY.replace("created=1728397200000", "created=0"))) {
            var result = parse(fvgCsv(signal, "SL", "19198.5"));
            assertThat(result.trades()).isEmpty();
            assertThat(result.errors()).anyMatch(error -> error.contains("Invalid FVGv1 signal"));
        }
    }

    @Test void reimportAddsOnlyMissingFvgFactsAndPreviewNeverMutatesExistingTrades() throws Exception {
        var original = parse(fvgCsv("SHORT GER / 2", "SL", "19198.5")).trades().getFirst();
        original.setPnlR(new BigDecimal("-1"));
        original.setPlannedRR(new BigDecimal("3"));
        original.setNotes("Keep my review");
        original.setTagsJson("[\"reviewed\"]");
        when(trades.findByWorkspace_IdAndUser_IdOrderByDateAscEntryTimeAscCreatedAtAsc(workspace.getId(), user.getId())).thenReturn(List.of(original));
        var csv = file(fvgCsv(FVG_ENTRY, "SL | fillPct=0 fillBars=1 touchBars=1 ageMin=0", "19198.5").getBytes(StandardCharsets.UTF_8));
        var preview = service.importCsv(workspace.getId(), csv, "PEPPERSTONE:GER40F", null, true);
        assertThat(preview.getImported()).isZero();
        assertThat(preview.getDuplicates()).isEqualTo(1);
        assertThat(preview.getMetadataUpdated()).isEqualTo(1);
        assertThat(preview.getWarnings()).anyMatch(warning -> warning.contains("can be added to 1 existing"));
        assertThat(original.isGapPresent()).isFalse();
        assertThat(original.getEntrySignal()).isEqualTo("SHORT GER / 2");
        verify(trades, never()).saveAll(anyList());
        var imported = service.importCsv(workspace.getId(), csv, "PEPPERSTONE:GER40F", null, false);
        assertThat(imported.getImported()).isZero();
        assertThat(imported.getDuplicates()).isEqualTo(1);
        assertThat(imported.getMetadataUpdated()).isEqualTo(1);
        assertThat(imported.getWarnings()).anyMatch(warning -> warning.contains("added to 1 existing"));
        assertThat(original.isGapPresent()).isTrue();
        assertThat(original.getEntrySignal()).isEqualTo(FVG_ENTRY);
        assertThat(original.getPnlR()).isEqualByComparingTo("-1");
        assertThat(original.getPlannedRR()).isEqualByComparingTo("3");
        assertThat(original.getNotes()).isEqualTo("Keep my review");
        assertThat(original.getTagsJson()).isEqualTo("[\"reviewed\"]");
        assertThat(original.getNetPnl()).isEqualByComparingTo("-94.82");
        verify(trades).saveAll(argThat(saved -> { var rows = new ArrayList<BacktestingTrade>(); saved.forEach(rows::add); return rows.equals(List.of(original)); }));
    }

    @Test void reimportPreservesExistingGapResearchAndDoesNotHidePnlConflicts() throws Exception {
        var original = parse(fvgCsv("SHORT GER / 2", "SL", "19198.5")).trades().getFirst();
        original.setGapConfluenceNotes("Manual research");
        when(trades.findByWorkspace_IdAndUser_IdOrderByDateAscEntryTimeAscCreatedAtAsc(workspace.getId(), user.getId())).thenReturn(List.of(original));
        var csv = file(fvgCsv(FVG_ENTRY, "SL", "19198.5").getBytes(StandardCharsets.UTF_8));
        var result = service.importCsv(workspace.getId(), csv, "PEPPERSTONE:GER40F", null, false);
        assertThat(result.getDuplicates()).isEqualTo(1);
        assertThat(original.getEntrySignal()).isEqualTo("SHORT GER / 2");
        verify(trades, never()).saveAll(anyList());
        original.setNetPnl(BigDecimal.TEN);
        var conflict = service.importCsv(workspace.getId(), csv, "PEPPERSTONE:GER40F", null, false);
        assertThat(conflict.getInvalid()).isEqualTo(1);
        assertThat(conflict.getErrors()).anyMatch(error -> error.contains("different net PnL"));
        assertThat(original.isGapPresent()).isFalse();
    }
    @Test void previewsAndImportsStrategyFilenameWithIndependentPriceAndPnlCurrencies() throws Exception {
        String filename = "Five_Sessions_FVG_Windows_PEPPERSTONE_GER40F_2026-10-14_b1a3e.csv";
        var file = new MockMultipartFile("file", filename, "text/csv", strategyFixture());
        var preview = service.importCsv(workspace.getId(), file, null, null, true);
        assertThat(preview.getFormat()).isEqualTo(ReplayCsvParser.FORMAT);
        assertThat(preview.getRowCount()).isEqualTo(832);
        assertThat(preview.getImported()).isEqualTo(416);
        assertThat(preview.getInvalid()).isZero();
        assertThat(preview.getErrors()).isEmpty();
        assertThat(preview.getWarnings()).anyMatch(warning -> warning.contains("Price currency differs from PnL currency"));
        assertThat(preview.getTrades()).allSatisfy(trade -> {
            assertThat(trade.getInstrument()).isEqualTo("PEPPERSTONE:GER40F");
            assertThat(trade.getPriceCurrency()).isEqualTo("EUR");
            assertThat(trade.getCurrency()).isEqualTo("USD");
            assertThat(trade.getPnlR()).isNull();
            assertThat(trade.getPlannedRR()).isNull();
            assertThat(trade.getTradeScope()).isEqualTo(BacktestingTradeScope.REPLAY);
        });
        var first = preview.getTrades().get(0);
        assertThat(first.getDate()).isEqualTo(LocalDate.of(2025, 10, 3));
        assertThat(first.getEntryTime()).isEqualTo(LocalTime.of(18, 0));
        assertThat(first.getExitTime()).isEqualTo(LocalTime.of(18, 55));
        assertThat(first.getEntryPrice()).isEqualByComparingTo("24490.7");
        assertThat(first.getExitPrice()).isEqualByComparingTo("24527.1");
        assertThat(first.getQuantity()).isEqualByComparingTo("3.6");
        assertThat(first.getNetPnl()).isEqualByComparingTo("153.53");
        assertThat(first.getAdverseExcursion()).isEqualByComparingTo("-34.17");
        assertThat(first.getDurationBars()).isEqualTo(11);
        verify(trades, never()).saveAll(anyList());
        assertThat(service.importCsv(workspace.getId(), file, "", null, false).getImported()).isEqualTo(416);
        verify(trades).saveAll(argThat(saved -> {
            List<BacktestingTrade> values = new ArrayList<>(); saved.forEach(values::add);
            var metrics = service.calculateMetrics(values);
            assertThat(metrics.getWins()).isEqualTo(171);
            assertThat(metrics.getLosses()).isEqualTo(245);
            assertThat(metrics.getCurrencyMetrics()).containsOnlyKeys("USD");
            assertThat(metrics.getCurrencyMetrics().get("USD").getNetPnl()).isEqualByComparingTo("1601.38");
            assertThat(values).allSatisfy(trade -> assertThat(trade.getPriceCurrency()).isEqualTo("EUR"));
            return values.size() == 416;
        }));
    }

    @Test void detectsStrategyAndReplayNamesWithoutDependingOnTheirTitleDateOrHash() {
        assertThat(ReplayCsvParser.symbolFromFilename("Five_Sessions_FVG_Windows_PEPPERSTONE_GER40F_2026-10-14_b1a3e.csv")).isEqualTo("PEPPERSTONE:GER40F");
        assertThat(ReplayCsvParser.symbolFromFilename("Another_strategy_OANDA_EURUSD_2025-01-01.csv")).isEqualTo("OANDA:EURUSD");
        assertThat(ReplayCsvParser.symbolFromFilename("Replay_Trading_CME_MINI_MNQ1!_2026-10-14_hash.csv")).isEqualTo("CME_MINI:MNQ1!");
        assertThat(ReplayCsvParser.symbolFromFilename("Strategy_CME_MINI_MNQ1!_2026-10-14_hash.csv")).isEqualTo("CME_MINI:MNQ1!");
        assertThat(ReplayCsvParser.symbolFromFilename("trades.csv")).isNull();
    }

    @Test void differentCurrencyExportReimportsAsDuplicatesWithoutChangingExistingExecutions() throws Exception {
        String filename = "Five_Sessions_FVG_Windows_PEPPERSTONE_GER40F_2026-10-14_b1a3e.csv";
        var file = new MockMultipartFile("file", filename, "text/csv", strategyFixture());
        var parsed = parse(new String(strategyFixture(), StandardCharsets.UTF_8).replace("\ufeff", ""));
        when(trades.findByWorkspace_IdAndUser_IdOrderByDateAscEntryTimeAscCreatedAtAsc(workspace.getId(), user.getId())).thenReturn(parsed.trades());
        var result = service.importCsv(workspace.getId(), file, null, null, false);
        assertThat(result.getImported()).isZero();
        assertThat(result.getDuplicates()).isEqualTo(416);
        assertThat(result.getInvalid()).isZero();
        verify(trades, never()).saveAll(anyList());
        parsed.trades().get(0).setPriceCurrency("GBP");
        var conflict = service.importCsv(workspace.getId(), file, null, null, true);
        assertThat(conflict.getImported()).isZero();
        assertThat(conflict.getDuplicates()).isEqualTo(415);
        assertThat(conflict.getErrors()).anyMatch(error -> error.contains("different price currency"));
    }

    @Test void rejectsMissingOrAmbiguousPriceAndPnlHeadersInsteadOfChoosingAnArbitraryCurrency() throws Exception {
        String text = new String(fixture(), StandardCharsets.UTF_8);
        assertThatThrownBy(() -> parse(text.replace("Price EUR", "Price"))).hasMessageContaining("exactly one Price currency column");
        assertThatThrownBy(() -> parse(text.replace("Price EUR", "Price EUR,Price GBP"))).hasMessageContaining("exactly one Price currency column");
        assertThatThrownBy(() -> parse(text.replace("Net PnL EUR", "Net PnL EUR,Net PnL USD"))).hasMessageContaining("exactly one Net PnL currency column");
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
    @Test void previewDoesNotPersistOrRequireMatchingWorkspaceInstrument() throws Exception {
        var result = service.importCsv(workspace.getId(), file(fixture()), null, null, true);
        assertThat(result.isPreview()).isTrue(); assertThat(result.getImported()).isEqualTo(25);
        assertThat(result.getWarnings()).noneMatch(s -> s.contains("differs from workspace"));
        assertThat(result.getWarnings()).anyMatch(s -> s.contains("Timezone is unspecified"));
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
