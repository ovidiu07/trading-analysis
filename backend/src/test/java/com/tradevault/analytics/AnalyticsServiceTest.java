package com.tradevault.analytics;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.analytics.AnalyticsResponse;
import com.tradevault.repository.TradeRepository;
import com.tradevault.service.CurrentUserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

public class AnalyticsServiceTest {

    private TradeRepository tradeRepository;
    private CurrentUserService currentUserService;
    private AnalyticsService analyticsService;

    @BeforeEach
    void setup() {
        tradeRepository = Mockito.mock(TradeRepository.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        analyticsService = new AnalyticsService(tradeRepository, currentUserService);
        User user = User.builder().id(UUID.randomUUID()).email("test@example.com").build();
        when(currentUserService.getCurrentUser()).thenReturn(user);
    }


    private Trade trade(BigDecimal pnl, BigDecimal pnlGross, OffsetDateTime closedAt) {
        Trade trade = new Trade();
        trade.setPnlNet(pnl);
        trade.setPnlGross(pnlGross);
        trade.setClosedAt(closedAt);
        trade.setOpenedAt(closedAt.minusHours(1));
        trade.setStatus(TradeStatus.CLOSED);
        trade.setDirection(Direction.LONG);
        trade.setMarket(Market.STOCK);
        trade.setQuantity(BigDecimal.ONE);
        trade.setEntryPrice(BigDecimal.ONE);
        trade.setExitPrice(BigDecimal.ONE);
        trade.setSymbol("AAPL");
        return trade;
    }
}
