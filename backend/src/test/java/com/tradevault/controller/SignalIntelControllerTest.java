package com.tradevault.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.domain.entity.SignalEvent;
import com.tradevault.domain.entity.SignalFeatureSnapshot;
import com.tradevault.domain.entity.SignalOutcome;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Role;
import com.tradevault.domain.enums.SignalEventType;
import com.tradevault.domain.enums.SignalHtfBias;
import com.tradevault.domain.enums.SignalOutcomeStatus;
import com.tradevault.domain.enums.SignalRegime;
import com.tradevault.domain.enums.SignalSetupType;
import com.tradevault.repository.SignalEventRepository;
import com.tradevault.repository.SignalFeatureSnapshotRepository;
import com.tradevault.repository.SignalOutcomeRepository;
import com.tradevault.repository.SignalPerformanceAggregateRepository;
import com.tradevault.repository.SignalProfileRecommendationRepository;
import com.tradevault.repository.UserRepository;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.signalintel.TradingViewWebhookAuthService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@Testcontainers
class SignalIntelControllerTest {

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
    private SignalEventRepository signalEventRepository;

    @Autowired
    private SignalFeatureSnapshotRepository signalFeatureSnapshotRepository;

    @Autowired
    private SignalOutcomeRepository signalOutcomeRepository;

    @Autowired
    private SignalPerformanceAggregateRepository signalPerformanceAggregateRepository;

    @Autowired
    private SignalProfileRecommendationRepository signalProfileRecommendationRepository;

    @Autowired
    private TradingViewWebhookAuthService tradingViewWebhookAuthService;

    @MockBean
    private CurrentUserService currentUserService;

    @AfterEach
    void cleanUp() {
        signalProfileRecommendationRepository.deleteAll();
        signalPerformanceAggregateRepository.deleteAll();
        signalOutcomeRepository.deleteAll();
        signalFeatureSnapshotRepository.deleteAll();
        signalEventRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void resetSecretThenIngestOpenAndCloseSignals() throws Exception {
        User user = userRepository.save(User.builder()
                .email("signal-settings@example.com")
                .passwordHash("hashed")
                .role(Role.USER)
                .baseCurrency("USD")
                .build());
        Mockito.when(currentUserService.getCurrentUser()).thenReturn(user);

        MvcResult resetSecretResult = mockMvc.perform(post("/api/integrations/tradingview/settings/reset-secret"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.secret").isString())
                .andExpect(jsonPath("$.openSignalWebhookUrl").value(org.hamcrest.Matchers.containsString("/api/integrations/tradingview/signals/open?token=")))
                .andReturn();

        JsonNode secretPayload = objectMapper.readTree(resetSecretResult.getResponse().getContentAsString());
        String secret = secretPayload.path("secret").asText();

        mockMvc.perform(get("/api/integrations/tradingview/settings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.hasSecret").value(true));

        mockMvc.perform(put("/api/integrations/tradingview/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "enabled": false
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false));

        mockMvc.perform(put("/api/integrations/tradingview/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "enabled": true
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true));

        String externalTradeId = "tv-BINANCE_BTCUSDT-15-1741888800000-long-sweepob";
        ObjectNode openPayload = objectMapper.createObjectNode();
        openPayload.put("schemaVersion", "1.0");
        openPayload.put("eventType", "SIGNAL_OPEN");
        openPayload.put("externalTradeId", externalTradeId);
        openPayload.put("symbol", "BINANCE:BTCUSDT");
        openPayload.put("timeframe", "15");
        openPayload.put("timestamp", 1741888800000L);
        openPayload.put("barTime", 1741888800000L);
        openPayload.put("setupType", "SWEEP_OB_REVERSAL");
        openPayload.put("direction", "LONG");
        openPayload.put("entry", 65432.5d);
        openPayload.put("stopLoss", 65210.0d);
        openPayload.put("takeProfit", 65874.0d);
        openPayload.put("rr", 2.0d);
        openPayload.put("confidenceScore", 78);
        openPayload.put("regime", "TREND");
        openPayload.put("htfBias", "BULLISH");
        openPayload.put("session", "LONDON_NY");
        openPayload.put("parameterProfileId", "AUTO_15_TREND_V1");
        ObjectNode features = openPayload.putObject("features");
        features.put("atr", 55.4d);
        features.put("atrMean", 40.2d);
        features.put("adx", 27.1d);
        features.put("emaSlope", 0.43d);
        features.put("bodyPct", 0.68d);
        features.put("sweepDepthAtr", 0.52d);
        features.put("fvgSizeAtr", 0.43d);
        features.put("obSizeAtr", 0.71d);
        features.put("volatilityState", "EXPANDING");
        features.put("rangeState", "DIRECTIONAL");

        mockMvc.perform(post("/api/integrations/tradingview/signals/open")
                        .param("token", secret)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(openPayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INGESTED"))
                .andExpect(jsonPath("$.duplicate").value(false))
                .andExpect(jsonPath("$.externalTradeId").value(externalTradeId));

        SignalEvent storedEvent = signalEventRepository.findByUser_IdAndExternalTradeId(user.getId(), externalTradeId)
                .orElseThrow();
        assertThat(signalFeatureSnapshotRepository.findBySignalEvent_Id(storedEvent.getId())).isPresent();

        mockMvc.perform(post("/api/integrations/tradingview/signals/open")
                        .param("token", secret)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(openPayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DUPLICATE"))
                .andExpect(jsonPath("$.duplicate").value(true));

        mockMvc.perform(post("/api/integrations/tradingview/signals/close")
                        .param("token", secret)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "schemaVersion": "1.0",
                                  "eventType": "SIGNAL_CLOSE",
                                  "externalTradeId": "tv-BINANCE_BTCUSDT-15-1741888800000-long-sweepob",
                                  "symbol": "BINANCE:BTCUSDT",
                                  "timeframe": "15",
                                  "timestamp": 1741892400000,
                                  "result": "WIN",
                                  "pnlR": 2.0,
                                  "exitReason": "TP",
                                  "slippage": 0.0,
                                  "holdBars": 6
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INGESTED"))
                .andExpect(jsonPath("$.externalTradeId").value(externalTradeId));

        assertThat(signalOutcomeRepository.findBySignalEvent_Id(storedEvent.getId())).isPresent();
        assertThat(signalPerformanceAggregateRepository.findByUser_IdOrderByUpdatedAtDesc(user.getId())).hasSize(1);
    }

    @Test
    void rejectsMalformedOpenPayload() throws Exception {
        User user = userRepository.save(User.builder()
                .email("signal-validation@example.com")
                .passwordHash("hashed")
                .role(Role.USER)
                .baseCurrency("USD")
                .tradingviewWebhookEnabled(true)
                .tradingviewWebhookSecretHash(tradingViewWebhookAuthService.hashSecret("validation-secret"))
                .build());

        mockMvc.perform(post("/api/integrations/tradingview/signals/open")
                        .param("token", "validation-secret")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "schemaVersion": "1.0",
                                  "eventType": "SIGNAL_OPEN",
                                  "externalTradeId": "",
                                  "symbol": "BINANCE:BTCUSDT",
                                  "timeframe": "15",
                                  "timestamp": 1741888800000
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void analyticsEndpointsExposeSummaryBreakdownsAndRecommendations() throws Exception {
        User user = userRepository.save(User.builder()
                .email("signal-analytics@example.com")
                .passwordHash("hashed")
                .role(Role.USER)
                .baseCurrency("USD")
                .build());
        Mockito.when(currentUserService.getCurrentUser()).thenReturn(user);

        for (int index = 0; index < 12; index++) {
            OffsetDateTime openedAt = OffsetDateTime.parse("2026-02-01T08:00:00Z").plusDays(index);
            SignalEvent event = signalEventRepository.save(SignalEvent.builder()
                    .user(user)
                    .externalTradeId("analytics-signal-" + index)
                    .symbol("BINANCE:BTCUSDT")
                    .timeframe("15")
                    .eventType(SignalEventType.SIGNAL_OPEN)
                    .setupType(SignalSetupType.SWEEP_OB_REVERSAL)
                    .direction(Direction.LONG)
                    .signalTimestamp(openedAt)
                    .signalBarTime(openedAt)
                    .entryPrice(new BigDecimal("65000.0"))
                    .stopLoss(new BigDecimal("64875.0"))
                    .takeProfit(new BigDecimal("65250.0"))
                    .rr(new BigDecimal("2.0"))
                    .confidenceScore(70 + (index % 6))
                    .regime(SignalRegime.TREND)
                    .htfBias(SignalHtfBias.BULLISH)
                    .sessionName("LONDON_NY")
                    .parameterProfileId("AUTO_15_TREND_V1")
                    .schemaVersion("1.0")
                    .rawPayloadJson(objectMapper.createObjectNode())
                    .build());

            signalFeatureSnapshotRepository.save(SignalFeatureSnapshot.builder()
                    .signalEvent(event)
                    .atr(new BigDecimal("55.0"))
                    .atrMean(new BigDecimal("42.0"))
                    .adx(new BigDecimal("28.0"))
                    .emaSlope(new BigDecimal("0.44"))
                    .bodyPct(new BigDecimal("0.66"))
                    .sweepDepthAtr(new BigDecimal("0.58"))
                    .fvgSizeAtr(new BigDecimal("0.31"))
                    .obSizeAtr(new BigDecimal("0.74"))
                    .volatilityState("EXPANDING")
                    .rangeState("DIRECTIONAL")
                    .featureJson(objectMapper.createObjectNode())
                    .build());

            signalOutcomeRepository.save(SignalOutcome.builder()
                    .signalEvent(event)
                    .outcomeStatus(index < 8 ? SignalOutcomeStatus.WIN : SignalOutcomeStatus.LOSS)
                    .closeTimestamp(openedAt.plusMinutes(45))
                    .pnlR(index < 8 ? new BigDecimal("2.0") : new BigDecimal("-1.0"))
                    .holdBars(3 + (index % 3))
                    .holdMinutes(45)
                    .exitReason(index < 8 ? "TP" : "SL")
                    .slippage(BigDecimal.ZERO)
                    .rawPayloadJson(objectMapper.createObjectNode())
                    .build());
        }

        mockMvc.perform(get("/api/analytics/signals/summary")
                        .param("symbol", "BINANCE:BTCUSDT")
                        .param("timeframe", "15"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.overview.totalSignals").value(12))
                .andExpect(jsonPath("$.overview.closedSignals").value(12))
                .andExpect(jsonPath("$.topRecommendation.profileId").value("AUTO_15_TREND_V1"));

        mockMvc.perform(get("/api/analytics/signals/recommendations")
                        .param("symbol", "BINANCE:BTCUSDT")
                        .param("timeframe", "15"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendations[0].profileId").value("AUTO_15_TREND_V1"));

        mockMvc.perform(get("/api/analytics/signals/by-setup")
                        .param("symbol", "BINANCE:BTCUSDT")
                        .param("timeframe", "15"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].key").value("SWEEP_OB_REVERSAL"))
                .andExpect(jsonPath("$.rows[0].sampleSize").value(12));

        mockMvc.perform(get("/api/analytics/signals/by-regime")
                        .param("symbol", "BINANCE:BTCUSDT")
                        .param("timeframe", "15"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].key").value("TREND"));

        mockMvc.perform(get("/api/analytics/signals/by-symbol-timeframe"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].symbol").value("BINANCE:BTCUSDT"))
                .andExpect(jsonPath("$.rows[0].timeframe").value("15"))
                .andExpect(jsonPath("$.rows[0].recommendedProfileId").value("AUTO_15_TREND_V1"));
    }
}
