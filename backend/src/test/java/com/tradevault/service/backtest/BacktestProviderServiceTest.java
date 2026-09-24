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
        backtestProviderService = new BacktestProviderService(credentialRepository, tokenCipherService, oandaCandleProvider, new com.fasterxml.jackson.databind.ObjectMapper());
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
}
