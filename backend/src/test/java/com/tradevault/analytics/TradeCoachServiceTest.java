package com.tradevault.analytics;

import com.tradevault.config.TradeCoachConfig;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.analytics.CoachResponse;
import com.tradevault.repository.TradeRepository;
import com.tradevault.service.CurrentUserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

class TradeCoachServiceTest {

    private TradeRepository tradeRepository;
    private CurrentUserService currentUserService;
    private TradeCoachService tradeCoachService;

    @BeforeEach
    void setup() {
        tradeRepository = Mockito.mock(TradeRepository.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        TradeCoachConfig config = new TradeCoachConfig();
        tradeCoachService = new TradeCoachService(tradeRepository, currentUserService, config);
        User user = User.builder().id(UUID.randomUUID()).email("test@example.com").build();
        when(currentUserService.getCurrentUser()).thenReturn(user);
    }

    @Test
    void coachBuildsRuleBasedAdvice() {
        List<Trade> trades = buildTrades();
        when(tradeRepository.findByUserId(Mockito.any())).thenReturn(trades);

        CoachResponse response = tradeCoachService.coach(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                "CLOSE",
                false
        );

        List<String> ids = response.getAdvice().stream().map(card -> card.getId()).toList();
        assertTrue(ids.stream().anyMatch(id -> id.startsWith("coach-hour-best")), "Expected best hour advice");
        assertTrue(ids.stream().anyMatch(id -> id.startsWith("coach-hour-worst")), "Expected worst hour advice");
        assertTrue(ids.stream().anyMatch(id -> id.startsWith("coach-symbol-focus")), "Expected symbol focus advice");
        assertTrue(ids.stream().anyMatch(id -> id.startsWith("coach-symbol-avoid")), "Expected symbol avoid advice");
        assertTrue(ids.stream().anyMatch(id -> id.startsWith("coach-holding-leak")), "Expected holding bucket advice");
        assertTrue(ids.contains("coach-data-quality"), "Expected data quality advice");
    }

    private List<Trade> buildTrades() {
        List<Trade> trades = new ArrayList<>();
        OffsetDateTime baseDate = OffsetDateTime.of(2024, 1, 10, 7, 0, 0, 0, ZoneOffset.ofHours(2));
        for (int i = 0; i < 12; i++) {
            trades.add(buildTrade("AAPL", Direction.LONG, TradeStatus.CLOSED,
                    baseDate.plusDays(i).withHour(8).withMinute(55),
                    baseDate.plusDays(i).withHour(9).withMinute(0),
                    BigDecimal.valueOf(120),
                    BigDecimal.valueOf(1)));
        }
        for (int i = 0; i < 12; i++) {
            trades.add(buildTrade("TSLA", Direction.SHORT, TradeStatus.CLOSED,
                    baseDate.plusDays(i).withHour(9).withMinute(0),
                    baseDate.plusDays(i).withHour(14).withMinute(0),
                    BigDecimal.valueOf(-140),
                    BigDecimal.valueOf(2)));
        }
        Trade incomplete = buildTrade("NFLX", Direction.LONG, TradeStatus.CLOSED,
                baseDate.plusDays(1).withHour(10),
                null,
                null,
                null);
        trades.add(incomplete);
        return trades;
    }

    private Trade buildTrade(String symbol,
                             Direction direction,
                             TradeStatus status,
                             OffsetDateTime openedAt,
                             OffsetDateTime closedAt,
                             BigDecimal pnlNet,
                             BigDecimal riskAmount) {
        Trade trade = new Trade();
        trade.setSymbol(symbol);
        trade.setDirection(direction);
        trade.setStatus(status);
        trade.setOpenedAt(openedAt);
        trade.setClosedAt(closedAt);
        trade.setPnlNet(pnlNet);
        trade.setRiskAmount(riskAmount);
        trade.setEntryPrice(BigDecimal.valueOf(100));
        trade.setExitPrice(BigDecimal.valueOf(101));
        trade.setQuantity(BigDecimal.ONE);
        trade.setFees(BigDecimal.valueOf(1));
        trade.setCommission(BigDecimal.valueOf(1));
        trade.setSlippage(BigDecimal.valueOf(0.5));
        return trade;
    }
}
