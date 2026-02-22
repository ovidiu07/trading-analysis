package com.tradevault.service.backtest;

import com.tradevault.domain.entity.BacktestProviderCredential;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.dto.backtest.ProviderConnectionStatusResponse;
import com.tradevault.exception.BacktestDomainException;
import com.tradevault.exception.BacktestErrorCodes;
import com.tradevault.repository.BacktestProviderCredentialRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BacktestProviderService {
    private final BacktestProviderCredentialRepository credentialRepository;
    private final BacktestTokenCipherService tokenCipherService;
    private final OandaCandleProvider oandaCandleProvider;

    @Transactional(readOnly = true)
    public ProviderConnectionStatusResponse getOandaStatus(UUID userId) {
        return credentialRepository.findByUser_IdAndProvider(userId, BacktestCandleSource.OANDA)
                .map(this::toResponse)
                .orElseGet(() -> ProviderConnectionStatusResponse.builder()
                        .provider(BacktestCandleSource.OANDA.name())
                        .connected(false)
                        .build());
    }

    @Transactional
    public ProviderConnectionStatusResponse connectOanda(User user, String token) {
        OandaCandleProvider.OandaConnectionResult check = oandaCandleProvider.testConnection(token);
        BacktestTokenCipherService.EncryptedToken encrypted = tokenCipherService.encrypt(token);

        BacktestProviderCredential credential = credentialRepository
                .findByUser_IdAndProvider(user.getId(), BacktestCandleSource.OANDA)
                .orElseGet(() -> BacktestProviderCredential.builder()
                        .user(user)
                        .provider(BacktestCandleSource.OANDA)
                        .build());

        credential.setEncryptedToken(encrypted.encryptedToken());
        credential.setTokenIv(encrypted.iv());
        credential.setProviderAccountId(normalizeOptionalText(check.accountId()));
        credential.setLastTestedAt(OffsetDateTime.now(ZoneOffset.UTC));

        return toResponse(credentialRepository.save(credential));
    }

    @Transactional(readOnly = true)
    public ProviderConnectionStatusResponse testOanda(String token) {
        OandaCandleProvider.OandaConnectionResult check = oandaCandleProvider.testConnection(token);
        return ProviderConnectionStatusResponse.builder()
                .provider(BacktestCandleSource.OANDA.name())
                .connected(check.connected())
                .accountId(normalizeOptionalText(check.accountId()))
                .lastTestedAt(OffsetDateTime.now(ZoneOffset.UTC))
                .build();
    }

    @Transactional
    public void disconnectOanda(UUID userId) {
        credentialRepository.deleteByUser_IdAndProvider(userId, BacktestCandleSource.OANDA);
    }

    @Transactional(readOnly = true)
    public String requireOandaToken(UUID userId) {
        BacktestProviderCredential credential = credentialRepository.findByUser_IdAndProvider(userId, BacktestCandleSource.OANDA)
                .orElseThrow(() -> new BacktestDomainException(
                        BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED,
                        "OANDA provider is not connected",
                        "Connect OANDA from Settings -> Data Providers before loading candles.",
                        HttpStatus.FORBIDDEN
                ));
        return tokenCipherService.decrypt(credential.getTokenIv(), credential.getEncryptedToken());
    }

    @Transactional(readOnly = true)
    public String resolveOandaSourceId(UUID userId) {
        Optional<BacktestProviderCredential> credential = credentialRepository.findByUser_IdAndProvider(userId, BacktestCandleSource.OANDA);
        return credential
                .map(BacktestProviderCredential::getProviderAccountId)
                .map(this::normalizeOptionalText)
                .orElse(null);
    }

    private ProviderConnectionStatusResponse toResponse(BacktestProviderCredential credential) {
        return ProviderConnectionStatusResponse.builder()
                .provider(credential.getProvider().name())
                .connected(true)
                .accountId(normalizeOptionalText(credential.getProviderAccountId()))
                .lastTestedAt(credential.getLastTestedAt())
                .build();
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.isBlank()) {
            return null;
        }
        return normalized;
    }
}
