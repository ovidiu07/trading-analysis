package com.tradevault.service.marketdata;

import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;
import com.tradevault.dto.market.MarketWorkspaceResponse.AvailabilityReason;
import com.tradevault.service.backtest.CanonicalCandle;
import com.tradevault.service.backtest.OandaCandleProvider;
import com.tradevault.service.backtest.OandaEnvironment;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class MarketAnalysisServiceTest {
    private final OandaCandleProvider oanda = mock(OandaCandleProvider.class);
    private final MarketAnalysisService service = new MarketAnalysisService(oanda);
    private final LocalDate date = LocalDate.of(2026, 9, 24);

    @Test
    void returnsUnavailableWithoutRequestingCandlesWhenRightsGateIsOff() {
        var result = service.analyze(UUID.randomUUID(), UUID.randomUUID(), "secret-token", "account-ref",
                OandaEnvironment.PRACTICE, "GBPUSD", "GBP_USD", date, null);
        assertThat(result.availabilityReason()).isEqualTo(AvailabilityReason.LICENSE_REQUIRED);
        verifyNoInteractions(oanda);
    }

    @Test
    void derivesOnlySameInstrumentCompletedReferencesAndCompletedSessionRanges() {
        ReflectionTestUtils.setField(service, "derivationsEnabled", true);
        OffsetDateTime tradingDayStart = date.minusDays(1).atTime(17, 0).atZone(ZoneId.of("America/New_York")).toOffsetDateTime();
        OffsetDateTime asiaStart = date.atTime(9, 0).atZone(ZoneId.of("Asia/Tokyo")).toOffsetDateTime();
        OffsetDateTime londonStart = date.atTime(8, 0).atZone(ZoneId.of("Europe/London")).toOffsetDateTime();
        List<CanonicalCandle> intraday = List.of(
                candle("GBP_USD", BacktestTimeframe.M5, tradingDayStart, "150", "151", "149", "150"),
                candle("GBP_USD", BacktestTimeframe.M5, asiaStart, "151", "155", "150", "153"),
                candle("GBP_USD", BacktestTimeframe.M5, londonStart, "153", "157", "152", "156"));
        List<CanonicalCandle> daily = List.of(candle("GBP_USD", BacktestTimeframe.D1,
                tradingDayStart.minusDays(1), "145", "160", "140", "150"));
        when(oanda.getCandles(eq("secret-token"), eq("account-ref"), eq("GBPUSD"), eq("GBPUSD"), eq(BacktestTimeframe.M5),
                any(), any(), eq(OandaEnvironment.LIVE))).thenReturn(intraday);
        when(oanda.getCandles(eq("secret-token"), eq("account-ref"), eq("GBPUSD"), eq("GBPUSD"), eq(BacktestTimeframe.D1),
                any(), any(), eq(OandaEnvironment.LIVE))).thenReturn(daily);

        var result = service.analyze(UUID.randomUUID(), UUID.randomUUID(), "secret-token", "account-ref",
                OandaEnvironment.LIVE, "GBPUSD", "GBP_USD", date,
                new OandaCandleProvider.OandaQuote("GBP_USD", new BigDecimal("160"), new BigDecimal("162"),
                        OffsetDateTime.now(ZoneOffset.UTC), true, "MID"));

        assertThat(result.dailyOpen()).isEqualByComparingTo("150");
        assertThat(result.previousDailyClose()).isEqualByComparingTo("150");
        assertThat(result.changePercent()).isEqualByComparingTo("7.333333");
        assertThat(result.previousDayHigh()).isEqualByComparingTo("160");
        assertThat(result.previousDayLow()).isEqualByComparingTo("140");
        assertThat(result.asia().high()).isEqualByComparingTo("155");
        assertThat(result.london().low()).isEqualByComparingTo("152");
        assertThat(result.asia().completionState()).isEqualTo("COMPLETE");
        verify(oanda, times(2)).getCandles(anyString(), anyString(), eq("GBPUSD"), eq("GBPUSD"), any(), any(), any(), eq(OandaEnvironment.LIVE));
    }

    private CanonicalCandle candle(String providerSymbol, BacktestTimeframe timeframe, OffsetDateTime timestamp,
                                   String open, String high, String low, String close) {
        return new CanonicalCandle(BacktestCandleSource.OANDA, "account-ref", "GBPUSD", providerSymbol, timeframe,
                timestamp, new BigDecimal(open), new BigDecimal(high), new BigDecimal(low), new BigDecimal(close), BigDecimal.ZERO);
    }
}
