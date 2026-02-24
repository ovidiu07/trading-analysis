package com.tradevault.service;

import com.tradevault.domain.entity.User;
import com.tradevault.dto.session.LiveQuoteResponse;
import com.tradevault.exception.BacktestDomainException;
import com.tradevault.service.backtest.BacktestProviderService;
import com.tradevault.service.backtest.OandaCandleProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class QuoteServiceTest {
    private CurrentUserService currentUserService;
    private BacktestProviderService backtestProviderService;
    private OandaCandleProvider oandaCandleProvider;
    private QuoteService quoteService;

    private User user;

    @BeforeEach
    void setup() {
        currentUserService = Mockito.mock(CurrentUserService.class);
        backtestProviderService = Mockito.mock(BacktestProviderService.class);
        oandaCandleProvider = Mockito.mock(OandaCandleProvider.class);
        quoteService = new QuoteService(currentUserService, backtestProviderService, oandaCandleProvider);

        user = User.builder()
                .id(UUID.randomUUID())
                .email("quotes@example.com")
                .build();
        when(currentUserService.getCurrentUser()).thenReturn(user);
    }

    @Test
    void returnsUnavailableWhenProviderCannotResolveQuote() {
        when(backtestProviderService.requireOandaToken(user.getId())).thenReturn("token");
        when(backtestProviderService.resolveOandaSourceId(user.getId())).thenReturn("account");
        LiveQuoteResponse response = quoteService.getLiveQuote("TVC:DXY");

        assertFalse(response.isAvailable());
        assertEquals("Spread unavailable for this symbol", response.getReason());
        assertEquals("OANDA", response.getSource());
    }

    @Test
    void returnsBidAskMidAndSpreadForOandaQuote() {
        when(backtestProviderService.requireOandaToken(user.getId())).thenReturn("token");
        when(backtestProviderService.resolveOandaSourceId(user.getId())).thenReturn("101-001-1234567-001");
        when(oandaCandleProvider.getQuote("token", "101-001-1234567-001", "OANDA:EURUSD"))
                .thenReturn(new OandaCandleProvider.OandaQuote(
                        "EUR_USD",
                        BigDecimal.valueOf(1.08410),
                        BigDecimal.valueOf(1.08422),
                        OffsetDateTime.now(ZoneOffset.UTC)
                ));

        LiveQuoteResponse response = quoteService.getLiveQuote("oanda:eurusd");

        assertTrue(response.isAvailable());
        assertEquals("OANDA:EURUSD", response.getSymbol());
        assertEquals(BigDecimal.valueOf(1.08410000).setScale(8), response.getBid());
        assertEquals(BigDecimal.valueOf(1.08422000).setScale(8), response.getAsk());
        assertEquals(BigDecimal.valueOf(0.00012000).setScale(8), response.getSpread());
        assertEquals("OANDA", response.getSource());
        verify(oandaCandleProvider).getQuote("token", "101-001-1234567-001", "OANDA:EURUSD");
    }

    @Test
    void returnsUnavailableWhenProviderIsNotConnected() {
        when(backtestProviderService.requireOandaToken(user.getId()))
                .thenThrow(new BacktestDomainException(
                        "BACKTEST_PROVIDER_NOT_CONNECTED",
                        "OANDA provider is not connected",
                        "Connect OANDA first",
                        HttpStatus.FORBIDDEN
                ));

        LiveQuoteResponse response = quoteService.getLiveQuote("OANDA:EURUSD");

        assertFalse(response.isAvailable());
        assertEquals("OANDA provider is not connected", response.getReason());
    }
}
