package com.tradevault.service.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.BacktestCsvUpload;
import com.tradevault.domain.entity.CandleChunk;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;
import com.tradevault.domain.enums.Role;
import com.tradevault.repository.BacktestCsvUploadRepository;
import com.tradevault.repository.CandleChunkRepository;
import com.tradevault.repository.UserRepository;
import com.tradevault.service.CurrentUserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@Testcontainers
class BacktestBinaryPayloadIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("tradevault")
            .withUsername("tradevault")
            .withPassword("tradevault");

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CandleChunkRepository candleChunkRepository;

    @Autowired
    private BacktestCsvUploadRepository backtestCsvUploadRepository;

    @Autowired
    private CandleChunkStoreService candleChunkStoreService;

    @Autowired
    private CandleChunkCodec candleChunkCodec;

    @MockBean
    private CurrentUserService currentUserService;

    @AfterEach
    void cleanup() {
        userRepository.deleteAll();
    }

    @Test
    void candleChunkStorePersistsBinaryPayloadAndRoundTrips() {
        User user = createUser("chunk-binary@example.com");
        OffsetDateTime t0 = OffsetDateTime.parse("2026-02-01T00:00:00Z");
        List<CanonicalCandle> candles = List.of(
                new CanonicalCandle(
                        BacktestCandleSource.DEMO,
                        "DEMO",
                        "EURUSD",
                        "DEMO:EURUSD",
                        BacktestTimeframe.M5,
                        t0,
                        new BigDecimal("1.1000"),
                        new BigDecimal("1.1010"),
                        new BigDecimal("1.0990"),
                        new BigDecimal("1.1005"),
                        BigDecimal.valueOf(100)
                ),
                new CanonicalCandle(
                        BacktestCandleSource.DEMO,
                        "DEMO",
                        "EURUSD",
                        "DEMO:EURUSD",
                        BacktestTimeframe.M5,
                        t0.plusMinutes(5),
                        new BigDecimal("1.1005"),
                        new BigDecimal("1.1015"),
                        new BigDecimal("1.0995"),
                        new BigDecimal("1.1010"),
                        BigDecimal.valueOf(120)
                )
        );

        candleChunkStoreService.saveCandles(
                user.getId(),
                BacktestCandleSource.DEMO,
                "DEMO",
                "EURUSD",
                "DEMO:EURUSD",
                BacktestTimeframe.M5,
                candles
        );

        List<CandleChunk> chunks = candleChunkRepository.findAll().stream()
                .filter(chunk -> chunk.getProvider() == BacktestCandleSource.DEMO)
                .filter(chunk -> "DEMO".equals(chunk.getSourceId()))
                .filter(chunk -> "EURUSD".equals(chunk.getSymbolCanonical()))
                .toList();

        assertThat(chunks).hasSize(1);
        CandleChunk stored = chunks.get(0);
        assertThat(stored.getPayload()).isNotNull();
        assertThat(stored.getPayload().length).isGreaterThan(0);
        assertThat(stored.getObjectKey()).isNull();

        List<CanonicalCandle> decoded = candleChunkCodec.decode(
                stored.getPayload(),
                stored.getProvider(),
                stored.getSourceId(),
                stored.getSymbolCanonical(),
                stored.getSymbolDisplay(),
                stored.getTimeframe()
        );
        assertThat(decoded).hasSize(2);
        assertThat(decoded.get(0).tsUtc()).isEqualTo(t0);
    }

    @Test
    void demoLoadEndpointStoresBinaryPayloadsForChunks() throws Exception {
        User user = createUser("demo-load-binary@example.com");
        mockCurrentUser(user);

        mockMvc.perform(post("/api/backtest/demo/load")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        List<CandleChunk> demoChunks = candleChunkRepository.findAll().stream()
                .filter(chunk -> chunk.getProvider() == BacktestCandleSource.DEMO)
                .filter(chunk -> "DEMO".equals(chunk.getSourceId()))
                .toList();

        assertThat(demoChunks).isNotEmpty();
        assertThat(demoChunks)
                .allSatisfy(chunk -> {
                    assertThat(chunk.getPayload()).isNotNull();
                    assertThat(chunk.getPayload().length).isGreaterThan(0);
                    assertThat(chunk.getObjectKey()).isNull();
                });
    }

    @Test
    void demoDatasetCanBeReadThroughCandlesEndpointWithDefaultRange() throws Exception {
        User user = createUser("demo-candles-default@example.com");
        mockCurrentUser(user);

        mockMvc.perform(post("/api/backtest/demo/load")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        MvcResult datasetsResult = mockMvc.perform(get("/api/backtest/datasets"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode datasets = objectMapper.readTree(datasetsResult.getResponse().getContentAsString());
        String datasetId = datasets.get(0).path("id").asText();

        MvcResult metadataResult = mockMvc.perform(get("/api/backtest/datasets/{id}/summary", datasetId))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode metadata = objectMapper.readTree(metadataResult.getResponse().getContentAsString());
        assertThat(metadata.path("timeframe").asText()).isNotBlank();
        assertThat(metadata.path("dataFromUtc").asText()).isNotBlank();
        assertThat(metadata.path("dataToUtc").asText()).isNotBlank();
        assertThat(metadata.path("defaultFromUtc").asText()).isNotBlank();
        assertThat(metadata.path("defaultToUtc").asText()).isNotBlank();
        assertThat(metadata.path("candleCount").asLong()).isGreaterThan(100L);

        MvcResult candlesResult = mockMvc.perform(get("/api/backtest/candles")
                        .param("provider", "DEMO")
                        .param("datasetId", datasetId))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode candlesJson = objectMapper.readTree(candlesResult.getResponse().getContentAsString());

        assertThat(candlesJson.path("provider").asText()).isEqualTo("DEMO");
        assertThat(candlesJson.path("candles").isArray()).isTrue();
        assertThat(candlesJson.path("candles").size()).isGreaterThan(100);
        assertThat(candlesJson.path("count").asInt()).isGreaterThan(100);
        assertThat(candlesJson.path("effectiveFromUtc").asText()).isNotBlank();
        assertThat(candlesJson.path("effectiveToUtc").asText()).isNotBlank();
        JsonNode candles = candlesJson.path("candles");
        OffsetDateTime previous = null;
        for (JsonNode candle : candles) {
            OffsetDateTime current = OffsetDateTime.parse(candle.path("timestamp").asText());
            if (previous != null) {
                assertThat(current).isAfterOrEqualTo(previous);
            }
            previous = current;
        }
    }

    @Test
    void csvUploadAndIngestStoreBinaryPayloads() throws Exception {
        User user = createUser("csv-binary@example.com");
        mockCurrentUser(user);

        byte[] csvPayload = (
                "time,open,high,low,close,volume\n"
                        + "2026-02-01T00:00:00Z,1.1000,1.1010,1.0990,1.1005,100\n"
                        + "2026-02-01T00:05:00Z,1.1005,1.1015,1.0995,1.1010,120\n"
        ).getBytes(StandardCharsets.UTF_8);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.csv",
                "text/csv",
                csvPayload
        );

        MvcResult uploadResult = mockMvc.perform(multipart("/api/backtest/csv/upload").file(file))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode uploadJson = objectMapper.readTree(uploadResult.getResponse().getContentAsString());
        UUID fileId = UUID.fromString(uploadJson.path("fileId").asText());

        BacktestCsvUpload upload = backtestCsvUploadRepository.findByIdAndUser_Id(fileId, user.getId()).orElseThrow();
        assertThat(upload.getFilePayload()).containsExactly(csvPayload);
        assertThat(upload.getFileSizeBytes()).isEqualTo(csvPayload.length);

        String ingestPayload = objectMapper.createObjectNode()
                .put("symbol", "EURUSD")
                .put("timeframe", "M5")
                .put("datasetName", "CSV Binary")
                .toString();

        MvcResult ingestResult = mockMvc.perform(post("/api/backtest/csv/ingest")
                        .param("fileId", fileId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ingestPayload))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode ingestJson = objectMapper.readTree(ingestResult.getResponse().getContentAsString());
        String sourceId = ingestJson.path("dataset").path("sourceId").asText();

        List<CandleChunk> csvChunks = candleChunkRepository.findAll().stream()
                .filter(chunk -> chunk.getProvider() == BacktestCandleSource.CSV)
                .filter(chunk -> sourceId.equals(chunk.getSourceId()))
                .toList();

        assertThat(csvChunks).isNotEmpty();
        assertThat(csvChunks)
                .allSatisfy(chunk -> {
                    assertThat(chunk.getPayload()).isNotNull();
                    assertThat(chunk.getPayload().length).isGreaterThan(0);
                    assertThat(chunk.getObjectKey()).isNull();
                });

        CandleChunk firstChunk = csvChunks.get(0);
        List<CanonicalCandle> decoded = candleChunkCodec.decode(
                firstChunk.getPayload(),
                firstChunk.getProvider(),
                firstChunk.getSourceId(),
                firstChunk.getSymbolCanonical(),
                firstChunk.getSymbolDisplay(),
                firstChunk.getTimeframe()
        );
        assertThat(decoded).isNotEmpty();
    }

    @Test
    void csvDatasetCanBeReadThroughCandlesEndpoint() throws Exception {
        User user = createUser("csv-candles-default@example.com");
        mockCurrentUser(user);

        byte[] csvPayload = (
                "time,open,high,low,close,volume\n"
                        + "2026-02-01T00:00:00Z,1.1000,1.1010,1.0990,1.1005,100\n"
                        + "2026-02-01T00:05:00Z,1.1005,1.1015,1.0995,1.1010,120\n"
        ).getBytes(StandardCharsets.UTF_8);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.csv",
                "text/csv",
                csvPayload
        );

        MvcResult uploadResult = mockMvc.perform(multipart("/api/backtest/csv/upload").file(file))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode uploadJson = objectMapper.readTree(uploadResult.getResponse().getContentAsString());
        UUID fileId = UUID.fromString(uploadJson.path("fileId").asText());

        String ingestPayload = objectMapper.createObjectNode()
                .put("symbol", "EURUSD")
                .put("timeframe", "M5")
                .put("datasetName", "CSV Read")
                .toString();

        MvcResult ingestResult = mockMvc.perform(post("/api/backtest/csv/ingest")
                        .param("fileId", fileId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ingestPayload))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode ingestJson = objectMapper.readTree(ingestResult.getResponse().getContentAsString());
        String datasetId = ingestJson.path("dataset").path("id").asText();

        MvcResult summaryResult = mockMvc.perform(get("/api/backtest/datasets/{id}/summary", datasetId))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode summaryJson = objectMapper.readTree(summaryResult.getResponse().getContentAsString());
        assertThat(summaryJson.path("dataFromUtc").asText()).startsWith("2026-02-01T00:00");
        assertThat(summaryJson.path("dataToUtc").asText()).startsWith("2026-02-01T00:05");
        assertThat(summaryJson.path("defaultFromUtc").asText()).isNotBlank();
        assertThat(summaryJson.path("defaultToUtc").asText()).isNotBlank();
        assertThat(summaryJson.path("candleCount").asLong()).isGreaterThan(0L);

        MvcResult candlesResult = mockMvc.perform(get("/api/backtest/candles")
                        .param("provider", "CSV")
                        .param("datasetId", datasetId))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode candlesJson = objectMapper.readTree(candlesResult.getResponse().getContentAsString());

        assertThat(candlesJson.path("provider").asText()).isEqualTo("CSV");
        assertThat(candlesJson.path("candles").isArray()).isTrue();
        assertThat(candlesJson.path("candles").size()).isGreaterThan(0);
        assertThat(candlesJson.path("count").asInt()).isGreaterThan(0);
        assertThat(candlesJson.path("effectiveFromUtc").asText()).isNotBlank();
        assertThat(candlesJson.path("effectiveToUtc").asText()).isNotBlank();
    }

    private User createUser(String email) {
        return userRepository.save(User.builder()
                .email(email)
                .passwordHash("hash")
                .role(Role.USER)
                .baseCurrency("USD")
                .timezone("UTC")
                .build());
    }

    private void mockCurrentUser(User user) {
        Mockito.when(currentUserService.getCurrentUser())
                .thenAnswer(invocation -> userRepository.findById(user.getId()).orElseThrow());
    }
}
