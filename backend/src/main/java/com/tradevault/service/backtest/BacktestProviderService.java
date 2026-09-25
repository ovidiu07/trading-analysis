package com.tradevault.service.backtest;

import com.tradevault.domain.entity.BacktestProviderCredential;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.dto.backtest.ProviderConnectionStatusResponse;
import com.tradevault.exception.ProviderNotConnectedException;
import com.tradevault.exception.BacktestDomainException;
import com.tradevault.exception.BacktestErrorCodes;
import com.tradevault.repository.BacktestProviderCredentialRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.List;
import java.util.UUID;
import java.time.Duration;

@Service
@RequiredArgsConstructor
public class BacktestProviderService {
    private final BacktestProviderCredentialRepository credentialRepository;
    private final BacktestTokenCipherService tokenCipherService;
    private final OandaCandleProvider oandaCandleProvider;
    private final ObjectMapper objectMapper;
    private final BacktestRateLimiterService rateLimiter;

    @Transactional(readOnly = true)
    public ProviderConnectionStatusResponse getOandaStatus(UUID userId) {
        return credentialRepository.findByUser_IdAndProvider(userId, BacktestCandleSource.OANDA)
                .map(this::toResponse)
                .orElseGet(() -> ProviderConnectionStatusResponse.builder()
                        .provider(BacktestCandleSource.OANDA.name())
                        .connected(false)
                        .build());
    }

    public ProviderConnectionStatusResponse connectOanda(User user, String token, OandaEnvironment environment) {
        OandaEnvironment resolvedEnvironment = environment == null ? OandaEnvironment.PRACTICE : environment;
        OandaCandleProvider.OandaConnectionResult check = oandaCandleProvider.testConnection(token, resolvedEnvironment);
        requireAccountId(check);
        List<String> instruments = oandaCandleProvider.listInstruments(token, check.accountId(), resolvedEnvironment);
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
        credential.setEnvironment(resolvedEnvironment);
        credential.setInstrumentCapabilities(objectMapper.valueToTree(instruments));
        credential.setInstrumentCapabilitiesRefreshedAt(OffsetDateTime.now(ZoneOffset.UTC));
        credential.setLastTestedAt(OffsetDateTime.now(ZoneOffset.UTC));

        return toResponse(credentialRepository.save(credential));
    }

    public ProviderConnectionStatusResponse testOanda(String token, OandaEnvironment environment) {
        OandaEnvironment resolvedEnvironment = environment == null ? OandaEnvironment.PRACTICE : environment;
        OandaCandleProvider.OandaConnectionResult check = oandaCandleProvider.testConnection(token, resolvedEnvironment);
        requireAccountId(check);
        List<String> instruments = oandaCandleProvider.listInstruments(token, check.accountId(), resolvedEnvironment);
        return ProviderConnectionStatusResponse.builder()
                .provider(BacktestCandleSource.OANDA.name())
                .connected(check.connected())
                .accountId(normalizeOptionalText(check.accountId()))
                .environment(resolvedEnvironment.name())
                .supportedInstruments(instruments)
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
                .orElseThrow(ProviderNotConnectedException::oandaNoCredentials);
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

    @Transactional(readOnly = true)
    public OandaEnvironment resolveOandaEnvironment(UUID userId) {
        return credentialRepository.findByUser_IdAndProvider(userId, BacktestCandleSource.OANDA)
                .map(BacktestProviderCredential::getEnvironment)
                .orElse(OandaEnvironment.PRACTICE);
    }

    @Transactional(readOnly = true)
    public List<String> resolveOandaInstruments(UUID userId) {
        return credentialRepository.findByUser_IdAndProvider(userId, BacktestCandleSource.OANDA)
                .map(BacktestProviderCredential::getInstrumentCapabilities)
                .map(this::resolveCapabilities).orElseGet(List::of);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public List<String> resolveFreshOandaInstruments(UUID userId) {
        BacktestProviderCredential credential = credentialRepository.findByUser_IdAndProvider(userId, BacktestCandleSource.OANDA)
                .orElseThrow(ProviderNotConnectedException::oandaNoCredentials);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if (credential.getInstrumentCapabilitiesRefreshedAt() != null
                && Duration.between(credential.getInstrumentCapabilitiesRefreshedAt(), now).compareTo(Duration.ofHours(24)) < 0) {
            return resolveCapabilities(credential.getInstrumentCapabilities());
        }
        String token = tokenCipherService.decrypt(credential.getTokenIv(), credential.getEncryptedToken());
        OandaEnvironment environment = credential.getEnvironment() == null ? OandaEnvironment.PRACTICE : credential.getEnvironment();
        List<String> instruments = oandaCandleProvider.listInstruments(token, credential.getProviderAccountId(), environment);
        credential.setInstrumentCapabilities(objectMapper.valueToTree(instruments));
        credential.setInstrumentCapabilitiesRefreshedAt(now);
        credential.setLastTestedAt(now);
        credentialRepository.save(credential);
        return instruments;
    }

    // Native quotes use one credential snapshot, so reconnects cannot mix token/account/environment.
    // Expired capabilities are refreshed in memory; reading Today must not update credentials.
    private final java.util.Map<String, MarketCapabilities> marketCapabilities = new java.util.LinkedHashMap<>();

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public OandaMarketConnection marketConnection(UUID userId, boolean discoverCapabilities) {
        var credential = credentialRepository.findByUser_IdAndProvider(userId, BacktestCandleSource.OANDA)
                .orElseThrow(ProviderNotConnectedException::oandaNoCredentials);
        String account = normalizeOptionalText(credential.getProviderAccountId());
        if (account == null) throw ProviderNotConnectedException.oandaNoCredentials();
        OandaEnvironment environment = credential.getEnvironment() == null ? OandaEnvironment.PRACTICE : credential.getEnvironment();
        String version;
        try {
            var digest = java.security.MessageDigest.getInstance("SHA-256");
            digest.update(credential.getTokenIv());
            version = java.util.HexFormat.of().formatHex(digest.digest(credential.getEncryptedToken()));
        } catch (java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
        if (!discoverCapabilities) return new OandaMarketConnection(null, account, environment, List.of(), version);
        String token = tokenCipherService.decrypt(credential.getTokenIv(), credential.getEncryptedToken());
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        List<String> instruments;
        var refreshed = credential.getInstrumentCapabilitiesRefreshedAt();
        if (refreshed != null && !refreshed.isAfter(now) && Duration.between(refreshed, now).toHours() < 24) {
            instruments = resolveCapabilities(credential.getInstrumentCapabilities());
        } else {
            String key = userId + "|" + account + "|" + environment + "|" + version;
            MarketCapabilities cached;
            synchronized (marketCapabilities) {
                marketCapabilities.entrySet().removeIf(e -> Duration.between(e.getValue().at(), now).toHours() >= 24);
                cached = marketCapabilities.get(key);
            }
            if (cached == null) {
                rateLimiter.assertCanFetch(userId);
                instruments = oandaCandleProvider.listInstruments(token, account, environment);
                synchronized (marketCapabilities) {
                    if (marketCapabilities.size() >= 256) marketCapabilities.remove(marketCapabilities.keySet().iterator().next());
                    marketCapabilities.put(key, new MarketCapabilities(now, List.copyOf(instruments)));
                }
            } else instruments = cached.instruments();
        }
        return new OandaMarketConnection(token, account, environment, List.copyOf(instruments), version);
    }

    public record OandaMarketConnection(String token, String accountId, OandaEnvironment environment,
                                        List<String> instruments, String version) {
        @Override public String toString() { return "OandaMarketConnection[redacted]"; }
    }
    private record MarketCapabilities(OffsetDateTime at, List<String> instruments) {}

    private ProviderConnectionStatusResponse toResponse(BacktestProviderCredential credential) {
        return ProviderConnectionStatusResponse.builder()
                .provider(credential.getProvider().name())
                .connected(true)
                .accountId(normalizeOptionalText(credential.getProviderAccountId()))
                .environment(credential.getEnvironment() == null ? OandaEnvironment.PRACTICE.name() : credential.getEnvironment().name())
                .supportedInstruments(resolveCapabilities(credential.getInstrumentCapabilities()))
                .lastTestedAt(credential.getLastTestedAt())
                .build();
    }

    private List<String> resolveCapabilities(com.fasterxml.jackson.databind.JsonNode json) {
        if (json == null || !json.isArray()) return List.of();
        try { return objectMapper.convertValue(json, new TypeReference<List<String>>() {}); }
        catch (Exception ignored) { return List.of(); }
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

    private void requireAccountId(OandaCandleProvider.OandaConnectionResult result) {
        if (result == null || !result.connected() || normalizeOptionalText(result.accountId()) == null) {
            throw new BacktestDomainException(BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED,
                    "OANDA did not return a usable account", "Verify the selected OANDA environment and account permissions.",
                    org.springframework.http.HttpStatus.BAD_REQUEST);
        }
    }
}
