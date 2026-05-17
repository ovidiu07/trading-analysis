package com.tradevault.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.ChartSettings;
import com.tradevault.dto.chartsettings.ChartSettingsRequest;
import com.tradevault.dto.chartsettings.ChartSettingsResponse;
import com.tradevault.repository.ChartSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ChartSettingsService {
    static final String SETTINGS_KEY = "default";
    static final List<String> DEFAULT_PRELOADED_INDICATORS = List.of(
            "MASimple@tv-basicstudies",
            "RSI@tv-basicstudies"
    );
    private static final int MAX_IDENTIFIER_LENGTH = 160;

    private final ChartSettingsRepository chartSettingsRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public ChartSettingsResponse getEffectiveSettings() {
        return chartSettingsRepository.findById(SETTINGS_KEY)
                .map(settings -> new ChartSettingsResponse(readIndicators(settings)))
                .orElseGet(() -> new ChartSettingsResponse(DEFAULT_PRELOADED_INDICATORS));
    }

    @Transactional
    public ChartSettingsResponse update(ChartSettingsRequest request) {
        if (request == null || request.getPreloadedIndicators() == null) {
            throw new IllegalArgumentException("preloadedIndicators is required");
        }
        List<String> normalized = normalizeIndicators(request.getPreloadedIndicators());
        ChartSettings settings = chartSettingsRepository.findById(SETTINGS_KEY)
                .orElseGet(() -> ChartSettings.builder().settingsKey(SETTINGS_KEY).build());
        settings.setPreloadedIndicatorsJson(objectMapper.valueToTree(normalized));
        ChartSettings saved = chartSettingsRepository.save(settings);
        return new ChartSettingsResponse(readIndicators(saved));
    }

    List<String> normalizeIndicators(List<String> indicators) {
        Set<String> unique = new LinkedHashSet<>();
        for (String raw : indicators) {
            if (raw == null) {
                continue;
            }
            String value = raw.trim();
            if (value.isEmpty()) {
                continue;
            }
            validateIndicatorIdentifier(value);
            unique.add(value);
        }
        if (unique.isEmpty()) {
            throw new IllegalArgumentException("At least one TradingView study identifier is required");
        }
        return new ArrayList<>(unique);
    }

    private void validateIndicatorIdentifier(String value) {
        if (value.length() > MAX_IDENTIFIER_LENGTH) {
            throw new IllegalArgumentException("TradingView study identifier is too long");
        }
        if (!value.contains("@") || !value.matches("[A-Za-z0-9@._:-]+")) {
            throw new IllegalArgumentException("TradingView study identifiers must look like MASimple@tv-basicstudies");
        }
    }

    private List<String> readIndicators(ChartSettings settings) {
        if (settings.getPreloadedIndicatorsJson() == null || !settings.getPreloadedIndicatorsJson().isArray()) {
            return DEFAULT_PRELOADED_INDICATORS;
        }
        try {
            return normalizeIndicators(objectMapper.convertValue(
                    settings.getPreloadedIndicatorsJson(),
                    new TypeReference<List<String>>() {
                    }
            ));
        } catch (IllegalArgumentException ex) {
            return DEFAULT_PRELOADED_INDICATORS;
        }
    }
}
