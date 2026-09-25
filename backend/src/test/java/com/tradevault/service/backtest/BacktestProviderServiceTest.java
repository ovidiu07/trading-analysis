package com.tradevault.service.backtest;

import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.entity.User;
import com.tradevault.dto.backtest.ProviderConnectionStatusResponse;
import com.tradevault.exception.BacktestErrorCodes;
import com.tradevault.exception.ProviderNotConnectedException;
import com.tradevault.repository.BacktestProviderCredentialRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class BacktestProviderServiceTest {

    private BacktestProviderCredentialRepository credentialRepository;
    private BacktestTokenCipherService tokenCipherService;
    private OandaCandleProvider oandaCandleProvider;
    private BacktestProviderService backtestProviderService;

    @BeforeEach
    void setup() {
        credentialRepository = mock(BacktestProviderCredentialRepository.class);
        tokenCipherService = mock(BacktestTokenCipherService.class);
        oandaCandleProvider = mock(OandaCandleProvider.class);
        backtestProviderService = new BacktestProviderService(credentialRepository, tokenCipherService, oandaCandleProvider, new com.fasterxml.jackson.databind.ObjectMapper(), mock(BacktestRateLimiterService.class));
    }

    @Test
    void requireOandaTokenThrowsControlledErrorWhenDisconnected() {
        UUID userId = UUID.randomUUID();
        when(credentialRepository.findByUser_IdAndProvider(userId, BacktestCandleSource.OANDA)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> backtestProviderService.requireOandaToken(userId))
                .isInstanceOf(ProviderNotConnectedException.class)
                .hasMessageContaining("not connected")
                .extracting(
                        throwable -> ((ProviderNotConnectedException) throwable).getProvider(),
                        throwable -> ((ProviderNotConnectedException) throwable).getReason(),
                        throwable -> ((ProviderNotConnectedException) throwable).getCode()
                )
                .containsExactly("OANDA", "NO_CREDENTIALS", BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED);
    }

    @Test
    void testUsesSelectedEnvironmentAndNeverPersistsTheToken() {
        when(oandaCandleProvider.testConnection("never-return-this-token", OandaEnvironment.LIVE))
                .thenReturn(new OandaCandleProvider.OandaConnectionResult(true, "provider-account"));
        when(oandaCandleProvider.listInstruments("never-return-this-token", "provider-account", OandaEnvironment.LIVE))
                .thenReturn(List.of("EUR_USD"));

        ProviderConnectionStatusResponse result = backtestProviderService.testOanda("never-return-this-token", OandaEnvironment.LIVE);

        org.assertj.core.api.Assertions.assertThat(result.getEnvironment()).isEqualTo("LIVE");
        org.assertj.core.api.Assertions.assertThat(result.getSupportedInstruments()).containsExactly("EUR_USD");
        verifyNoInteractions(tokenCipherService);
        verify(credentialRepository, never()).save(any());
    }

    @Test
    void connectDoesNotEncryptOrPersistUntilAccountAndCapabilitiesValidate() {
        User user = mock(User.class);
        UUID userId = UUID.randomUUID();
        when(user.getId()).thenReturn(userId);
        when(oandaCandleProvider.testConnection("secret", OandaEnvironment.PRACTICE))
                .thenReturn(new OandaCandleProvider.OandaConnectionResult(true, "account"));
        when(oandaCandleProvider.listInstruments("secret", "account", OandaEnvironment.PRACTICE))
                .thenThrow(new IllegalStateException("capability endpoint failed"));

        assertThatThrownBy(() -> backtestProviderService.connectOanda(user, "secret", OandaEnvironment.PRACTICE))
                .hasMessageContaining("capability endpoint failed");
        verifyNoInteractions(tokenCipherService);
        verify(credentialRepository, never()).save(any());
    }
    private com.tradevault.domain.entity.BacktestProviderCredential stored(UUID userId, java.time.OffsetDateTime refreshed) {
        var credential = com.tradevault.domain.entity.BacktestProviderCredential.builder()
            .id(UUID.randomUUID()).provider(BacktestCandleSource.OANDA).providerAccountId("exact-account")
            .environment(OandaEnvironment.LIVE).encryptedToken(new byte[]{1,2,3}).tokenIv(new byte[]{4,5,6})
            .instrumentCapabilities(new com.fasterxml.jackson.databind.ObjectMapper().valueToTree(List.of("DE30_EUR")))
            .instrumentCapabilitiesRefreshedAt(refreshed).build();
        when(credentialRepository.findByUser_IdAndProvider(userId, BacktestCandleSource.OANDA)).thenReturn(Optional.of(credential));
        when(tokenCipherService.decrypt(credential.getTokenIv(), credential.getEncryptedToken())).thenReturn("private-token");
        return credential;
    }

    @Test void disabledDisplayDoesNotDecryptOrDiscover() {
        UUID id = UUID.randomUUID();
        stored(id, null);
        var snapshot = backtestProviderService.marketConnection(id, false);
        org.assertj.core.api.Assertions.assertThat(snapshot.token()).isNull();
        org.assertj.core.api.Assertions.assertThat(snapshot.instruments()).isEmpty();
        verifyNoInteractions(oandaCandleProvider);
        verify(tokenCipherService, never()).decrypt(any(), any());
    }

    @Test void usesOnlyFreshCapabilitiesFromTheSameCredentialSnapshot() {
        UUID id = UUID.randomUUID();
        stored(id, java.time.OffsetDateTime.now().minusHours(1));
        var snapshot = backtestProviderService.marketConnection(id, true);
        org.assertj.core.api.Assertions.assertThat(snapshot.accountId()).isEqualTo("exact-account");
        org.assertj.core.api.Assertions.assertThat(snapshot.environment()).isEqualTo(OandaEnvironment.LIVE);
        org.assertj.core.api.Assertions.assertThat(snapshot.instruments()).containsExactly("DE30_EUR");
        org.assertj.core.api.Assertions.assertThat(snapshot.toString()).doesNotContain("private-token", "exact-account");
        verifyNoInteractions(oandaCandleProvider);
        verify(credentialRepository, times(1)).findByUser_IdAndProvider(id, BacktestCandleSource.OANDA);
    }

    @Test void staleDiscoveryIsUserScopedCachedAndReadOnly() {
        UUID first = UUID.randomUUID(), second = UUID.randomUUID();
        stored(first, java.time.OffsetDateTime.now().minusDays(2));
        stored(second, java.time.OffsetDateTime.now().minusDays(2));
        when(oandaCandleProvider.listInstruments("private-token", "exact-account", OandaEnvironment.LIVE)).thenReturn(List.of("GBP_USD"));
        org.assertj.core.api.Assertions.assertThat(backtestProviderService.marketConnection(first, true).instruments()).containsExactly("GBP_USD");
        backtestProviderService.marketConnection(first, true);
        backtestProviderService.marketConnection(second, true);
        verify(oandaCandleProvider, times(2)).listInstruments("private-token", "exact-account", OandaEnvironment.LIVE);
        verify(credentialRepository, never()).save(any());
    }

    @Test void failedDiscoveryNeverFallsBackToExpiredCapabilities() {
        UUID id = UUID.randomUUID();
        stored(id, java.time.OffsetDateTime.now().minusDays(2));
        when(oandaCandleProvider.listInstruments(any(), any(), any())).thenThrow(new IllegalStateException("offline"));
        assertThatThrownBy(() -> backtestProviderService.marketConnection(id, true)).hasMessage("offline");
        verify(credentialRepository, never()).save(any());
    }

}
