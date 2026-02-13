package com.tradevault.repository;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.Role;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.repository.spec.TradeSpecifications;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

@SpringBootTest
@Testcontainers
class TradeSearchCaseInsensitiveTest {

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
    TradeRepository tradeRepository;

    @Autowired
    UserRepository userRepository;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @AfterEach
    void cleanUp() {
        tradeRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void columnsAreTextual() {
        String symbolType = jdbcTemplate.queryForObject(
                "SELECT data_type FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'symbol'",
                String.class
        );
        String strategyType = jdbcTemplate.queryForObject(
                "SELECT data_type FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'strategy_tag'",
                String.class
        );

        assertThat(symbolType).isIn("character varying", "text", "citext");
        assertThat(strategyType).isIn("character varying", "text", "citext");
    }

    @Test
    void searchMatchesSymbolAndStrategyIgnoringCase() {
        User user = userRepository.save(User.builder()
                .id(UUID.randomUUID())
                .email("search@test.com")
                .passwordHash("hash")
                .role(Role.USER)
                .timezone("Europe/Bucharest")
                .build());

        tradeRepository.save(Trade.builder()
                .user(user)
                .symbol("AAPL")
                .market(Market.STOCK)
                .direction(Direction.LONG)
                .status(TradeStatus.CLOSED)
                .openedAt(OffsetDateTime.now().minusDays(2))
                .closedAt(OffsetDateTime.now().minusDays(1))
                .quantity(new BigDecimal("1"))
                .entryPrice(new BigDecimal("100"))
                .strategyTag("BreakOut")
                .build());

        var page = tradeRepository.findAll(
                Specification.where(TradeSpecifications.userId(user.getId()))
                        .and(TradeSpecifications.symbolEqualsIgnoreCase("aapl"))
                        .and(TradeSpecifications.strategyEqualsIgnoreCase("breakout"))
                        .and(TradeSpecifications.status(TradeStatus.CLOSED)),
                PageRequest.of(0, 10)
        );

        assertThat(page.getContent()).hasSize(1);
        assertThat(page.getContent().get(0).getSymbol()).isEqualTo("AAPL");
    }

    @Test
    void searchTradeIdsAcceptsNullOptionalFilters() {
        User user = userRepository.save(User.builder()
                .id(UUID.randomUUID())
                .email("search-null-params@test.com")
                .passwordHash("hash")
                .role(Role.USER)
                .timezone("Europe/Bucharest")
                .build());

        tradeRepository.save(Trade.builder()
                .user(user)
                .symbol("AAPL")
                .market(Market.STOCK)
                .direction(Direction.LONG)
                .status(TradeStatus.CLOSED)
                .openedAt(OffsetDateTime.parse("2026-02-10T10:00:00Z"))
                .closedAt(OffsetDateTime.parse("2026-02-10T11:00:00Z"))
                .quantity(new BigDecimal("1"))
                .entryPrice(new BigDecimal("100"))
                .build());

        assertThatCode(() -> tradeRepository.searchTradeIds(
                user.getId(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                PageRequest.of(0, 20)
        )).doesNotThrowAnyException();

        var result = tradeRepository.searchTradeIds(
                user.getId(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                PageRequest.of(0, 20)
        );
        assertThat(result.getTotalElements()).isEqualTo(1);
        assertThat(result.getContent()).hasSize(1);
    }

    @Test
    void searchTradeIdsSupportsEachFilterIndividually() {
        User user = userRepository.save(User.builder()
                .id(UUID.randomUUID())
                .email("search-per-filter@test.com")
                .passwordHash("hash")
                .role(Role.USER)
                .timezone("Europe/Bucharest")
                .build());

        tradeRepository.save(Trade.builder()
                .user(user)
                .symbol("AAPL")
                .market(Market.STOCK)
                .direction(Direction.LONG)
                .status(TradeStatus.CLOSED)
                .openedAt(OffsetDateTime.parse("2026-02-10T10:00:00Z"))
                .closedAt(OffsetDateTime.parse("2026-02-10T11:00:00Z"))
                .quantity(new BigDecimal("1"))
                .entryPrice(new BigDecimal("100"))
                .strategyTag("BreakOut")
                .build());

        tradeRepository.save(Trade.builder()
                .user(user)
                .symbol("MSFT")
                .market(Market.STOCK)
                .direction(Direction.SHORT)
                .status(TradeStatus.OPEN)
                .openedAt(OffsetDateTime.parse("2026-02-09T10:00:00Z"))
                .closedAt(null)
                .quantity(new BigDecimal("1"))
                .entryPrice(new BigDecimal("100"))
                .strategyTag("Trend")
                .build());

        var pageable = PageRequest.of(0, 20);
        assertThat(tradeRepository.searchTradeIds(user.getId(), null, null, null, null, "aapl", null, null, null, pageable).getContent())
                .hasSize(1);
        assertThat(tradeRepository.searchTradeIds(user.getId(), null, null, null, null, null, "breakout", null, null, pageable).getContent())
                .hasSize(1);
        assertThat(tradeRepository.searchTradeIds(user.getId(), null, null, null, null, null, null, Direction.LONG, null, pageable).getContent())
                .hasSize(1);
        assertThat(tradeRepository.searchTradeIds(user.getId(), null, null, null, null, null, null, null, TradeStatus.OPEN, pageable).getContent())
                .hasSize(1);
        assertThat(tradeRepository.searchTradeIds(
                user.getId(),
                OffsetDateTime.parse("2026-02-10T00:00:00Z"),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                pageable).getContent())
                .hasSize(1);
        assertThat(tradeRepository.searchTradeIds(
                user.getId(),
                null,
                OffsetDateTime.parse("2026-02-09T23:59:59Z"),
                null,
                null,
                null,
                null,
                null,
                null,
                pageable).getContent())
                .hasSize(1);
        assertThat(tradeRepository.searchTradeIds(
                user.getId(),
                null,
                null,
                OffsetDateTime.parse("2026-02-10T00:00:00Z"),
                null,
                null,
                null,
                null,
                null,
                pageable).getContent())
                .hasSize(1);
        assertThat(tradeRepository.searchTradeIds(
                user.getId(),
                null,
                null,
                null,
                OffsetDateTime.parse("2026-02-10T23:59:59Z"),
                null,
                null,
                null,
                null,
                pageable).getContent())
                .hasSize(1);
    }
}
