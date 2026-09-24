package com.tradevault.service.marketdata;

import com.tradevault.service.backtest.BacktestCandle;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AnalysisWindowCalculatorTest {
    @Test
    void londonWindowFollowsBritishSummerTimeAndWinterTime() {
        var summer = AnalysisWindowCalculator.LONDON;
        var summerStart = LocalDate.of(2026, 3, 29).atTime(summer.start()).atZone(summer.zone()).toInstant();
        var winterStart = LocalDate.of(2026, 10, 25).atTime(summer.start()).atZone(summer.zone()).toInstant();
        assertThat(summerStart).isEqualTo(Instant.parse("2026-03-29T07:00:00Z"));
        assertThat(winterStart).isEqualTo(Instant.parse("2026-10-25T08:00:00Z"));
    }

    @Test
    void rangeIsNotPublishedWhileWindowIsOpenAndUsesOnlyBarsInWindowAfterClose() {
        LocalDate date = LocalDate.of(2026, 9, 24);
        Instant start = date.atTime(9, 0).atZone(AnalysisWindowCalculator.ASIA.zone()).toInstant();
        List<BacktestCandle> bars = List.of(
                candle(start.minusSeconds(300), "99", "98"),
                candle(start, "101", "100"),
                candle(start.plusSeconds(300), "103", "97"));
        var partial = AnalysisWindowCalculator.calculate(AnalysisWindowCalculator.ASIA, date, bars, start.plusSeconds(300));
        assertThat(partial.completionState()).isEqualTo("IN_PROGRESS");
        assertThat(partial.high()).isNull();

        var complete = AnalysisWindowCalculator.calculate(AnalysisWindowCalculator.ASIA, date, bars,
                date.atTime(15, 1).atZone(AnalysisWindowCalculator.ASIA.zone()).toInstant());
        assertThat(complete.completionState()).isEqualTo("COMPLETE");
        assertThat(complete.high()).isEqualByComparingTo("103");
        assertThat(complete.low()).isEqualByComparingTo("97");
        assertThat(complete.completedBarCount()).isEqualTo(2);
    }

    @Test
    void identifiesTheActiveAnalysisWindowInItsOwnTimezone() {
        Instant tokyoMorning = OffsetDateTime.of(2026, 9, 24, 1, 0, 0, 0, ZoneOffset.UTC).toInstant();
        assertThat(AnalysisWindowCalculator.currentWindow(tokyoMorning)).isEqualTo("ASIA");
        assertThat(AnalysisWindowCalculator.currentWindow(Instant.parse("2026-09-24T10:00:00Z"))).isEqualTo("LONDON");
        assertThat(AnalysisWindowCalculator.currentWindow(Instant.parse("2026-09-24T19:00:00Z")))
                .isEqualTo("OUTSIDE_ANALYSIS_WINDOWS");
    }

    private BacktestCandle candle(Instant at, String high, String low) {
        return new BacktestCandle(at.atOffset(ZoneOffset.UTC), new BigDecimal(high), new BigDecimal(high), new BigDecimal(low), new BigDecimal(low), 1);
    }
}
