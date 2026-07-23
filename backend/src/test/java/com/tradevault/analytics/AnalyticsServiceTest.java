package com.tradevault.analytics;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.analytics.AnalyticsResponse;
import com.tradevault.repository.TradeRepository;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.account.AccountScopeService;
import com.tradevault.service.account.AuthorizedAccountScope;
import org.springframework.data.jpa.domain.Specification;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.when;

class AnalyticsServiceTest {

    private TradeRepository tradeRepository;
    private CurrentUserService currentUserService;
    private AnalyticsService analyticsService;
    private AccountScopeService accountScopeService;

    @BeforeEach
    void setup() {
        tradeRepository = Mockito.mock(TradeRepository.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        accountScopeService = Mockito.mock(AccountScopeService.class);
        analyticsService = new AnalyticsService(tradeRepository, currentUserService, accountScopeService);
        User user = User.builder().id(UUID.randomUUID()).email("test@example.com").build();
        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(accountScopeService.resolve(Mockito.any(), Mockito.any()))
                .thenReturn(new AuthorizedAccountScope(user.getId(), AuthorizedAccountScope.Mode.ALL, Set.of(), List.of()));
        when(tradeRepository.findTradeIdsWithLinkedContentForUser(Mockito.any(), Mockito.anyCollection())).thenReturn(Set.of());
    }

    @Test
    void summarizeComputesCoreMetricsFromTrades() {
        List<Trade> trades = List.of(
                buildTrade(UUID.randomUUID(), "AAPL", Direction.LONG, TradeStatus.CLOSED, "2026-01-02T10:00:00Z", "2026-01-02T10:10:00Z", "125.50"),
                buildTrade(UUID.randomUUID(), "MSFT", Direction.SHORT, TradeStatus.CLOSED, "2026-01-03T09:00:00Z", "2026-01-03T10:00:00Z", "-20.00"),
                buildTrade(UUID.randomUUID(), "NVDA", Direction.LONG, TradeStatus.OPEN, "2026-01-04T09:00:00Z", null, null)
        );
        when(tradeRepository.findAll(Mockito.any(Specification.class))).thenReturn(trades);

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

    @Test
    void summarizeBuildsPlanAdherenceFromRepositoryLinkedIds() {
        UUID linkedTradeId = UUID.randomUUID();
        UUID unlinkedTradeId = UUID.randomUUID();

        Trade linkedTrade = new Trade();
        linkedTrade.setId(linkedTradeId);
        linkedTrade.setStatus(TradeStatus.CLOSED);
        linkedTrade.setClosedAt(OffsetDateTime.parse("2026-01-02T10:10:00Z"));
        linkedTrade.setPnlNet(new BigDecimal("100.00"));
        linkedTrade.setLinkedContentIds(null);

        Trade unlinkedTrade = new Trade();
        unlinkedTrade.setId(unlinkedTradeId);
        unlinkedTrade.setStatus(TradeStatus.CLOSED);
        unlinkedTrade.setClosedAt(OffsetDateTime.parse("2026-01-02T11:10:00Z"));
        unlinkedTrade.setPnlNet(new BigDecimal("-20.00"));
        unlinkedTrade.setLinkedContentIds(null);

        when(tradeRepository.findAll(Mockito.any(Specification.class))).thenReturn(List.of(linkedTrade, unlinkedTrade));
        when(tradeRepository.findTradeIdsWithLinkedContentForUser(Mockito.any(), Mockito.anyCollection()))
                .thenReturn(Set.of(linkedTradeId));

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
                null,
                "CLOSE",
                false,
                null
        );

        assertEquals(1, response.getPlanAdherence().getLinkedTrades());
        assertEquals(1, response.getPlanAdherence().getUnlinkedTrades());
        assertEquals(0, response.getPlanAdherence().getLinkedNetPnl().compareTo(new BigDecimal("100.00")));
        assertEquals(0, response.getPlanAdherence().getUnlinkedNetPnl().compareTo(new BigDecimal("-20.00")));
    }

    @Test
    void summarizeUsesRepositoryScopedTradesForInternalAccount() {
        Trade accountOne = buildTrade(UUID.randomUUID(), "AAPL", Direction.LONG, TradeStatus.CLOSED, "2026-01-02T10:00:00Z", "2026-01-02T10:10:00Z", "125.50");
        accountOne.setBrokerAccountId("APEX4855840000003");
        Trade accountTwo = buildTrade(UUID.randomUUID(), "MSFT", Direction.SHORT, TradeStatus.CLOSED, "2026-01-03T09:00:00Z", "2026-01-03T10:00:00Z", "-20.00");
        accountTwo.setBrokerAccountId("APEX4855840000004");
        when(tradeRepository.findAll(Mockito.any(Specification.class))).thenReturn(List.of(accountOne));

        AnalyticsResponse response = analyticsService.summarize(
                null,
                null,
                null,
                null,
                null,
                UUID.randomUUID().toString(),
                null,
                null,
                null,
                null,
                "CLOSE",
                false,
                null
        );

        assertEquals(1, response.getKpi().getTotalTrades());
        assertEquals(0, response.getKpi().getTotalPnlNet().compareTo(new BigDecimal("125.50")));
    }

    @Test
    void summarizeMarksMixedAccountCurrenciesAsUnsafeForMonetaryAggregation() {
        User user = currentUserService.getCurrentUser();
        UUID usdAccountId = UUID.randomUUID();
        UUID eurAccountId = UUID.randomUUID();
        when(accountScopeService.resolve(Mockito.any(), Mockito.any())).thenReturn(new AuthorizedAccountScope(
                user.getId(),
                AuthorizedAccountScope.Mode.SELECTED,
                Set.of(usdAccountId, eurAccountId),
                List.of(
                        Account.builder().id(usdAccountId).name("USD account").accountCurrency("USD").build(),
                        Account.builder().id(eurAccountId).name("EUR account").accountCurrency("EUR").build()
                )
        ));
        when(tradeRepository.findAll(Mockito.any(Specification.class))).thenReturn(List.of());

        AnalyticsResponse response = analyticsService.summarize(
                null, null, null, null, null, null, null, null, null, null,
                "CLOSE", false, null
        );

        assertFalse(response.getAccountScope().isMonetaryAnalyticsAvailable());
        assertEquals(List.of("EUR", "USD"), response.getAccountScope().getReportingCurrencies());
        assertEquals(null, response.getAccountScope().getReportingCurrency());
    }

    private Trade buildTrade(UUID id, String symbol, Direction direction, TradeStatus status, String openedAt, String closedAt, String pnlNet) {
        Trade trade = new Trade();
        trade.setId(id);
        trade.setSymbol(symbol);
        trade.setDirection(direction);
        trade.setStatus(status);
        trade.setOpenedAt(parseDate(openedAt));
        trade.setClosedAt(parseDate(closedAt));
        trade.setPnlNet(parseDecimal(pnlNet));
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
}
