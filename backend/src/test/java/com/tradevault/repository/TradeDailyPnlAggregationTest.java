package com.tradevault.repository;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.Role;
import com.tradevault.domain.enums.TradeStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Testcontainers
class TradeDailyPnlAggregationTest {

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

    @AfterEach
    void cleanUp() {
        tradeRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void aggregatesByLocalCloseDateAndExcludesOpenTrades() {
        User user = userRepository.save(User.builder()
                .id(UUID.randomUUID())
                .email("calendar@test.com")
                .passwordHash("hash")
                .role(Role.USER)
                .timezone("Europe/Bucharest")
                .build());

        tradeRepository.save(buildTrade(user,
                TradeStatus.CLOSED,
                OffsetDateTime.of(LocalDateTime.of(2024, 1, 1, 22, 30), ZoneOffset.UTC),
                new BigDecimal("100")));
        tradeRepository.save(buildTrade(user,
                TradeStatus.CLOSED,
                OffsetDateTime.of(LocalDateTime.of(2024, 1, 2, 21, 30), ZoneOffset.UTC),
                new BigDecimal("-40")));
        tradeRepository.save(buildTrade(user,
                TradeStatus.CLOSED,
                OffsetDateTime.of(LocalDateTime.of(2024, 1, 1, 10, 0), ZoneOffset.UTC),
                new BigDecimal("55")));
        tradeRepository.save(buildTrade(user,
                TradeStatus.OPEN,
                OffsetDateTime.of(LocalDateTime.of(2024, 1, 2, 5, 0), ZoneOffset.UTC),
                new BigDecimal("999")));

        var results = tradeRepository.aggregateDailyPnlByClosedDate(
                user.getId(),
                LocalDate.of(2024, 1, 1),
                LocalDate.of(2024, 1, 2),
                "Europe/Bucharest"
        );

        Map<LocalDate, TradeRepository.DailyPnlAggregate> byDate = results.stream()
                .collect(Collectors.toMap(TradeRepository.DailyPnlAggregate::getDate, r -> r));

        assertThat(byDate).containsKeys(LocalDate.of(2024, 1, 1), LocalDate.of(2024, 1, 2));
        assertThat(byDate.get(LocalDate.of(2024, 1, 1)).getNetPnl()).isEqualByComparingTo("55");
        assertThat(byDate.get(LocalDate.of(2024, 1, 1)).getTradeCount()).isEqualTo(1);
        assertThat(byDate.get(LocalDate.of(2024, 1, 1)).getWins()).isEqualTo(1);
        assertThat(byDate.get(LocalDate.of(2024, 1, 1)).getLosses()).isEqualTo(0);

        assertThat(byDate.get(LocalDate.of(2024, 1, 2)).getNetPnl()).isEqualByComparingTo("60");
        assertThat(byDate.get(LocalDate.of(2024, 1, 2)).getTradeCount()).isEqualTo(2);
        assertThat(byDate.get(LocalDate.of(2024, 1, 2)).getWins()).isEqualTo(1);
        assertThat(byDate.get(LocalDate.of(2024, 1, 2)).getLosses()).isEqualTo(1);
    }

    private Trade buildTrade(User user, TradeStatus status, OffsetDateTime closedAt, BigDecimal pnlNet) {
        return Trade.builder()
                .user(user)
                .symbol("AAPL")
                .market(Market.STOCK)
                .direction(Direction.LONG)
                .status(status)
                .openedAt(closedAt.minusHours(2))
                .closedAt(closedAt)
                .quantity(new BigDecimal("1"))
                .entryPrice(new BigDecimal("100"))
                .exitPrice(new BigDecimal("110"))
                .pnlNet(pnlNet)
                .build();
    }
}
