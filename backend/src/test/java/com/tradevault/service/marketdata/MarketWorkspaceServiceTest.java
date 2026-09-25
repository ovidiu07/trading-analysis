package com.tradevault.service.marketdata;

import com.tradevault.domain.entity.Account;
import com.tradevault.dto.market.MarketWorkspaceResponse;
import com.tradevault.dto.market.MarketWorkspaceResponse.AvailabilityReason;
import com.tradevault.repository.AccountRepository;
import com.tradevault.service.backtest.BacktestProviderService;
import com.tradevault.service.backtest.OandaCandleProvider;
import com.tradevault.service.backtest.OandaEnvironment;
import com.tradevault.service.backtest.BacktestRateLimiterService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class MarketWorkspaceServiceTest {
    private AccountRepository accounts;
    private BacktestProviderService providers;
    private OandaCandleProvider oanda;
    private TreasuryYieldProvider treasury;
    private MarketAnalysisService analysis;
    private BacktestRateLimiterService rateLimiter;
    private MarketWorkspaceService service;
    private UUID userId;
    private UUID accountId;

    @BeforeEach
    void setup() {
        accounts = mock(AccountRepository.class);
        providers = mock(BacktestProviderService.class);
        oanda = mock(OandaCandleProvider.class);
        treasury = mock(TreasuryYieldProvider.class);
        analysis = mock(MarketAnalysisService.class);
        rateLimiter = mock(BacktestRateLimiterService.class);
        when(treasury.latest()).thenReturn(List.of());
        service = new MarketWorkspaceService(accounts, providers, oanda, treasury, analysis, rateLimiter);
        userId = UUID.randomUUID();
        accountId = UUID.randomUUID();
        when(accounts.findByIdAndUserId(accountId, userId)).thenReturn(Optional.of(mock(Account.class)));
        when(providers.marketConnection(eq(userId), anyBoolean())).thenReturn(connection("v1"));
        ReflectionTestUtils.setField(service, "cacheTtlMs", 1200L);
    }

    @Test
    void defaultGateKeepsConnectedDataUnavailableUntilDisplayRightsAreEnabled() {
        var response = service.snapshot(userId, accountId, "GER40");
        assertThat(response.selectedInstrument()).isEqualTo("GER40");
        assertThat(response.quotes()).hasSize(8);
        assertThat(response.quotes().stream().filter(q -> !List.of("DXY", "ES").contains(q.canonicalInstrument()))).allSatisfy(q -> {
            assertThat(q.mid()).isNull();
            assertThat(q.availabilityReason()).isEqualTo(AvailabilityReason.LICENSE_REQUIRED);
        });
        verifyNoInteractions(oanda);
    }

    @Test
    void batchesOnlyDiscoveredSymbolsAndKeepsUnsupportedSymbolsVisible() {
        ReflectionTestUtils.setField(service, "displayAuthorized", true);
        OffsetDateTime observed = OffsetDateTime.now(ZoneOffset.UTC);
        when(oanda.getQuotes("opaque-test-token", "account-reference", OandaEnvironment.LIVE, List.of("DE30_EUR", "GBP_USD")))
                .thenReturn(Map.of(
                        "GBP_USD", new OandaCandleProvider.OandaQuote("GBP_USD", new BigDecimal("1.2500"), new BigDecimal("1.2502"), observed, true),
                        "DE30_EUR", new OandaCandleProvider.OandaQuote("DE30_EUR", new BigDecimal("18000"), new BigDecimal("18002"), observed, true)));

        MarketWorkspaceResponse response = service.snapshot(userId, accountId, "GER40");
        var gbp = response.quotes().stream().filter(q -> q.canonicalInstrument().equals("GBPUSD")).findFirst().orElseThrow();
        var ger = response.quotes().stream().filter(q -> q.canonicalInstrument().equals("GER40")).findFirst().orElseThrow();
        var es = response.quotes().stream().filter(q -> q.canonicalInstrument().equals("ES")).findFirst().orElseThrow();
        var dxy = response.quotes().stream().filter(q -> q.canonicalInstrument().equals("DXY")).findFirst().orElseThrow();
        assertThat(gbp.mid()).isEqualByComparingTo("1.2501");
        assertThat(ger.mid()).isEqualByComparingTo("18001");
        assertThat(ger.providerSymbol()).isEqualTo("DE30_EUR");
        assertThat(es.availabilityReason()).isEqualTo(AvailabilityReason.SYMBOL_NOT_SUPPORTED);
        assertThat(dxy.availabilityReason()).isEqualTo(AvailabilityReason.SYMBOL_NOT_SUPPORTED);
        verify(oanda, times(1)).getQuotes("opaque-test-token", "account-reference", OandaEnvironment.LIVE, List.of("DE30_EUR", "GBP_USD"));
    }

    @Test
    void accountMustBelongToRequestingUser() {
        when(accounts.findByIdAndUserId(accountId, userId)).thenReturn(Optional.empty());
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.snapshot(userId, accountId, "GER40"))
                .hasMessageContaining("Trading account not found");
        verifyNoInteractions(providers);
    }
    private BacktestProviderService.OandaMarketConnection connection(String version) {
        return new BacktestProviderService.OandaMarketConnection("opaque-test-token", "account-reference", OandaEnvironment.LIVE,
                List.of("GBP_USD", "DE30_EUR"), version);
    }

    private void quotes(OffsetDateTime observed) {
        ReflectionTestUtils.setField(service, "displayAuthorized", true);
        when(oanda.getQuotes(anyString(), anyString(), any(), anyList())).thenReturn(Map.of(
            "GBP_USD", new OandaCandleProvider.OandaQuote("GBP_USD", new BigDecimal("1.25"), new BigDecimal("1.26"), observed, true)));
    }

    @Test void cachesBatchAcrossSelectionsButAlwaysComposesAnalysis() {
        quotes(OffsetDateTime.now(ZoneOffset.UTC));
        var marker = new com.tradevault.service.marketdata.MarketAnalysisService(oanda)
                .unavailable("GBPUSD", "GBP_USD", OffsetDateTime.now(), AvailabilityReason.LICENSE_REQUIRED);
        when(analysis.unavailable(eq("GBPUSD"), anyString(), any(), any())).thenReturn(marker);
        service.snapshot(userId, accountId, "GER40");
        var second = service.snapshot(userId, accountId, "GBPUSD");
        assertThat(second.analysis()).isSameAs(marker);
        verify(oanda, times(1)).getQuotes(anyString(), anyString(), any(), anyList());
        verify(analysis, never()).analyze(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test void marksOldPricesStaleAndMissingRowsAsNoQuoteNotMarketClosed() {
        quotes(OffsetDateTime.now().minusMinutes(1));
        var result = service.snapshot(userId, accountId, "GBPUSD");
        assertThat(result.quotes().get(0).freshness()).isEqualTo(MarketWorkspaceResponse.Freshness.STALE);
        assertThat(result.quotes().get(2).availabilityReason()).isEqualTo(AvailabilityReason.NO_QUOTE);
    }

    @Test void disconnectAndReconnectionNeverReuseOldQuotes() {
        quotes(OffsetDateTime.now());
        service.snapshot(userId, accountId, "GBPUSD");
        when(providers.marketConnection(eq(userId), anyBoolean())).thenThrow(com.tradevault.exception.ProviderNotConnectedException.oandaNoCredentials());
        assertThat(service.snapshot(userId, accountId, "GBPUSD").quotes().get(0).mid()).isNull();
        when(providers.marketConnection(eq(userId), anyBoolean())).thenReturn(connection("v2"));
        service.snapshot(userId, accountId, "GBPUSD");
        verify(oanda, times(2)).getQuotes(anyString(), anyString(), any(), anyList());
    }

    @Test void usersWithSameProviderAccountNeverShareBatches() {
        quotes(OffsetDateTime.now());
        UUID secondUser = UUID.randomUUID();
        when(accounts.findByIdAndUserId(accountId, secondUser)).thenReturn(Optional.of(mock(Account.class)));
        when(providers.marketConnection(eq(secondUser), anyBoolean())).thenReturn(
            new BacktestProviderService.OandaMarketConnection("second-token", "account-reference", OandaEnvironment.LIVE,
                List.of("GBP_USD"), "v1"));
        service.snapshot(userId, accountId, "GBPUSD");
        service.snapshot(secondUser, accountId, "GBPUSD");
        verify(oanda).getQuotes(eq("second-token"), anyString(), any(), eq(List.of("GBP_USD")));
        verify(oanda, times(2)).getQuotes(anyString(), anyString(), any(), anyList());
    }

    @Test void emptyCapabilitiesNeverFetchAndUnsupportedInstrumentsStayExplicit() {
        ReflectionTestUtils.setField(service, "displayAuthorized", true);
        when(providers.marketConnection(eq(userId), anyBoolean())).thenReturn(
            new BacktestProviderService.OandaMarketConnection("opaque-test-token", "account-reference", OandaEnvironment.LIVE,
                List.of("SPX500_USD", "US30_USD"), "v1"));
        assertThat(service.snapshot(userId, accountId, "ES").quotes()).allSatisfy(q ->
            assertThat(q.availabilityReason()).isEqualTo(AvailabilityReason.SYMBOL_NOT_SUPPORTED));
        verifyNoInteractions(oanda);
    }

    @Test void rejectedTokenClearsValuesAndRateLimitHasCooldown() {
        quotes(OffsetDateTime.now());
        when(oanda.getQuotes(anyString(), anyString(), any(), anyList())).thenThrow(
            new com.tradevault.exception.BacktestDomainException("RATE_LIMITED", "limited", "wait", org.springframework.http.HttpStatus.TOO_MANY_REQUESTS));
        assertThat(service.snapshot(userId, accountId, "GBPUSD").quotes().get(0).availabilityReason()).isEqualTo(AvailabilityReason.RATE_LIMIT);
        service.snapshot(userId, accountId, "GER40");
        verify(oanda, times(1)).getQuotes(anyString(), anyString(), any(), anyList());
        when(providers.marketConnection(eq(userId), anyBoolean())).thenReturn(connection("new"));
        doThrow(new com.tradevault.exception.BacktestDomainException("AUTH", "rejected", "reconnect", org.springframework.http.HttpStatus.FORBIDDEN))
            .when(oanda).getQuotes(anyString(), anyString(), any(), anyList());
        var q = service.snapshot(userId, accountId, "GBPUSD").quotes().get(0);
        assertThat(q.availabilityReason()).isEqualTo(AvailabilityReason.PROVIDER_DISCONNECTED);
        assertThat(q.mid()).isNull();
    }

    @Test void rejectsFutureAndCrossedQuotes() {
        quotes(OffsetDateTime.now().plusMinutes(1));
        assertThat(service.snapshot(userId, accountId, "GBPUSD").quotes().get(0).availabilityReason()).isEqualTo(AvailabilityReason.NO_QUOTE);
    }

    @Test void candlePermissionAloneCannotBypassDisplayGate() {
        ReflectionTestUtils.setField(service, "candleDerivationsEnabled", true);
        assertThat(service.snapshot(userId, accountId, "GBPUSD").quotes().get(0).mid()).isNull();
        verify(providers).marketConnection(userId, false);
        verifyNoInteractions(oanda);
        verify(analysis, never()).analyze(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test void cachedQuotesAgeAndCannotEnterCalculationsAfterTheyBecomeStale() {
        OffsetDateTime observed = OffsetDateTime.now(ZoneOffset.UTC);
        quotes(observed);
        ReflectionTestUtils.setField(service, "cacheTtlMs", 5000L);
        ReflectionTestUtils.setField(service, "candleDerivationsEnabled", true);
        ReflectionTestUtils.setField(service, "clock", java.time.Clock.fixed(observed.plusSeconds(14).toInstant(), ZoneOffset.UTC));
        assertThat(service.snapshot(userId, accountId, "GBPUSD").quotes().get(0).freshness())
            .isEqualTo(MarketWorkspaceResponse.Freshness.LIVE);
        clearInvocations(analysis);
        ReflectionTestUtils.setField(service, "clock", java.time.Clock.fixed(observed.plusSeconds(16).toInstant(), ZoneOffset.UTC));
        assertThat(service.snapshot(userId, accountId, "GBPUSD").quotes().get(0).freshness())
            .isEqualTo(MarketWorkspaceResponse.Freshness.STALE);
        verify(oanda, times(1)).getQuotes(anyString(), anyString(), any(), anyList());
        verify(analysis, never()).analyze(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test void changingEnvironmentOrWorkspaceAccountNeverReusesBatch() {
        quotes(OffsetDateTime.now());
        service.snapshot(userId, accountId, "GBPUSD");
        when(providers.marketConnection(userId, true)).thenReturn(new BacktestProviderService.OandaMarketConnection(
            "practice-token", "account-reference", OandaEnvironment.PRACTICE, List.of("GBP_USD", "DE30_EUR"), "v1"));
        service.snapshot(userId, accountId, "GBPUSD");
        UUID otherAccount = UUID.randomUUID();
        when(accounts.findByIdAndUserId(otherAccount, userId)).thenReturn(Optional.of(mock(Account.class)));
        service.snapshot(userId, otherAccount, "GBPUSD");
        verify(oanda, times(3)).getQuotes(anyString(), anyString(), any(), anyList());
    }

}
