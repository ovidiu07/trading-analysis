package com.tradevault.service;

import com.tradevault.domain.entity.BacktestingTrade;
import com.tradevault.domain.enums.BacktestingTradeDirection;
import com.tradevault.domain.enums.BacktestingTradeResult;
import com.tradevault.dto.backtesting.BacktestingMetricResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BacktestingResearchServiceTest {
    private final BacktestingResearchService service = new BacktestingResearchService(null, null, null, null, null, null);

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

    private BacktestingTrade trade(BacktestingTradeResult result, String pnlR) {
        return BacktestingTrade.builder()
                .direction(BacktestingTradeDirection.LONG)
                .result(result)
                .pnlR(new BigDecimal(pnlR))
                .build();
    }
}
