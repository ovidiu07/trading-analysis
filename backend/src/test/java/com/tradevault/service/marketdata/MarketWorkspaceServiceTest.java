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
        when(providers.requireOandaToken(userId)).thenReturn("opaque-test-token");
        when(providers.resolveOandaSourceId(userId)).thenReturn("account-reference");
        when(providers.resolveOandaEnvironment(userId)).thenReturn(OandaEnvironment.LIVE);
        when(providers.resolveFreshOandaInstruments(userId)).thenReturn(List.of("GBP_USD", "DE30_EUR"));
        ReflectionTestUtils.setField(service, "cacheTtlMs", 1200L);
    }

    @Test
    void defaultGateKeepsConnectedDataUnavailableUntilDisplayRightsAreEnabled() {
        var response = service.snapshot(userId, accountId, "GER40");
        assertThat(response.selectedInstrument()).isEqualTo("GER40");
        assertThat(response.quotes()).hasSize(8);
        assertThat(response.quotes()).allSatisfy(q -> {
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
        verify(providers, never()).requireOandaToken(any());
    }
}
