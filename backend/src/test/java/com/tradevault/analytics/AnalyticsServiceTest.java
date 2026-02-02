package com.tradevault.analytics;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.analytics.AnalyticsResponse;
import com.tradevault.repository.TradeRepository;
import com.tradevault.service.CurrentUserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

class AnalyticsServiceTest {

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

    @Test
    void summarizeComputesCoreMetricsFromFixture() throws IOException {
        List<Trade> trades = loadFixtureTrades();
        when(tradeRepository.findByUserId(Mockito.any())).thenReturn(trades);

        AnalyticsResponse response = analyticsService.summarize(
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
                false,
                null
        );

        List<Trade> closedTrades = trades.stream()
                .filter(t -> t.getStatus() == TradeStatus.CLOSED && t.getClosedAt() != null)
                .toList();
        BigDecimal expectedNet = closedTrades.stream()
                .map(t -> t.getPnlNet() == null ? BigDecimal.ZERO : t.getPnlNet())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long wins = closedTrades.stream().filter(t -> t.getPnlNet() != null && t.getPnlNet().compareTo(BigDecimal.ZERO) > 0).count();
        long losses = closedTrades.stream().filter(t -> t.getPnlNet() != null && t.getPnlNet().compareTo(BigDecimal.ZERO) < 0).count();

        assertEquals(expectedNet.setScale(2, RoundingMode.HALF_UP), response.getKpi().getTotalPnlNet().setScale(2, RoundingMode.HALF_UP));
        assertEquals(closedTrades.size(), response.getKpi().getTotalTrades());
        assertEquals((int) wins, response.getKpi().getWinningTrades());
        assertEquals((int) losses, response.getKpi().getLosingTrades());
        assertTrue(response.getDrawdown().getMaxDrawdown().compareTo(BigDecimal.ZERO) >= 0);
        assertNotNull(response.getDistribution().getP50());
    }

    private List<Trade> loadFixtureTrades() throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        try (InputStream input = getClass().getClassLoader().getResourceAsStream("trades-database.json")) {
            assertNotNull(input, "Fixture file trades-database.json is missing");
            List<FixtureTrade> fixtures = mapper.readValue(input, new TypeReference<>() {});
            return fixtures.stream().map(this::mapFixture).toList();
        }
    }

    private Trade mapFixture(FixtureTrade fixture) {
        Trade trade = new Trade();
        trade.setSymbol(fixture.code);
        trade.setDirection("sell".equalsIgnoreCase(fixture.direction) ? Direction.SHORT : Direction.LONG);
        trade.setStatus("closed".equalsIgnoreCase(fixture.eventType) ? TradeStatus.CLOSED : TradeStatus.OPEN);
        trade.setOpenedAt(parseDate(fixture.openingTime));
        trade.setClosedAt(parseDate(fixture.time));
        trade.setPnlNet(parseDecimal(fixture.resultNet));
        trade.setPnlGross(parseDecimal(fixture.resultGross));
        trade.setFees(parseDecimal(fixture.fxFee));
        return trade;
    }

    private OffsetDateTime parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return OffsetDateTime.parse(value);
    }

    private BigDecimal parseDecimal(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return new BigDecimal(value);
    }

    private static class FixtureTrade {
        public String direction;
        public String code;
        public String resultNet;
        public String resultGross;
        public String time;
        public String openingTime;
        public String eventType;
        public String fxFee;
    }
}
