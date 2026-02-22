package com.tradevault.service.backtest;

import com.tradevault.domain.entity.BacktestDataset;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.dto.backtest.BacktestDatasetResponse;
import com.tradevault.repository.BacktestDatasetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

class BacktestDemoServiceTest {

    private BacktestDatasetRepository datasetRepository;
    private BacktestDatasetService datasetService;
    private CandleChunkStoreService chunkStoreService;
    private BacktestDemoService demoService;

    @BeforeEach
    void setup() {
        datasetRepository = mock(BacktestDatasetRepository.class);
        datasetService = mock(BacktestDatasetService.class);
        chunkStoreService = mock(CandleChunkStoreService.class);
        demoService = new BacktestDemoService(datasetRepository, datasetService, chunkStoreService);
    }

    @Test
    void ensureDemoDatasetsGeneratesDeterministicMetadata() {
        User user = User.builder().id(UUID.randomUUID()).email("demo@test.com").build();
        when(datasetRepository.findByUser_IdAndProviderOrderByCreatedAtDesc(user.getId(), BacktestCandleSource.DEMO)).thenReturn(List.of());

        List<BacktestDataset> saved = new ArrayList<>();
        when(datasetService.upsertDataset(any(), any(), any(), any(), any(), any(), any(), any(), any(), anyInt(), any()))
                .thenAnswer(invocation -> {
                    BacktestDataset dataset = BacktestDataset.builder()
                            .id(UUID.randomUUID())
                            .provider(invocation.getArgument(1))
                            .sourceId(invocation.getArgument(2))
                            .name(invocation.getArgument(3))
                            .symbolCanonical(invocation.getArgument(4))
                            .symbolDisplay(invocation.getArgument(5))
                            .timeframe(invocation.getArgument(6))
                            .dataFrom(invocation.getArgument(7))
                            .dataTo(invocation.getArgument(8))
                            .rowCount(invocation.getArgument(9))
                            .build();
                    saved.add(dataset);
                    return dataset;
                });
        when(datasetService.toResponse(any())).thenAnswer(invocation -> {
            BacktestDataset dataset = invocation.getArgument(0);
            return BacktestDatasetResponse.builder()
                    .id(dataset.getId())
                    .provider(dataset.getProvider().name())
                    .sourceId(dataset.getSourceId())
                    .name(dataset.getName())
                    .symbolCanonical(dataset.getSymbolCanonical())
                    .symbolDisplay(dataset.getSymbolDisplay())
                    .timeframe(dataset.getTimeframe().name())
                    .dataFrom(dataset.getDataFrom())
                    .dataTo(dataset.getDataTo())
                    .rowCount(dataset.getRowCount())
                    .warnings(List.of())
                    .build();
        });

        List<BacktestDatasetResponse> response = demoService.ensureDemoDatasets(user);

        assertThat(response).hasSize(2);
        assertThat(response).extracting(BacktestDatasetResponse::getProvider).containsOnly("DEMO");
        assertThat(response).extracting(BacktestDatasetResponse::getTimeframe).containsOnly("M5");
        assertThat(response.get(0).getDataFrom()).isEqualTo(OffsetDateTime.parse("2025-11-01T00:00:00Z"));
        verify(chunkStoreService, times(2)).saveCandles(any(), any(), any(), any(), any(), any(), any());
    }
}
