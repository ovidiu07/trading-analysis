package com.tradevault.service.signalintel;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.config.SignalIntelProperties;
import com.tradevault.domain.entity.User;
import com.tradevault.dto.signalintel.TradingViewWebhookSecretResetResponse;
import com.tradevault.dto.signalintel.TradingViewWebhookSettingsResponse;
import com.tradevault.dto.signalintel.TradingViewWebhookSettingsUpdateRequest;
import com.tradevault.repository.UserRepository;
import com.tradevault.service.CurrentUserService;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
public class TradingViewSettingsService {
    private static final String TOKEN_PLACEHOLDER = "YOUR_WEBHOOK_SECRET";

    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;
    private final TradingViewWebhookAuthService webhookAuthService;
    private final SignalIntelProperties properties;
    private final ObjectMapper objectMapper;

    public TradingViewSettingsService(CurrentUserService currentUserService,
                                      UserRepository userRepository,
                                      TradingViewWebhookAuthService webhookAuthService,
                                      SignalIntelProperties properties,
                                      ObjectMapper objectMapper) {
        this.currentUserService = currentUserService;
        this.userRepository = userRepository;
        this.webhookAuthService = webhookAuthService;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public TradingViewWebhookSettingsResponse getSettings() {
        User user = currentUserService.getCurrentUser();
        User entity = userRepository.findById(user.getId())
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        return buildSettingsResponse(entity, TOKEN_PLACEHOLDER);
    }

    @Transactional
    public TradingViewWebhookSettingsResponse updateSettings(TradingViewWebhookSettingsUpdateRequest request) {
        User user = currentUserService.getCurrentUser();
        User entity = userRepository.findByIdForUpdate(user.getId())
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        entity.setTradingviewWebhookEnabled(Boolean.TRUE.equals(request.getEnabled()));
        return buildSettingsResponse(userRepository.save(entity), TOKEN_PLACEHOLDER);
    }

    @Transactional
    public TradingViewWebhookSecretResetResponse resetSecret() {
        User user = currentUserService.getCurrentUser();
        User entity = userRepository.findByIdForUpdate(user.getId())
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        String secret = webhookAuthService.generateSecret();
        entity.setTradingviewWebhookSecretHash(webhookAuthService.hashSecret(secret));
        entity.setTradingviewWebhookSecretHint(webhookAuthService.buildHint(secret));
        entity.setTradingviewWebhookSecretRotatedAt(OffsetDateTime.now());
        entity.setTradingviewWebhookEnabled(true);
        userRepository.save(entity);
        return TradingViewWebhookSecretResetResponse.builder()
                .secret(secret)
                .secretHint(entity.getTradingviewWebhookSecretHint())
                .generatedAt(entity.getTradingviewWebhookSecretRotatedAt())
                .openSignalWebhookUrl(buildWebhookUrl("open", secret))
                .closeSignalWebhookUrl(buildWebhookUrl("close", secret))
                .build();
    }

    private TradingViewWebhookSettingsResponse buildSettingsResponse(User user, String token) {
        return TradingViewWebhookSettingsResponse.builder()
                .enabled(user.isTradingviewWebhookEnabled())
                .hasSecret(user.getTradingviewWebhookSecretHash() != null && !user.getTradingviewWebhookSecretHash().isBlank())
                .secretHint(user.getTradingviewWebhookSecretHint())
                .lastRotatedAt(user.getTradingviewWebhookSecretRotatedAt())
                .openSignalWebhookUrl(buildWebhookUrl("open", token))
                .closeSignalWebhookUrl(buildWebhookUrl("close", token))
                .sampleOpenPayload(buildOpenPayloadExample(token))
                .sampleClosePayload(buildClosePayloadExample(token))
                .build();
    }

    private String buildWebhookUrl(String action, String token) {
        String base = properties.getWebhookBaseUrl();
        if (base == null || base.isBlank()) {
            base = "http://localhost:8080";
        }
        String normalizedBase = base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
        return "%s/api/integrations/tradingview/signals/%s?token=%s".formatted(normalizedBase, action, token);
    }

    private String buildOpenPayloadExample(String token) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("schemaVersion", "1.0");
        payload.put("eventType", "SIGNAL_OPEN");
        payload.put("externalTradeId", "tv-BINANCE-BTCUSDT-15-1741888800000-long");
        payload.put("symbol", "BINANCE:BTCUSDT");
        payload.put("timeframe", "15");
        payload.put("timestamp", 1741888800000L);
        payload.put("barTime", 1741888800000L);
        payload.put("setupType", "SWEEP_OB_REVERSAL");
        payload.put("direction", "LONG");
        payload.put("entry", 65432.5d);
        payload.put("stopLoss", 65210.0d);
        payload.put("takeProfit", 65874.0d);
        payload.put("rr", 2.0d);
        payload.put("confidenceScore", 78);
        payload.put("regime", "TREND");
        payload.put("htfBias", "BULLISH");
        payload.put("session", "LONDON_NY");
        payload.put("parameterProfileId", "AUTO_15_TREND_V1");
        ObjectNode features = payload.putObject("features");
        features.put("atr", 55.4d);
        features.put("atrMean", 40.2d);
        features.put("adx", 27.1d);
        features.put("emaSlope", 0.43d);
        features.put("bodyPct", 0.68d);
        features.put("sweepDepthAtr", 0.52d);
        features.put("fvgSizeAtr", 0.43d);
        features.put("obSizeAtr", 0.71d);
        features.put("volatilityState", "EXPANDING");
        features.put("rangeState", "BALANCED");
        payload.put("authToken", token);
        return writePretty(payload);
    }

    private String buildClosePayloadExample(String token) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("schemaVersion", "1.0");
        payload.put("eventType", "SIGNAL_CLOSE");
        payload.put("externalTradeId", "tv-BINANCE-BTCUSDT-15-1741888800000-long");
        payload.put("symbol", "BINANCE:BTCUSDT");
        payload.put("timeframe", "15");
        payload.put("timestamp", 1741892400000L);
        payload.put("result", "WIN");
        payload.put("pnlR", 2.0d);
        payload.put("exitReason", "TP");
        payload.put("slippage", 0.0d);
        payload.put("holdBars", 6);
        payload.put("authToken", token);
        return writePretty(payload);
    }

    private String writePretty(ObjectNode payload) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Could not serialize TradingView payload example", ex);
        }
    }
}
