package com.tradevault.service.signalintel;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.domain.enums.SignalRegime;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Optional;

@Service
public class DefaultProfileSelectionService implements ProfileSelectionService {
    private final ObjectMapper objectMapper;

    public DefaultProfileSelectionService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public SignalProfileDefinition defaultProfileFor(String timeframe, SignalRegime regime) {
        String normalizedTimeframe = normalizeTimeframe(timeframe);
        SignalRegime resolvedRegime = regime == null ? SignalRegime.TREND : regime;
        ObjectNode json = baseProfile(normalizedTimeframe);
        applyRegimeAdjustments(json, resolvedRegime);
        String profileId = "AUTO_%s_%s_V1".formatted(normalizedTimeframe, resolvedRegime.name());
        json.put("profileId", profileId);
        json.put("timeframe", normalizedTimeframe);
        json.put("regime", resolvedRegime.name());
        return new SignalProfileDefinition(profileId, normalizedTimeframe, resolvedRegime.name(), json);
    }

    @Override
    public Optional<SignalProfileDefinition> findById(String profileId) {
        if (profileId == null || profileId.isBlank()) {
            return Optional.empty();
        }
        String normalized = profileId.trim().toUpperCase(Locale.ROOT);
        if (!normalized.startsWith("AUTO_") || !normalized.endsWith("_V1")) {
            return Optional.empty();
        }
        String body = normalized.substring(5, normalized.length() - 3);
        int split = body.indexOf('_');
        if (split <= 0 || split >= body.length() - 1) {
            return Optional.empty();
        }
        String timeframe = body.substring(0, split);
        String regimeValue = body.substring(split + 1);
        try {
            SignalRegime regime = SignalRegime.valueOf(regimeValue);
            return Optional.of(defaultProfileFor(timeframe, regime));
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }

    private ObjectNode baseProfile(String timeframe) {
        ObjectNode json = objectMapper.createObjectNode();
        switch (timeframe) {
            case "1" -> {
                json.put("swingLen", 16);
                json.put("minSweepAtr", 0.18d);
                json.put("sweepRetrace", 0.62d);
                json.put("dispBodyMin", 0.60d);
                json.put("minFvgSizeAtr", 0.22d);
                json.put("obSearchBars", 5);
                json.put("maxRiskAtr", 1.10d);
                json.put("confidenceThreshold", 66);
                json.put("cooldownBase", 9);
            }
            case "3" -> {
                json.put("swingLen", 18);
                json.put("minSweepAtr", 0.20d);
                json.put("sweepRetrace", 0.62d);
                json.put("dispBodyMin", 0.58d);
                json.put("minFvgSizeAtr", 0.24d);
                json.put("obSearchBars", 5);
                json.put("maxRiskAtr", 1.20d);
                json.put("confidenceThreshold", 67);
                json.put("cooldownBase", 10);
            }
            case "5" -> {
                json.put("swingLen", 22);
                json.put("minSweepAtr", 0.22d);
                json.put("sweepRetrace", 0.60d);
                json.put("dispBodyMin", 0.56d);
                json.put("minFvgSizeAtr", 0.28d);
                json.put("obSearchBars", 6);
                json.put("maxRiskAtr", 1.30d);
                json.put("confidenceThreshold", 68);
                json.put("cooldownBase", 12);
            }
            case "15" -> {
                json.put("swingLen", 26);
                json.put("minSweepAtr", 0.24d);
                json.put("sweepRetrace", 0.58d);
                json.put("dispBodyMin", 0.55d);
                json.put("minFvgSizeAtr", 0.30d);
                json.put("obSearchBars", 6);
                json.put("maxRiskAtr", 1.45d);
                json.put("confidenceThreshold", 70);
                json.put("cooldownBase", 14);
            }
            case "60" -> {
                json.put("swingLen", 30);
                json.put("minSweepAtr", 0.26d);
                json.put("sweepRetrace", 0.55d);
                json.put("dispBodyMin", 0.52d);
                json.put("minFvgSizeAtr", 0.34d);
                json.put("obSearchBars", 7);
                json.put("maxRiskAtr", 1.60d);
                json.put("confidenceThreshold", 72);
                json.put("cooldownBase", 16);
            }
            case "240" -> {
                json.put("swingLen", 34);
                json.put("minSweepAtr", 0.28d);
                json.put("sweepRetrace", 0.54d);
                json.put("dispBodyMin", 0.50d);
                json.put("minFvgSizeAtr", 0.38d);
                json.put("obSearchBars", 7);
                json.put("maxRiskAtr", 1.80d);
                json.put("confidenceThreshold", 74);
                json.put("cooldownBase", 18);
            }
            default -> {
                json.put("swingLen", 38);
                json.put("minSweepAtr", 0.30d);
                json.put("sweepRetrace", 0.52d);
                json.put("dispBodyMin", 0.48d);
                json.put("minFvgSizeAtr", 0.42d);
                json.put("obSearchBars", 8);
                json.put("maxRiskAtr", 2.00d);
                json.put("confidenceThreshold", 76);
                json.put("cooldownBase", 20);
            }
        }
        json.put("useObFvgConf", true);
        json.put("useHtfBias", true);
        json.put("sessionPreset", "LONDON_NY");
        return json;
    }

    private void applyRegimeAdjustments(ObjectNode json, SignalRegime regime) {
        switch (regime) {
            case RANGE -> {
                json.put("swingLen", json.path("swingLen").asInt() + 2);
                json.put("minSweepAtr", json.path("minSweepAtr").asDouble() - 0.02d);
                json.put("dispBodyMin", json.path("dispBodyMin").asDouble() - 0.03d);
                json.put("minFvgSizeAtr", json.path("minFvgSizeAtr").asDouble() - 0.04d);
                json.put("confidenceThreshold", json.path("confidenceThreshold").asInt() - 2);
            }
            case VOL_EXPANSION -> {
                json.put("minSweepAtr", json.path("minSweepAtr").asDouble() + 0.05d);
                json.put("dispBodyMin", json.path("dispBodyMin").asDouble() + 0.04d);
                json.put("maxRiskAtr", json.path("maxRiskAtr").asDouble() + 0.10d);
                json.put("confidenceThreshold", json.path("confidenceThreshold").asInt() + 2);
            }
            case VOL_COMPRESSION -> {
                json.put("swingLen", json.path("swingLen").asInt() + 4);
                json.put("minSweepAtr", json.path("minSweepAtr").asDouble() - 0.03d);
                json.put("dispBodyMin", json.path("dispBodyMin").asDouble() - 0.05d);
                json.put("minFvgSizeAtr", json.path("minFvgSizeAtr").asDouble() - 0.05d);
                json.put("cooldownBase", json.path("cooldownBase").asInt() - 2);
            }
            case TREND -> {
                json.put("dispBodyMin", json.path("dispBodyMin").asDouble() + 0.02d);
                json.put("confidenceThreshold", json.path("confidenceThreshold").asInt() + 1);
            }
        }
    }

    private String normalizeTimeframe(String timeframe) {
        if (timeframe == null || timeframe.isBlank()) {
            return "15";
        }
        String normalized = timeframe.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "1", "3", "5", "15", "60", "240", "D" -> normalized;
            case "1H" -> "60";
            case "4H" -> "240";
            case "1D" -> "D";
            default -> normalized;
        };
    }
}
