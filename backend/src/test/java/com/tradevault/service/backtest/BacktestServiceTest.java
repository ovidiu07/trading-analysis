package com.tradevault.service.backtest;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.BacktestRun;
import com.tradevault.domain.entity.ContextSnapshot;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.BacktestOrderType;
import com.tradevault.domain.enums.BacktestRunStatus;
import com.tradevault.domain.enums.ContextSnapshotMode;
import com.tradevault.domain.enums.Direction;
import com.tradevault.dto.backtest.BacktestTradeResponse;
import com.tradevault.dto.backtest.BacktestTradeSimulateRequest;
import com.tradevault.repository.BacktestRunRepository;
import com.tradevault.repository.BacktestTradeRepository;
import com.tradevault.service.ContextSnapshotService;
import com.tradevault.service.CurrentUserService;
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

class BacktestServiceTest {

    private BacktestRunRepository backtestRunRepository;
    private BacktestTradeRepository backtestTradeRepository;
    private CandleDataService candleDataService;
    private BacktestDatasetService backtestDatasetService;
    private CurrentUserService currentUserService;
    private ContextSnapshotService contextSnapshotService;
    private BacktestService backtestService;
    private User user;
    private BacktestRun run;

    @BeforeEach
    void setup() {
        backtestRunRepository = mock(BacktestRunRepository.class);
        backtestTradeRepository = mock(BacktestTradeRepository.class);
        candleDataService = mock(CandleDataService.class);
        backtestDatasetService = mock(BacktestDatasetService.class);
        currentUserService = mock(CurrentUserService.class);
        contextSnapshotService = mock(ContextSnapshotService.class);
        backtestService = new BacktestService(
                backtestRunRepository,
                backtestTradeRepository,
                candleDataService,
                backtestDatasetService,
                currentUserService,
                contextSnapshotService,
                new ObjectMapper()
        );

        user = User.builder().id(UUID.randomUUID()).email("backtest@test.com").build();
        run = BacktestRun.builder()
                .id(UUID.randomUUID())
                .user(user)
                .symbol("OANDA:EURUSD")
                .timeframe("M1")
                .rangeFrom(OffsetDateTime.parse("2026-02-01T00:00:00Z"))
                .rangeTo(OffsetDateTime.parse("2026-02-01T02:00:00Z"))
                .provider("OANDA")
                .sourceId(user.getId().toString())
                .status(BacktestRunStatus.READY)
                .candleCount(4)
                .build();

        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(backtestRunRepository.findByIdAndUser_Id(run.getId(), user.getId())).thenReturn(Optional.of(run));
        when(backtestTradeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(contextSnapshotService.createSnapshot(
                eq(user),
                eq(ContextSnapshotMode.BACKTEST),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any()
        )).thenReturn(ContextSnapshot.builder()
                .id(UUID.randomUUID())
                .strategyVersionId(UUID.randomUUID())
                .build());
    }

    @Test
    void simulateMarketTradeUsesConservativeSlOnSameBarTouch() {
        List<BacktestCandle> candles = List.of(
                candle("2026-02-01T00:00:00Z", "100.0", "100.2", "99.8", "100.0"),
                candle("2026-02-01T00:01:00Z", "100.0", "101.5", "98.8", "100.8")
        );
        when(candleDataService.getCandles(user.getId(), "OANDA", run.getSourceId(), "OANDA:EURUSD", "M1", run.getRangeFrom(), run.getRangeTo(), false))
                .thenReturn(candles);

        BacktestTradeSimulateRequest request = new BacktestTradeSimulateRequest();
        request.setDirection(Direction.LONG);
        request.setOrderType(BacktestOrderType.MARKET);
        request.setStopLossPrice(new BigDecimal("99.0"));
        request.setTakeProfitPrice(new BigDecimal("101.0"));
        request.setReplayCursorTime(OffsetDateTime.parse("2026-02-01T00:00:00Z"));
        request.setConservativeSameBar(true);

        BacktestTradeResponse response = backtestService.simulateTrade(run.getId(), request);

        assertThat(response.isFilled()).isTrue();
        assertThat(response.getEntryPrice()).isEqualByComparingTo("100.0");
        assertThat(response.getExitReason().name()).isEqualTo("SL");
        assertThat(response.getRMultiple()).isEqualByComparingTo("-1.0000");
        assertThat(response.getWin()).isFalse();
    }

    @Test
    void simulateLimitTradeFillsOnTouchAndCanHitTpLater() {
        List<BacktestCandle> candles = List.of(
                candle("2026-02-01T00:00:00Z", "100.0", "100.1", "99.9", "100.0"),
                candle("2026-02-01T00:01:00Z", "102.0", "103.0", "101.0", "102.5"),
                candle("2026-02-01T00:02:00Z", "100.2", "100.5", "99.8", "100.1"),
                candle("2026-02-01T00:03:00Z", "100.1", "102.6", "99.9", "102.2")
        );
        when(candleDataService.getCandles(user.getId(), "OANDA", run.getSourceId(), "OANDA:EURUSD", "M1", run.getRangeFrom(), run.getRangeTo(), false))
                .thenReturn(candles);

        BacktestTradeSimulateRequest request = new BacktestTradeSimulateRequest();
        request.setDirection(Direction.LONG);
        request.setOrderType(BacktestOrderType.LIMIT);
        request.setEntryPrice(new BigDecimal("100.0"));
        request.setStopLossPrice(new BigDecimal("98.0"));
        request.setTakeProfitPrice(new BigDecimal("102.0"));
        request.setReplayCursorTime(OffsetDateTime.parse("2026-02-01T00:00:00Z"));
        request.setConservativeSameBar(true);

        BacktestTradeResponse response = backtestService.simulateTrade(run.getId(), request);

        assertThat(response.isFilled()).isTrue();
        assertThat(response.getEntryPrice()).isEqualByComparingTo("100.0");
        assertThat(response.getExitReason().name()).isEqualTo("TP");
        assertThat(response.getRMultiple()).isEqualByComparingTo("1.0000");
        assertThat(response.getDurationBars()).isEqualTo(2);
        assertThat(response.getWin()).isTrue();
    }

    private BacktestCandle candle(String ts, String open, String high, String low, String close) {
        return new BacktestCandle(
                OffsetDateTime.parse(ts),
                new BigDecimal(open),
                new BigDecimal(high),
                new BigDecimal(low),
                new BigDecimal(close),
                100L
        );
    }
}
