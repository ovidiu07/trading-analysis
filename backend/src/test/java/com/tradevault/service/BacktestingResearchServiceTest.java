package com.tradevault.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.BacktestingTrade;
import com.tradevault.domain.enums.BacktestingTradeDirection;
import com.tradevault.domain.enums.BacktestingTradeResult;
import com.tradevault.domain.enums.BacktestingTradeSource;
import com.tradevault.domain.enums.BacktestingGapFillStatus;
import com.tradevault.domain.enums.BacktestingGapType;
import com.tradevault.dto.backtesting.BacktestingMetricResponse;
import com.tradevault.dto.backtesting.BacktestingTradeRequest;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class BacktestingResearchServiceTest {
    private final BacktestingResearchService service = new BacktestingResearchService(null, null, null, null, null, new ObjectMapper());

    @Test
    void calculatesCoreMetricsAndSampleQuality() {
        BacktestingMetricResponse metrics = service.calculateMetrics(List.of(
                trade(BacktestingTradeResult.WIN, "2.00"),
                trade(BacktestingTradeResult.WIN, "1.00"),
                trade(BacktestingTradeResult.LOSS, "-1.00"),
                trade(BacktestingTradeResult.BREAKEVEN, "0.00")
        ));

        assertThat(metrics.getTrades()).isEqualTo(4);
        assertThat(metrics.getWins()).isEqualTo(2);
        assertThat(metrics.getLosses()).isEqualTo(1);
        assertThat(metrics.getBreakevens()).isEqualTo(1);
        assertThat(metrics.getWinRate()).isEqualByComparingTo("50");
        assertThat(metrics.getLossRate()).isEqualByComparingTo("25");
        assertThat(metrics.getBreakevenRate()).isEqualByComparingTo("25");
        assertThat(metrics.getTotalR()).isEqualByComparingTo("2");
        assertThat(metrics.getAverageR()).isEqualByComparingTo("0.5");
        assertThat(metrics.getExpectancy()).isEqualByComparingTo("0.5");
        assertThat(metrics.getProfitFactor()).isEqualByComparingTo("3");
        assertThat(metrics.getAverageWinR()).isEqualByComparingTo("1.5");
        assertThat(metrics.getAverageLossR()).isEqualByComparingTo("-1");
        assertThat(metrics.getLargestWinR()).isEqualByComparingTo("2");
        assertThat(metrics.getLargestLossR()).isEqualByComparingTo("-1");
        assertThat(metrics.getSampleQuality()).isEqualTo("Exploratory only");
    }

    @Test
    void classifiesSampleQualityThresholds() {
        assertThat(service.sampleQuality(9)).isEqualTo("Exploratory only");
        assertThat(service.sampleQuality(10)).isEqualTo("Early signal");
        assertThat(service.sampleQuality(30)).isEqualTo("Developing evidence");
        assertThat(service.sampleQuality(60)).isEqualTo("More reliable pattern");
    }

    @Test
    void mapsOptionalStrategyAndGapFieldsWithoutChangingExistingTradeContract() {
        BacktestingTradeRequest request = new BacktestingTradeRequest();
        request.setDate(LocalDate.of(2026, 6, 20));
        request.setEntryTime(LocalTime.of(9, 30));
        request.setInstrument("ger40");
        request.setDirection(BacktestingTradeDirection.SHORT);
        request.setResult(BacktestingTradeResult.WIN);
        request.setPnlR(new BigDecimal("2"));
        request.setStrategySource("MENTOR");
        request.setStrategyNameSnapshot("Liq + MSS + FVG");
        request.setGapPresent(true);
        request.setGapType(BacktestingGapType.BEARISH);
        request.setGapTimeframe("5m");
        request.setGapEntryPositionPercent(new BigDecimal("30"));
        request.setGapFillStatus(BacktestingGapFillStatus.PARTIALLY_FILLED);

        BacktestingTrade trade = new BacktestingTrade();
        ReflectionTestUtils.invokeMethod(service, "applyTradeRequest", trade, request, BacktestingTradeSource.MANUAL);

        assertThat(trade.getInstrument()).isEqualTo("GER40");
        assertThat(trade.getStrategySource()).isEqualTo("MENTOR");
        assertThat(trade.getStrategyNameSnapshot()).isEqualTo("Liq + MSS + FVG");
        assertThat(trade.isGapPresent()).isTrue();
        assertThat(trade.getGapType()).isEqualTo(BacktestingGapType.BEARISH);
        assertThat(trade.getGapEntryPositionPercent()).isEqualByComparingTo("30");
    }

    @Test
    void csvParserAcceptsLegacyRowsWithoutNewColumns() {
        BacktestingTradeRequest request = ReflectionTestUtils.invokeMethod(service, "requestFromCsv", Map.of(
                "Date", "2026-06-20", "Time", "09:30", "Instrument", "GER40", "Direction", "SHORT", "Result", "WIN", "P&L(R)", "2"
        ));

        assertThat(request).isNotNull();
        assertThat(request.isGapPresent()).isFalse();
        assertThat(request.getStrategyId()).isNull();
    }

    @Test
    void csvParserAcceptsStrategyAndStructuredGapColumns() {
        UUID strategyId = UUID.randomUUID();
        BacktestingTradeRequest request = ReflectionTestUtils.invokeMethod(service, "requestFromCsv", Map.ofEntries(
                Map.entry("Date", "2026-06-20"), Map.entry("Time", "09:30"), Map.entry("Instrument", "GER40"),
                Map.entry("Direction", "SHORT"), Map.entry("Result", "WIN"), Map.entry("P&L(R)", "2"),
                Map.entry("Strategy ID", strategyId.toString()), Map.entry("Strategy Source", "MENTOR"), Map.entry("Strategy Name", "Mentor FVG"),
                Map.entry("Gap Present", "yes"), Map.entry("Gap Type", "BEARISH"), Map.entry("Gap Timeframe", "5m"),
                Map.entry("Gap Entry Position Percent", "30"), Map.entry("Gap Fill Status", "PARTIALLY_FILLED")
        ));

        assertThat(request).isNotNull();
        assertThat(request.getStrategyId()).isEqualTo(strategyId);
        assertThat(request.isGapPresent()).isTrue();
        assertThat(request.getGapType()).isEqualTo(BacktestingGapType.BEARISH);
        assertThat(request.getGapFillStatus()).isEqualTo(BacktestingGapFillStatus.PARTIALLY_FILLED);
    }

    private BacktestingTrade trade(BacktestingTradeResult result, String pnlR) {
        return BacktestingTrade.builder()
                .direction(BacktestingTradeDirection.LONG)
                .result(result)
                .pnlR(new BigDecimal(pnlR))
                .build();
    }
}
