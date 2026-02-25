package com.tradevault.service.backtest;

import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.exception.BacktestErrorCodes;
import com.tradevault.exception.ProviderNotConnectedException;
import com.tradevault.repository.BacktestProviderCredentialRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

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
        backtestProviderService = new BacktestProviderService(credentialRepository, tokenCipherService, oandaCandleProvider);
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
}
