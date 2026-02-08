package com.tradevault.controller;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
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
import java.time.LocalDate;
import java.time.OffsetDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@Testcontainers
class TradeControllerSearchTest {

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
    void searchEndpointMatchesSymbolAndStrategyIgnoringCase() throws Exception {
        User user = createUser("search-controller@example.com");
        Mockito.when(currentUserService.getCurrentUser()).thenReturn(user);

        saveTrade(user, "AAPL", "BreakOut", Direction.LONG, TradeStatus.CLOSED,
                OffsetDateTime.parse("2026-01-02T10:00:00Z"),
                OffsetDateTime.parse("2026-01-02T10:10:00Z"));

        mockMvc.perform(get("/api/trades/search")
                        .param("symbol", "aapl")
                        .param("strategy", "breakout"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].symbol").value("AAPL"))
                .andExpect(jsonPath("$.content[0].strategyTag").value("BreakOut"));
    }

    @Test
    void searchEndpointHandlesEmptyFiltersAndSorting() throws Exception {
        User user = createUser("search-empty@example.com");
        Mockito.when(currentUserService.getCurrentUser()).thenReturn(user);

        saveTrade(user, "TSLA", "Momentum", Direction.SHORT, TradeStatus.CLOSED,
                OffsetDateTime.parse("2026-01-02T09:00:00Z"),
                OffsetDateTime.parse("2026-01-02T09:15:00Z"));
        saveTrade(user, "AAPL", "BreakOut", Direction.LONG, TradeStatus.CLOSED,
                OffsetDateTime.parse("2026-01-03T10:00:00Z"),
                OffsetDateTime.parse("2026-01-03T10:20:00Z"));

        mockMvc.perform(get("/api/trades/search")
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].symbol").value("AAPL"))
                .andExpect(jsonPath("$.content[1].symbol").value("TSLA"));
    }

    @Test
    void searchEndpointSupportsClosedDateAndRangeFilters() throws Exception {
        User user = createUser("search-dates@example.com");
        Mockito.when(currentUserService.getCurrentUser()).thenReturn(user);

        saveTrade(user, "NVDA", "BreakOut", Direction.LONG, TradeStatus.CLOSED,
                OffsetDateTime.parse("2026-01-04T10:00:00Z"),
                OffsetDateTime.parse("2026-01-05T10:00:00Z"));

        mockMvc.perform(get("/api/trades/search")
                        .param("closedDate", LocalDate.parse("2026-01-05").toString())
                        .param("tz", "UTC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1));

        mockMvc.perform(get("/api/trades/search")
                        .param("openedAtFrom", "2026-01-04T00:00:00Z")
                        .param("openedAtTo", "2026-01-04T23:59:59Z"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1));

        mockMvc.perform(get("/api/trades/search")
                        .param("closedAtFrom", "2026-01-05T00:00:00Z")
                        .param("closedAtTo", "2026-01-05T23:59:59Z"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1));
    }

    @Test
    void searchEndpointSupportsIndividualAndCombinedFilters() throws Exception {
        User user = createUser("search-filters@example.com");
        Mockito.when(currentUserService.getCurrentUser()).thenReturn(user);

        saveTrade(user, "MSFT", "Trend", Direction.LONG, TradeStatus.OPEN,
                OffsetDateTime.parse("2026-01-06T10:00:00Z"),
                null);

        mockMvc.perform(get("/api/trades/search")
                        .param("symbol", "msft"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1));

        mockMvc.perform(get("/api/trades/search")
                        .param("strategy", "trend"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1));

        mockMvc.perform(get("/api/trades/search")
                        .param("direction", "LONG"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1));

        mockMvc.perform(get("/api/trades/search")
                        .param("status", "OPEN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1));

        mockMvc.perform(get("/api/trades/search")
                        .param("symbol", "msft")
                        .param("strategy", "trend")
                        .param("direction", "LONG")
                        .param("status", "OPEN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1));
    }

    private User createUser(String email) {
        return userRepository.save(User.builder()
                .email(email)
                .passwordHash("hashed")
                .role(Role.USER)
                .build());
    }

    private Trade saveTrade(User user, String symbol, String strategy, Direction direction, TradeStatus status,
                            OffsetDateTime openedAt, OffsetDateTime closedAt) {
        return tradeRepository.save(Trade.builder()
                .user(user)
                .symbol(symbol)
                .market(Market.STOCK)
                .direction(direction)
                .status(status)
                .openedAt(openedAt)
                .closedAt(closedAt)
                .quantity(new BigDecimal("1"))
                .entryPrice(new BigDecimal("100"))
                .strategyTag(strategy)
                .createdAt(openedAt)
                .build());
    }
}
