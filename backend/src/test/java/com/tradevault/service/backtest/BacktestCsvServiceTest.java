package com.tradevault.service.backtest;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.BacktestCsvUpload;
import com.tradevault.domain.entity.BacktestDataset;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;
import com.tradevault.dto.backtest.BacktestDatasetResponse;
import com.tradevault.dto.backtest.CsvColumnMappingRequest;
import com.tradevault.dto.backtest.CsvIngestRequest;
import com.tradevault.dto.backtest.CsvIngestResponse;
import com.tradevault.dto.backtest.CsvUploadResponse;
import com.tradevault.repository.BacktestCsvMappingRepository;
import com.tradevault.repository.BacktestCsvUploadRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.mock.web.MockMultipartFile;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class BacktestCsvServiceTest {

    private BacktestCsvUploadRepository uploadRepository;
    private BacktestCsvMappingRepository mappingRepository;
    private BacktestDatasetService datasetService;
    private CandleChunkStoreService chunkStoreService;
    private BacktestCsvService csvService;

    @BeforeEach
    void setup() {
        uploadRepository = mock(BacktestCsvUploadRepository.class);
        mappingRepository = mock(BacktestCsvMappingRepository.class);
        datasetService = mock(BacktestDatasetService.class);
        chunkStoreService = mock(CandleChunkStoreService.class);
        csvService = new BacktestCsvService(
                uploadRepository,
                mappingRepository,
                datasetService,
                chunkStoreService,
                new ObjectMapper().findAndRegisterModules()
        );
        ReflectionTestUtils.setField(csvService, "csvMaxUploadMb", 25);
    }

    @Test
    void uploadDetectsTradingViewStyleHeaders() {
        User user = User.builder().id(UUID.randomUUID()).email("csv@test.com").build();
        String csv = "time,open,high,low,close,volume\n"
                + "2026-02-01T00:00:00Z,1.1000,1.1010,1.0990,1.1005,100\n"
                + "2026-02-01T00:01:00Z,1.1005,1.1015,1.0995,1.1010,120\n";

        MockMultipartFile file = new MockMultipartFile("file", "tv.csv", "text/csv", csv.getBytes());
        when(mappingRepository.findByUser_IdAndHeaderSignature(any(), any())).thenReturn(Optional.empty());
        when(uploadRepository.save(any())).thenAnswer(invocation -> {
            BacktestCsvUpload upload = invocation.getArgument(0);
            upload.setId(UUID.randomUUID());
            return upload;
        });

        CsvUploadResponse response = csvService.upload(user, file);

        assertThat(response.isMappingRequired()).isFalse();
        assertThat(response.getHeaders()).contains("time", "open", "high", "low", "close");
        assertThat(response.getDetectedTimeframe()).isEqualTo("M1");
        assertThat(response.getFileId()).isNotNull();
    }

    @Test
    void ingestParsesGenericCsvUsingExplicitMapping() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).email("csv@test.com").build();
        UUID fileId = UUID.randomUUID();

        String csv = "Date,OpenPx,HighPx,LowPx,ClosePx,Vol\n"
                + "2026-02-01 00:00:00,1.1000,1.1010,1.0990,1.1005,100\n"
                + "2026-02-01 00:05:00,1.1005,1.1015,1.0995,1.1010,120\n";
        BacktestCsvUpload upload = BacktestCsvUpload.builder()
                .id(fileId)
                .user(user)
                .originalFileName("generic.csv")
                .filePayload(csv.getBytes())
                .headerSignature("sig")
                .detectedJson(new ObjectMapper().createObjectNode())
                .build();

        CsvColumnMappingRequest mapping = new CsvColumnMappingRequest();
        mapping.setTimeColumn("Date");
        mapping.setOpenColumn("OpenPx");
        mapping.setHighColumn("HighPx");
        mapping.setLowColumn("LowPx");
        mapping.setCloseColumn("ClosePx");
        mapping.setVolumeColumn("Vol");
        mapping.setTimezone("UTC");

        CsvIngestRequest request = new CsvIngestRequest();
        request.setMapping(mapping);
        request.setSymbol("EURUSD");
        request.setTimeframe("M5");

        BacktestDataset dataset = BacktestDataset.builder()
                .id(UUID.randomUUID())
                .provider(BacktestCandleSource.CSV)
                .sourceId("source-1")
                .name("generic.csv")
                .symbolCanonical("EURUSD")
                .symbolDisplay("EURUSD")
                .timeframe(BacktestTimeframe.M5)
                .dataFrom(OffsetDateTime.parse("2026-02-01T00:00:00Z"))
                .dataTo(OffsetDateTime.parse("2026-02-01T00:05:00Z"))
                .rowCount(2)
                .build();

        when(uploadRepository.findByIdAndUser_Id(fileId, userId)).thenReturn(Optional.of(upload));
        when(mappingRepository.findByUser_IdAndHeaderSignature(any(), any())).thenReturn(Optional.empty());
        when(datasetService.upsertDataset(any(), any(), any(), any(), any(), any(), any(), any(), any(), anyInt(), any(), any(), any())).thenReturn(dataset);
        when(datasetService.toResponse(any())).thenReturn(BacktestDatasetResponse.builder()
                .id(dataset.getId())
                .provider("CSV")
                .sourceId("source-1")
                .name("generic.csv")
                .symbolCanonical("EURUSD")
                .symbolDisplay("EURUSD")
                .timeframe("M5")
                .dataFrom(dataset.getDataFrom())
                .dataTo(dataset.getDataTo())
                .rowCount(2)
                .warnings(java.util.List.of())
                .build());

        CsvIngestResponse response = csvService.ingest(user, fileId, request);

        assertThat(response.getDataset()).isNotNull();
        assertThat(response.getDataset().getProvider()).isEqualTo("CSV");
        verify(chunkStoreService).saveCandles(eq(userId), eq(BacktestCandleSource.CSV), any(), eq("EURUSD"), eq("EURUSD"), eq(BacktestTimeframe.M5), any());
    }
}
