package com.tradevault.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.ContextSnapshot;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.entity.UserStrategy;
import com.tradevault.domain.enums.TradeSession;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.repository.BacktestRunRepository;
import com.tradevault.repository.BacktestRunReportRepository;
import com.tradevault.repository.BacktestTradeRepository;
import com.tradevault.repository.ContextSnapshotRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.repository.UserStrategyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class DiagnosticsServiceTest {

    private CurrentUserService currentUserService;
    private TradeRepository tradeRepository;
    private BacktestTradeRepository backtestTradeRepository;
    private BacktestRunRepository backtestRunRepository;
    private BacktestRunReportRepository backtestRunReportRepository;
    private UserStrategyRepository userStrategyRepository;
    private ContextSnapshotRepository contextSnapshotRepository;
    private DiagnosticsService diagnosticsService;
    private ObjectMapper objectMapper;
    private User user;

    @BeforeEach
    void setup() {
        currentUserService = mock(CurrentUserService.class);
        tradeRepository = mock(TradeRepository.class);
        backtestTradeRepository = mock(BacktestTradeRepository.class);
        backtestRunRepository = mock(BacktestRunRepository.class);
        backtestRunReportRepository = mock(BacktestRunReportRepository.class);
        userStrategyRepository = mock(UserStrategyRepository.class);
        contextSnapshotRepository = mock(ContextSnapshotRepository.class);
        diagnosticsService = new DiagnosticsService(
                currentUserService,
                tradeRepository,
                backtestTradeRepository,
                backtestRunRepository,
                backtestRunReportRepository,
                userStrategyRepository,
                contextSnapshotRepository
        );
        objectMapper = new ObjectMapper();
        user = User.builder().id(UUID.randomUUID()).email("diag@test.com").build();
        when(currentUserService.getCurrentUser()).thenReturn(user);
    }

    @Test
    void strategyDetailAggregatesCoreMetricsAndTriggerImpact() {
        UUID strategyId = UUID.randomUUID();
        UUID snapshotWinId = UUID.randomUUID();
        UUID snapshotLossId = UUID.randomUUID();

        when(userStrategyRepository.findByUser_IdOrderByUpdatedAtDesc(user.getId()))
                .thenReturn(List.of(UserStrategy.builder()
                        .id(strategyId)
                        .user(user)
                        .name("London Sweep")
                        .model("Model")
                        .entryConditionsJson("[]")
                        .entryConditionsRich("<p></p>")
                        .invalidationLogic("x")
                        .tpFramework("x")
                        .build()));
        when(backtestRunRepository.findByUser_IdOrderByCreatedAtDesc(user.getId())).thenReturn(List.of());
        when(backtestTradeRepository.findByUser_IdOrderByCreatedAtAsc(user.getId())).thenReturn(List.of());

        Trade winTrade = Trade.builder()
                .id(UUID.randomUUID())
                .user(user)
                .strategyId(strategyId)
                .symbol("OANDA:EURUSD")
                .status(TradeStatus.CLOSED)
                .session(TradeSession.LONDON)
                .openedAt(OffsetDateTime.of(2026, 2, 10, 7, 0, 0, 0, ZoneOffset.UTC))
                .closedAt(OffsetDateTime.of(2026, 2, 10, 7, 30, 0, 0, ZoneOffset.UTC))
                .rMultiple(new BigDecimal("1.2000"))
                .contextSnapshotId(snapshotWinId)
                .build();
        Trade lossTrade = Trade.builder()
                .id(UUID.randomUUID())
                .user(user)
                .strategyId(strategyId)
                .symbol("OANDA:EURUSD")
                .status(TradeStatus.CLOSED)
                .session(TradeSession.LONDON)
                .openedAt(OffsetDateTime.of(2026, 2, 11, 8, 0, 0, 0, ZoneOffset.UTC))
                .closedAt(OffsetDateTime.of(2026, 2, 11, 8, 20, 0, 0, ZoneOffset.UTC))
                .rMultiple(new BigDecimal("-0.8000"))
                .contextSnapshotId(snapshotLossId)
                .build();
        when(tradeRepository.findByUserId(user.getId())).thenReturn(List.of(winTrade, lossTrade));

        ContextSnapshot winSnapshot = ContextSnapshot.builder()
                .id(snapshotWinId)
                .prereqsStatesJson(objectMapper.createArrayNode()
                        .add(objectMapper.createObjectNode().put("text", "MSS confirmed").put("required", true).put("completed", true)))
                .triggersStatesJson(objectMapper.createArrayNode())
                .build();
        ContextSnapshot lossSnapshot = ContextSnapshot.builder()
                .id(snapshotLossId)
                .prereqsStatesJson(objectMapper.createArrayNode()
                        .add(objectMapper.createObjectNode().put("text", "MSS confirmed").put("required", true).put("completed", false)))
                .triggersStatesJson(objectMapper.createArrayNode())
                .build();
        when(contextSnapshotRepository.findAllById(argThat(ids ->
                ids != null && StreamSupport.stream(ids.spliterator(), false).count() == 2)))
                .thenReturn(List.of(winSnapshot, lossSnapshot));

        var response = diagnosticsService.getStrategyDetail(strategyId, "LIVE", null, null, null, null, null);

        assertThat(response.getCoreMetrics().getSampleSize()).isEqualTo(2);
        assertThat(response.getCoreMetrics().getWinRate()).isEqualByComparingTo("50.0000");
        assertThat(response.getCoreMetrics().getExpectancyR()).isEqualByComparingTo("0.2000");
        assertThat(response.getTriggerImpact())
                .anyMatch(row ->
                        "MSS confirmed".equals(row.getTriggerKey())
                                && row.getCheckedCount() == 1
                                && row.getUncheckedCount() == 1
                                && row.getDeltaExpectancy().compareTo(BigDecimal.ZERO) > 0);
        assertThat(response.getSuggestions())
                .extracting(item -> item.getTitle())
                .contains("Promote MSS to required");
    }

    @Test
    void strategyDetailCountsClosedTradesEvenWhenRMultipleMissing() {
        UUID strategyId = UUID.randomUUID();

        when(userStrategyRepository.findByUser_IdOrderByUpdatedAtDesc(user.getId()))
                .thenReturn(List.of(UserStrategy.builder()
                        .id(strategyId)
                        .user(user)
                        .name("London Sweep")
                        .model("Model")
                        .entryConditionsJson("[]")
                        .entryConditionsRich("<p></p>")
                        .invalidationLogic("x")
                        .tpFramework("x")
                        .build()));
        when(backtestRunRepository.findByUser_IdOrderByCreatedAtDesc(user.getId())).thenReturn(List.of());
        when(backtestTradeRepository.findByUser_IdOrderByCreatedAtAsc(user.getId())).thenReturn(List.of());

        Trade closedWithoutR = Trade.builder()
                .id(UUID.randomUUID())
                .user(user)
                .strategyId(strategyId)
                .symbol("OANDA:EURUSD")
                .status(TradeStatus.CLOSED)
                .session(TradeSession.LONDON)
                .openedAt(OffsetDateTime.of(2026, 2, 12, 8, 0, 0, 0, ZoneOffset.UTC))
                .closedAt(OffsetDateTime.of(2026, 2, 12, 8, 20, 0, 0, ZoneOffset.UTC))
                .rMultiple(null)
                .build();
        when(tradeRepository.findByUserId(user.getId())).thenReturn(List.of(closedWithoutR));
        when(contextSnapshotRepository.findAllById(any())).thenReturn(List.of());

        var response = diagnosticsService.getStrategyDetail(strategyId, "LIVE", null, null, null, null, null);

        assertThat(response.getCoreMetrics().getSampleSize()).isEqualTo(1);
        assertThat(response.getCoreMetrics().getExpectancyR()).isEqualByComparingTo("0.0000");
    }

    @Test
    void liveSummaryOnlyCountsLiveTrades() {
        UUID strategyId = UUID.randomUUID();

        when(userStrategyRepository.findByUser_IdOrderByUpdatedAtDesc(user.getId()))
                .thenReturn(List.of(UserStrategy.builder()
                        .id(strategyId)
                        .user(user)
                        .name("London Sweep")
                        .model("Model")
                        .entryConditionsJson("[]")
                        .entryConditionsRich("<p></p>")
                        .invalidationLogic("x")
                        .tpFramework("x")
                        .build()));
        when(backtestRunRepository.findByUser_IdOrderByCreatedAtDesc(user.getId())).thenReturn(List.of());
        when(backtestTradeRepository.findByUser_IdOrderByCreatedAtAsc(user.getId())).thenReturn(List.of());

        Trade liveTrade = Trade.builder()
                .id(UUID.randomUUID())
                .user(user)
                .strategyId(strategyId)
                .symbol("EURUSD")
                .status(TradeStatus.CLOSED)
                .session(TradeSession.LONDON)
                .openedAt(OffsetDateTime.of(2026, 3, 4, 7, 0, 0, 0, ZoneOffset.UTC))
                .closedAt(OffsetDateTime.of(2026, 3, 4, 7, 30, 0, 0, ZoneOffset.UTC))
                .rMultiple(new BigDecimal("1.8000"))
                .build();
        when(tradeRepository.findByUserId(user.getId())).thenReturn(List.of(liveTrade));
        when(contextSnapshotRepository.findAllById(any())).thenReturn(List.of());

        var response = diagnosticsService.getLiveSummary(null, null, null, null);

        assertThat(response.getCoreMetrics().getSampleSize()).isEqualTo(1);
        assertThat(response.getStrategyPerformance()).extracting(item -> item.getStrategyName()).contains("London Sweep");
        assertThat(response.getBreakdownBySession()).extracting(item -> item.getKey()).contains("LONDON");
    }
}
