package com.tradevault.service.backtest;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.CandleCache;
import com.tradevault.repository.CandleCacheRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CandleDataServiceTest {

    private CandleCacheRepository candleCacheRepository;
    private CandleProvider candleProvider;
    private CandleDataService candleDataService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setup() {
        candleCacheRepository = mock(CandleCacheRepository.class);
        candleProvider = mock(CandleProvider.class);
        objectMapper = new ObjectMapper().findAndRegisterModules();
        candleDataService = new CandleDataService(candleCacheRepository, List.of(candleProvider), objectMapper);
        when(candleProvider.providerKey()).thenReturn("OANDA");
    }

    @Test
    void returnsCachedPayloadWhenAvailableAndRefreshIsFalse() throws Exception {
        OffsetDateTime from = OffsetDateTime.parse("2026-02-01T00:00:00Z");
        OffsetDateTime to = OffsetDateTime.parse("2026-02-01T00:10:00Z");
        List<BacktestCandle> cachedCandles = List.of(
                new BacktestCandle(OffsetDateTime.parse("2026-02-01T00:00:00Z"), new BigDecimal("1.1000"), new BigDecimal("1.1010"), new BigDecimal("1.0990"), new BigDecimal("1.1005"), 100L)
        );

        CandleCache cached = CandleCache.builder()
                .id(UUID.randomUUID())
                .provider("OANDA")
                .symbol("OANDA:EURUSD")
                .timeframe("M1")
                .rangeFrom(from)
                .rangeTo(to)
                .payload(objectMapper.writeValueAsString(cachedCandles))
                .build();

        when(candleCacheRepository.findByProviderAndSymbolAndTimeframeAndRangeFromAndRangeTo("OANDA", "OANDA:EURUSD", "M1", from, to))
                .thenReturn(Optional.of(cached));

        List<BacktestCandle> rows = candleDataService.getCandles("OANDA", "OANDA:EURUSD", "M1", from, to, false);

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).close()).isEqualByComparingTo("1.1005");
        verify(candleProvider, never()).getCandles(any(), any(), any(), any());
        verify(candleCacheRepository, never()).save(any(CandleCache.class));
    }

    @Test
    void fetchesProviderAndStoresCacheWhenMissing() {
        OffsetDateTime from = OffsetDateTime.parse("2026-02-01T00:00:00Z");
        OffsetDateTime to = OffsetDateTime.parse("2026-02-01T00:10:00Z");

        when(candleCacheRepository.findByProviderAndSymbolAndTimeframeAndRangeFromAndRangeTo("OANDA", "OANDA:EURUSD", "M1", from, to))
                .thenReturn(Optional.empty());

        List<BacktestCandle> providerRows = List.of(
                new BacktestCandle(OffsetDateTime.parse("2026-02-01T00:02:00Z"), new BigDecimal("1.1004"), new BigDecimal("1.1008"), new BigDecimal("1.1000"), new BigDecimal("1.1002"), 110L),
                new BacktestCandle(OffsetDateTime.parse("2026-02-01T00:01:00Z"), new BigDecimal("1.1001"), new BigDecimal("1.1006"), new BigDecimal("1.0999"), new BigDecimal("1.1004"), 105L)
        );
        when(candleProvider.getCandles("OANDA:EURUSD", "M1", from, to)).thenReturn(providerRows);
        when(candleCacheRepository.save(any(CandleCache.class))).thenAnswer(invocation -> invocation.getArgument(0, CandleCache.class));

        List<BacktestCandle> rows = candleDataService.getCandles("OANDA", "OANDA:EURUSD", "M1", from, to, false);

        assertThat(rows).hasSize(2);
        assertThat(rows.get(0).timestamp()).isEqualTo(OffsetDateTime.parse("2026-02-01T00:01:00Z"));
        assertThat(rows.get(1).timestamp()).isEqualTo(OffsetDateTime.parse("2026-02-01T00:02:00Z"));
        verify(candleProvider).getCandles("OANDA:EURUSD", "M1", from, to);
        verify(candleCacheRepository).save(argThat(cache ->
                cache.getPayload() != null
                        && !cache.getPayload().isBlank()
                        && "OANDA".equals(cache.getProvider())
                        && "OANDA:EURUSD".equals(cache.getSymbol())));
    }
}
