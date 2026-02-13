package com.tradevault.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Role;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.repository.TradeRepository;
import com.tradevault.repository.UserRepository;
import com.tradevault.service.CurrentUserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@Testcontainers
class AnalyticsControllerTest {

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
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    UserRepository userRepository;

    @Autowired
    TradeRepository tradeRepository;

    @MockBean
    CurrentUserService currentUserService;

    @AfterEach
    void cleanUp() {
        tradeRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void summaryEndpointReturnsAggregatedKpis() throws Exception {
        User user = userRepository.save(User.builder()
                .email("analytics@example.com")
                .passwordHash("hashed")
                .role(Role.USER)
                .baseCurrency("USD")
                .build());
        Mockito.when(currentUserService.getCurrentUser()).thenReturn(user);

        Trade linkedTrade = Trade.builder()
                .user(user)
                .symbol("AAPL")
                .direction(Direction.LONG)
                .status(TradeStatus.CLOSED)
                .openedAt(OffsetDateTime.parse("2026-01-02T10:00:00Z"))
                .closedAt(OffsetDateTime.parse("2026-01-02T10:10:00Z"))
                .pnlNet(new BigDecimal("125.50"))
                .pnlGross(new BigDecimal("130.00"))
                .linkedContentIds(Set.of(UUID.randomUUID()))
                .build();
        Trade unlinkedTrade = Trade.builder()
                .user(user)
                .symbol("MSFT")
                .direction(Direction.SHORT)
                .status(TradeStatus.CLOSED)
                .openedAt(OffsetDateTime.parse("2026-01-03T11:00:00Z"))
                .closedAt(OffsetDateTime.parse("2026-01-03T11:20:00Z"))
                .pnlNet(new BigDecimal("-25.50"))
                .pnlGross(new BigDecimal("-20.00"))
                .build();
        tradeRepository.saveAll(java.util.List.of(linkedTrade, unlinkedTrade));

        mockMvc.perform(get("/api/analytics/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kpi.totalTrades").value(2))
                .andExpect(jsonPath("$.kpi.totalPnlNet").value(100.00))
                .andExpect(jsonPath("$.planAdherence.linkedTrades").value(1))
                .andExpect(jsonPath("$.planAdherence.unlinkedTrades").value(1))
                .andExpect(jsonPath("$.planAdherence.linkedPct").value(50.0));
    }
}
