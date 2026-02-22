package com.tradevault.service.backtest;

import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;
import com.tradevault.exception.BacktestDomainException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CandleDataServiceTest {

    private CandleChunkStoreService candleChunkStoreService;
    private OandaCandleProvider oandaCandleProvider;
    private BacktestProviderService backtestProviderService;
    private BacktestRateLimiterService backtestRateLimiterService;
    private CandleDataService candleDataService;

    @BeforeEach
    void setup() {
        candleChunkStoreService = mock(CandleChunkStoreService.class);
        oandaCandleProvider = mock(OandaCandleProvider.class);
        backtestProviderService = mock(BacktestProviderService.class);
        backtestRateLimiterService = mock(BacktestRateLimiterService.class);
        candleDataService = new CandleDataService(
                candleChunkStoreService,
                oandaCandleProvider,
                backtestProviderService,
                backtestRateLimiterService
        );
    }

    @Test
    void returnsFromChunkStoreWhenCoverageIsFresh() {
        UUID userId = UUID.randomUUID();
        OffsetDateTime from = OffsetDateTime.parse("2026-02-01T00:00:00Z");
        OffsetDateTime to = OffsetDateTime.parse("2026-02-01T00:10:00Z");

        when(candleChunkStoreService.hasFreshCoverage(eq(userId), eq(BacktestCandleSource.OANDA), eq(userId.toString()), eq("EURUSD"), eq(BacktestTimeframe.M1), eq(from), eq(to), any()))
                .thenReturn(true);
        when(candleChunkStoreService.loadCandles(userId, BacktestCandleSource.OANDA, userId.toString(), "EURUSD", BacktestTimeframe.M1, from, to))
                .thenReturn(List.of(
                        new CanonicalCandle(BacktestCandleSource.OANDA, userId.toString(), "EURUSD", "OANDA:EURUSD", BacktestTimeframe.M1, from, new BigDecimal("1.1000"), new BigDecimal("1.1010"), new BigDecimal("1.0990"), new BigDecimal("1.1005"), BigDecimal.valueOf(100))
                ));

        List<BacktestCandle> rows = candleDataService.getCandles(userId, "OANDA", userId.toString(), "OANDA:EURUSD", "M1", from, to, false);

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).close()).isEqualByComparingTo("1.1005");
        verify(oandaCandleProvider, never()).getCandles(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void fetchesAndStoresWhenCoverageIsMissing() {
        UUID userId = UUID.randomUUID();
        OffsetDateTime from = OffsetDateTime.parse("2026-02-01T00:00:00Z");
        OffsetDateTime to = OffsetDateTime.parse("2026-02-01T00:10:00Z");

        when(candleChunkStoreService.hasFreshCoverage(eq(userId), eq(BacktestCandleSource.OANDA), eq(userId.toString()), eq("EURUSD"), eq(BacktestTimeframe.M1), eq(from), eq(to), any()))
                .thenReturn(false);
        when(backtestProviderService.requireOandaToken(userId)).thenReturn("token");
        when(oandaCandleProvider.getCandles("token", userId.toString(), "EURUSD", "OANDA:EURUSD", BacktestTimeframe.M1, from, to))
                .thenReturn(List.of(
                        new CanonicalCandle(BacktestCandleSource.OANDA, userId.toString(), "EURUSD", "OANDA:EURUSD", BacktestTimeframe.M1, from, new BigDecimal("1.1000"), new BigDecimal("1.1010"), new BigDecimal("1.0990"), new BigDecimal("1.1005"), BigDecimal.valueOf(100))
                ));
        when(candleChunkStoreService.loadCandles(userId, BacktestCandleSource.OANDA, userId.toString(), "EURUSD", BacktestTimeframe.M1, from, to))
                .thenReturn(List.of(
                        new CanonicalCandle(BacktestCandleSource.OANDA, userId.toString(), "EURUSD", "OANDA:EURUSD", BacktestTimeframe.M1, from, new BigDecimal("1.1000"), new BigDecimal("1.1010"), new BigDecimal("1.0990"), new BigDecimal("1.1005"), BigDecimal.valueOf(100))
                ));

        List<BacktestCandle> rows = candleDataService.getCandles(userId, "OANDA", userId.toString(), "OANDA:EURUSD", "M1", from, to, false);

        assertThat(rows).hasSize(1);
        verify(backtestRateLimiterService).assertCanFetch(userId);
        verify(candleChunkStoreService).saveCandles(eq(userId), eq(BacktestCandleSource.OANDA), eq(userId.toString()), eq("EURUSD"), eq("OANDA:EURUSD"), eq(BacktestTimeframe.M1), any());
    }

    @Test
    void requiresSourceIdForCsv() {
        UUID userId = UUID.randomUUID();
        OffsetDateTime from = OffsetDateTime.parse("2026-02-01T00:00:00Z");
        OffsetDateTime to = OffsetDateTime.parse("2026-02-01T00:10:00Z");

        assertThatThrownBy(() -> candleDataService.getCandles(userId, "CSV", null, "EURUSD", "M1", from, to, false))
                .isInstanceOf(BacktestDomainException.class)
                .hasMessageContaining("Dataset source id is required");
    }
}
