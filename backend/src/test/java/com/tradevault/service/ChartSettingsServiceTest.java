package com.tradevault.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.ChartSettings;
import com.tradevault.dto.chartsettings.ChartSettingsRequest;
import com.tradevault.repository.ChartSettingsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ChartSettingsServiceTest {
    private ChartSettingsRepository chartSettingsRepository;
    private ObjectMapper objectMapper;
    private ChartSettingsService service;

    @BeforeEach
    void setup() {
        chartSettingsRepository = mock(ChartSettingsRepository.class);
        objectMapper = new ObjectMapper().findAndRegisterModules();
        service = new ChartSettingsService(chartSettingsRepository, objectMapper);
    }

    @Test
    void returnsDefaultsWhenNoSettingsExist() {
        when(chartSettingsRepository.findById(ChartSettingsService.SETTINGS_KEY)).thenReturn(Optional.empty());

        assertThat(service.getEffectiveSettings().getPreloadedIndicators())
                .containsExactly("MASimple@tv-basicstudies", "RSI@tv-basicstudies");
    }

    @Test
    void updateTrimsDeduplicatesAndPreservesOrder() {
        ChartSettingsRequest request = new ChartSettingsRequest();
        request.setPreloadedIndicators(List.of(
                "  RSI@tv-basicstudies ",
                "MACD@tv-basicstudies",
                "RSI@tv-basicstudies",
                "",
                "MASimple@tv-basicstudies"
        ));
        when(chartSettingsRepository.findById(ChartSettingsService.SETTINGS_KEY)).thenReturn(Optional.empty());
        ArgumentCaptor<ChartSettings> captor = ArgumentCaptor.forClass(ChartSettings.class);
        when(chartSettingsRepository.save(captor.capture())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.update(request);

        assertThat(response.getPreloadedIndicators())
                .containsExactly("RSI@tv-basicstudies", "MACD@tv-basicstudies", "MASimple@tv-basicstudies");
        assertThat(captor.getValue().getSettingsKey()).isEqualTo(ChartSettingsService.SETTINGS_KEY);
    }

    @Test
    void rejectsWhitespaceOnlyList() {
        ChartSettingsRequest request = new ChartSettingsRequest();
        request.setPreloadedIndicators(List.of(" ", "\n"));

        assertThatThrownBy(() -> service.update(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("At least one");
    }

    @Test
    void rejectsIdentifiersWithSpaces() {
        ChartSettingsRequest request = new ChartSettingsRequest();
        request.setPreloadedIndicators(List.of("Bad Study@tv-basicstudies"));

        assertThatThrownBy(() -> service.update(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("TradingView study identifiers");
    }
}
