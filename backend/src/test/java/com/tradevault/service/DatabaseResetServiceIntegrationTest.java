package com.tradevault.service;

import com.tradevault.dto.maintenance.DatabaseResetRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class DatabaseResetServiceIntegrationTest {
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
        registry.add("storage.s3.enabled", () -> false);
        registry.add("app.maintenance.database-reset-enabled", () -> true);
    }

    @Autowired
    private DatabaseResetService databaseResetService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @AfterEach
    void cleanup() {
        jdbcTemplate.update("DELETE FROM accounts");
        jdbcTemplate.update("DELETE FROM users");
    }

    @Test
    void resetDeletesBusinessRowsAndPreservesUserAccountRows() {
        UUID userId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID tradeId = UUID.randomUUID();
        UUID runId = UUID.randomUUID();
        UUID backtestTradeId = UUID.randomUUID();
        UUID notebookNoteId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();

        jdbcTemplate.update("""
                INSERT INTO users (id, email, password_hash, role, base_currency, timezone)
                VALUES (?, ?, ?, 'SUPER_ADMIN', 'USD', 'Europe/Bucharest')
                """, userId, "super-admin@example.com", passwordEncoder.encode("Password1!"));
        jdbcTemplate.update("""
                INSERT INTO accounts (id, user_id, name, broker, account_currency, starting_balance)
                VALUES (?, ?, 'Primary', 'Manual', 'USD', ?)
                """, accountId, userId, BigDecimal.valueOf(10000));
        jdbcTemplate.update("""
                INSERT INTO trades (
                    id, user_id, account_id, symbol, market, direction, status, opened_at,
                    quantity, entry_price, fees, commission, slippage
                )
                VALUES (?, ?, ?, 'EURUSD', 'FOREX'::market_type, 'LONG'::direction_type, 'OPEN'::status_type, ?, ?, ?, 0, 0, 0)
                """, tradeId, userId, accountId, OffsetDateTime.now(), BigDecimal.ONE, BigDecimal.valueOf(1.1));
        jdbcTemplate.update("""
                INSERT INTO backtest_runs (id, user_id, symbol, timeframe, range_from, range_to, provider, status, candle_count)
                VALUES (?, ?, 'EURUSD', 'M15', ?, ?, 'OANDA', 'READY', 0)
                """, runId, userId, OffsetDateTime.now().minusDays(1), OffsetDateTime.now());
        jdbcTemplate.update("""
                INSERT INTO backtest_trades (
                    id, run_id, user_id, symbol, direction, order_type, entry_price, stop_loss_price, break_even
                )
                VALUES (?, ?, ?, 'EURUSD', 'LONG', 'MARKET', ?, ?, false)
                """, backtestTradeId, runId, userId, BigDecimal.valueOf(1.1), BigDecimal.valueOf(1.0));
        jdbcTemplate.update("""
                INSERT INTO notebook_note (id, user_id, type, title, body)
                VALUES (?, ?, 'NOTE'::notebook_note_type, 'Reset note', 'Delete me')
                """, notebookNoteId, userId);
        jdbcTemplate.update("""
                INSERT INTO today_sessions (id, user_id, session_date, profit_target, loss_limit, max_trades)
                VALUES (?, ?, CURRENT_DATE, 500, 250, 3)
                """, sessionId, userId);

        var response = databaseResetService.resetData(validRequest(),
                new TestingAuthenticationToken("super-admin@example.com", "n/a", "ROLE_SUPER_ADMIN"));

        assertThat(response.getDeletedRows()).containsEntry("trades", 1);
        assertThat(response.getDeletedRows()).containsEntry("backtest_trades", 1);
        assertThat(response.getDeletedRows()).containsEntry("backtest_runs", 1);
        assertThat(response.getDeletedRows()).containsEntry("notebook_note", 1);
        assertThat(response.getDeletedRows()).containsEntry("today_sessions", 1);
        assertThat(response.getPreserved()).contains("users", "accounts");

        assertThat(count("users")).isEqualTo(1);
        assertThat(count("accounts")).isEqualTo(1);
        assertThat(count("trades")).isZero();
        assertThat(count("backtest_trades")).isZero();
        assertThat(count("backtest_runs")).isZero();
        assertThat(count("notebook_note")).isZero();
        assertThat(count("today_sessions")).isZero();
    }

    private DatabaseResetRequest validRequest() {
        DatabaseResetRequest request = new DatabaseResetRequest();
        request.setConfirmation("RESET_TRADEJAUDIT_DATABASE_DATA");
        request.setPreserveUsers(true);
        request.setPassword("Password1!");
        return request;
    }

    private int count(String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }
}
