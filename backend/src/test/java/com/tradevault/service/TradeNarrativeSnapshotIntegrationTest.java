package com.tradevault.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.domain.entity.TodaySession;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.Role;
import com.tradevault.domain.enums.TodaySessionStatus;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.session.CloseSessionTradeRequest;
import com.tradevault.dto.trade.TradeRequest;
import com.tradevault.dto.trade.TradeResponse;
import com.tradevault.repository.TodaySessionRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.repository.UserRepository;
import com.tradevault.service.today.TodaySessionService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
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
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@Testcontainers
class TradeNarrativeSnapshotIntegrationTest {

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
    private TradeService tradeService;

    @Autowired
    private TodaySessionService todaySessionService;

    @Autowired
    private TradeRepository tradeRepository;

    @Autowired
    private TodaySessionRepository todaySessionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private CurrentUserService currentUserService;

    @AfterEach
    void cleanUp() {
        tradeRepository.deleteAll();
        todaySessionRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void createWithoutNarrativeSnapshotPersistsEmptyJsonObject() {
        User user = persistAndMockCurrentUser("narrative-create@example.com");

        TradeRequest request = baseTradeRequest();
        request.setStatus(TradeStatus.OPEN);
        request.setClosedAt(null);
        request.setExitPrice(null);

        TradeResponse response = tradeService.create(request);
        Trade saved = tradeRepository.findByIdAndUserId(response.getId(), user.getId()).orElseThrow();

        assertThat(saved.getNarrativeSnapshotJson()).isNotNull();
        assertThat(saved.getNarrativeSnapshotJson().isObject()).isTrue();
        assertThat(saved.getNarrativeSnapshotJson().size()).isZero();
    }

    @Test
    void updateUnrelatedFieldsPreservesExistingNarrativeSnapshotWhenRequestOmitsIt() {
        User user = persistAndMockCurrentUser("narrative-update@example.com");
        ObjectNode existingSnapshot = objectMapper.createObjectNode().put("source", "session");
        Trade existing = persistTrade(user, null, existingSnapshot);

        TradeRequest update = baseTradeRequest();
        update.setSymbol(existing.getSymbol());
        update.setMarket(existing.getMarket());
        update.setDirection(existing.getDirection());
        update.setStatus(existing.getStatus());
        update.setOpenedAt(existing.getOpenedAt());
        update.setClosedAt(existing.getClosedAt());
        update.setQuantity(existing.getQuantity());
        update.setEntryPrice(existing.getEntryPrice());
        update.setExitPrice(existing.getExitPrice());
        update.setNotes("updated notes only");
        update.setNarrativeSnapshotJson(null);

        tradeService.update(existing.getId(), update);
        Trade reloaded = tradeRepository.findByIdAndUserId(existing.getId(), user.getId()).orElseThrow();

        assertThat(reloaded.getNarrativeSnapshotJson()).isNotNull();
        assertThat(reloaded.getNarrativeSnapshotJson()).isEqualTo(existingSnapshot);
    }

    @Test
    void closeTradePreservesNarrativeSnapshotWhenCloseRequestHasNoNarrativeField() {
        User user = persistAndMockCurrentUser("narrative-close@example.com");
        TodaySession session = todaySessionRepository.save(TodaySession.builder()
                .user(user)
                .sessionDate(LocalDate.now(ZoneId.of(TimezoneService.DEFAULT_TIMEZONE)))
                .profitTarget(new BigDecimal("250"))
                .lossLimit(new BigDecimal("100"))
                .maxTrades(3)
                .status(TodaySessionStatus.ACTIVE)
                .build());
        ObjectNode snapshot = objectMapper.createObjectNode().put("htfDraw", "PDH");
        Trade openTrade = persistTrade(user, session.getId(), snapshot);

        CloseSessionTradeRequest close = new CloseSessionTradeRequest();
        close.setExitPrice(openTrade.getEntryPrice().add(new BigDecimal("0.0050")));

        todaySessionService.closeTrade(openTrade.getId(), close);
        Trade closedTrade = tradeRepository.findByIdAndUserId(openTrade.getId(), user.getId()).orElseThrow();

        assertThat(closedTrade.getStatus()).isEqualTo(TradeStatus.CLOSED);
        assertThat(closedTrade.getNarrativeSnapshotJson()).isNotNull();
        assertThat(closedTrade.getNarrativeSnapshotJson()).isEqualTo(snapshot);
    }

    @Test
    void controllerCreateWithoutNarrativeSnapshotDoesNotTriggerIntegrityViolation() throws Exception {
        User user = persistAndMockCurrentUser("narrative-controller@example.com");
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("symbol", "EURUSD");
        payload.put("market", "FOREX");
        payload.put("direction", "LONG");
        payload.put("status", "OPEN");
        payload.put("openedAt", "2026-02-23T10:00:00Z");
        payload.put("quantity", new BigDecimal("1.0000"));
        payload.put("entryPrice", new BigDecimal("1.080000"));
        payload.put("fees", BigDecimal.ZERO);
        payload.put("commission", BigDecimal.ZERO);
        payload.put("slippage", BigDecimal.ZERO);

        MvcResult result = mockMvc.perform(post("/api/trades")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        UUID tradeId = UUID.fromString(body.get("id").asText());
        Trade saved = tradeRepository.findByIdAndUserId(tradeId, user.getId()).orElseThrow();

        assertThat(saved.getNarrativeSnapshotJson()).isNotNull();
        assertThat(saved.getNarrativeSnapshotJson().isObject()).isTrue();
        assertThat(saved.getNarrativeSnapshotJson().size()).isZero();
    }

    private User persistAndMockCurrentUser(String email) {
        User persisted = userRepository.save(User.builder()
                .email(email)
                .passwordHash("hashed")
                .role(Role.USER)
                .timezone(TimezoneService.DEFAULT_TIMEZONE)
                .baseCurrency("USD")
                .build());
        User detachedPrincipal = User.builder()
                .id(persisted.getId())
                .email(persisted.getEmail())
                .passwordHash("hashed")
                .role(Role.USER)
                .timezone(TimezoneService.DEFAULT_TIMEZONE)
                .baseCurrency("USD")
                .build();
        when(currentUserService.getCurrentUser()).thenReturn(detachedPrincipal);
        return persisted;
    }

    private Trade persistTrade(User user, UUID sessionId, JsonNode narrativeSnapshot) {
        OffsetDateTime now = OffsetDateTime.now();
        return tradeRepository.save(Trade.builder()
                .user(user)
                .symbol("EURUSD")
                .market(Market.FOREX)
                .direction(Direction.LONG)
                .status(TradeStatus.OPEN)
                .openedAt(now.minusMinutes(15))
                .quantity(new BigDecimal("1.0000"))
                .entryPrice(new BigDecimal("1.080000"))
                .fees(BigDecimal.ZERO)
                .commission(BigDecimal.ZERO)
                .slippage(BigDecimal.ZERO)
                .sessionId(sessionId)
                .narrativeSnapshotJson(narrativeSnapshot)
                .createdAt(now.minusMinutes(15))
                .updatedAt(now.minusMinutes(15))
                .build());
    }

    private TradeRequest baseTradeRequest() {
        TradeRequest request = new TradeRequest();
        request.setSymbol("EURUSD");
        request.setMarket(Market.FOREX);
        request.setDirection(Direction.LONG);
        request.setStatus(TradeStatus.CLOSED);
        request.setOpenedAt(OffsetDateTime.parse("2026-02-23T10:00:00Z"));
        request.setClosedAt(OffsetDateTime.parse("2026-02-23T11:00:00Z"));
        request.setQuantity(new BigDecimal("1.0000"));
        request.setEntryPrice(new BigDecimal("1.080000"));
        request.setExitPrice(new BigDecimal("1.085000"));
        request.setFees(BigDecimal.ZERO);
        request.setCommission(BigDecimal.ZERO);
        request.setSlippage(BigDecimal.ZERO);
        return request;
    }
}
