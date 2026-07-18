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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Testcontainers
class TradeMonthlyPnlAggregationTest {

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
    void aggregatesMonthlySummaryByLocalCloseMonth() {
        User user = userRepository.save(User.builder()
                .id(UUID.randomUUID())
                .email("calendar-month@test.com")
                .passwordHash("hash")
                .role(Role.USER)
                .timezone("Europe/Bucharest")
                .build());

        tradeRepository.save(buildTrade(user,
                TradeStatus.CLOSED,
                OffsetDateTime.of(LocalDateTime.of(2026, 1, 31, 22, 30), ZoneOffset.UTC),
                new BigDecimal("100"),
                new BigDecimal("120")));
        tradeRepository.save(buildTrade(user,
                TradeStatus.CLOSED,
                OffsetDateTime.of(LocalDateTime.of(2026, 2, 15, 10, 0), ZoneOffset.UTC),
                new BigDecimal("-40"),
                new BigDecimal("-30")));
        tradeRepository.save(buildTrade(user,
                TradeStatus.CLOSED,
                OffsetDateTime.of(LocalDateTime.of(2026, 2, 28, 21, 30), ZoneOffset.UTC),
                new BigDecimal("60"),
                new BigDecimal("70")));
        tradeRepository.save(buildTrade(user,
                TradeStatus.CLOSED,
                OffsetDateTime.of(LocalDateTime.of(2026, 3, 1, 0, 30), ZoneOffset.UTC),
                new BigDecimal("25"),
                new BigDecimal("30")));
        tradeRepository.save(buildTrade(user,
                TradeStatus.OPEN,
                null,
                new BigDecimal("999"),
                new BigDecimal("999")));

        TradeRepository.MonthlyPnlAggregate result = tradeRepository.aggregateMonthlyPnlByClosedDate(
                user.getId(),
                LocalDate.of(2026, 2, 1),
                LocalDate.of(2026, 2, 28),
                "Europe/Bucharest",
                null,
                null,
                false
        );

        assertThat(result).isNotNull();
        assertThat(result.getNetPnl()).isEqualByComparingTo("120");
        assertThat(result.getGrossPnl()).isEqualByComparingTo("160");
        assertThat(result.getTradeCount()).isEqualTo(3);
        assertThat(result.getTradingDays()).isEqualTo(3);
    }

    @Test
    void filtersAccountsBeforeAggregationIncludingUnassignedAndUserScope() {
        User user = saveUser("calendar-accounts@test.com");
        User otherUser = saveUser("other-calendar@test.com");
        OffsetDateTime closedAt = OffsetDateTime.of(LocalDateTime.of(2026, 7, 16, 12, 0), ZoneOffset.UTC);

        tradeRepository.save(withBrokerAccount(buildTrade(user, TradeStatus.CLOSED, closedAt,
                new BigDecimal("-100"), new BigDecimal("-90")), " Account A "));
        tradeRepository.save(withBrokerAccount(buildTrade(user, TradeStatus.CLOSED, closedAt,
                new BigDecimal("200"), new BigDecimal("210")), "Account B"));
        tradeRepository.save(buildTrade(user, TradeStatus.CLOSED, closedAt,
                new BigDecimal("-50"), new BigDecimal("-45")));
        tradeRepository.save(withBrokerAccount(buildTrade(otherUser, TradeStatus.CLOSED, closedAt,
                new BigDecimal("999"), new BigDecimal("999")), "Account A"));

        assertThat(monthly(user, null, false).getNetPnl()).isEqualByComparingTo("50");
        assertThat(monthly(user, "account a", false).getNetPnl()).isEqualByComparingTo("-100");
        assertThat(monthly(user, "Account B", false).getNetPnl()).isEqualByComparingTo("200");
        assertThat(monthly(user, null, true).getNetPnl()).isEqualByComparingTo("-50");
    }

    @Test
    void reassignmentMovesTradeBetweenAccountCalendarsWithoutChangingAllAccounts() {
        User user = saveUser("calendar-reassignment@test.com");
        OffsetDateTime closedAt = OffsetDateTime.of(LocalDateTime.of(2026, 7, 16, 12, 0), ZoneOffset.UTC);
        Trade trade = tradeRepository.save(withBrokerAccount(buildTrade(user, TradeStatus.CLOSED, closedAt,
                new BigDecimal("75"), new BigDecimal("80")), "Account A"));

        assertThat(monthly(user, "Account A", false).getNetPnl()).isEqualByComparingTo("75");
        assertThat(monthly(user, null, false).getNetPnl()).isEqualByComparingTo("75");

        trade.setBrokerAccountId("Account B");
        tradeRepository.saveAndFlush(trade);
        assertThat(monthly(user, "Account A", false).getTradeCount()).isZero();
        assertThat(monthly(user, "Account B", false).getNetPnl()).isEqualByComparingTo("75");
        assertThat(monthly(user, null, false).getNetPnl()).isEqualByComparingTo("75");

        trade.setBrokerAccountId(null);
        tradeRepository.saveAndFlush(trade);
        assertThat(monthly(user, "Account B", false).getTradeCount()).isZero();
        assertThat(monthly(user, null, true).getNetPnl()).isEqualByComparingTo("75");
    }

    private User saveUser(String email) {
        return userRepository.save(User.builder()
                .id(UUID.randomUUID())
                .email(email)
                .passwordHash("hash")
                .role(Role.USER)
                .timezone("Europe/Bucharest")
                .build());
    }

    private Trade withBrokerAccount(Trade trade, String accountId) {
        trade.setBrokerAccountId(accountId);
        return trade;
    }

    private TradeRepository.MonthlyPnlAggregate monthly(User user, String accountId, boolean unassigned) {
        return tradeRepository.aggregateMonthlyPnlByClosedDate(
                user.getId(), LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31),
                "Europe/Bucharest", accountId, null, unassigned
        );
    }

    private Trade buildTrade(User user, TradeStatus status, OffsetDateTime closedAt, BigDecimal pnlNet, BigDecimal pnlGross) {
        OffsetDateTime openedAt = closedAt != null ? closedAt.minusHours(2) : OffsetDateTime.of(LocalDateTime.of(2026, 2, 1, 9, 0), ZoneOffset.UTC);
        return Trade.builder()
                .user(user)
                .symbol("AAPL")
                .market(Market.STOCK)
                .direction(Direction.LONG)
                .status(status)
                .openedAt(openedAt)
                .closedAt(closedAt)
                .quantity(new BigDecimal("1"))
                .entryPrice(new BigDecimal("100"))
                .exitPrice(new BigDecimal("110"))
                .pnlNet(pnlNet)
                .pnlGross(pnlGross)
                .build();
    }
}
