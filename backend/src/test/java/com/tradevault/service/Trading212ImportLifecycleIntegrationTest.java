package com.tradevault.service;

import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.InstrumentAlias;
import com.tradevault.domain.entity.NotebookNote;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.NotebookNoteType;
import com.tradevault.domain.enums.Role;
import com.tradevault.domain.enums.TradeSource;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.trade.TradeDataDeletionRequest;
import com.tradevault.dto.tradeimport.Trading212ImportCommitRequest;
import com.tradevault.dto.tradeimport.Trading212ImportCommitResponse;
import com.tradevault.dto.tradeimport.Trading212ImportPreviewResponse;
import com.tradevault.repository.AccountRepository;
import com.tradevault.repository.InstrumentAliasRepository;
import com.tradevault.repository.NotebookNoteRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = {
        "spring.task.scheduling.enabled=false",
        "spring.jpa.open-in-view=false",
        "app.frontend-url=http://localhost:5173",
        "jwt.secret=gPPiP7wvLam06Gus3EkRczpfZcJ8nDKF6FENCylIyvg=",
        "storage.s3.enabled=false",
        "logging.level.org.hibernate.SQL=WARN",
        "logging.level.org.hibernate.orm.jdbc.bind=WARN"
})
@EnabledIfEnvironmentVariable(named = "TRADING212_IT_DB_URL", matches = ".+")
@EnabledIfSystemProperty(named = "trading212.fixture", matches = ".+")
class Trading212ImportLifecycleIntegrationTest {

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> System.getenv("TRADING212_IT_DB_URL"));
        registry.add("spring.datasource.username",
                () -> environmentOrDefault("TRADING212_IT_DB_USER", System.getProperty("user.name")));
        registry.add("spring.datasource.password",
                () -> environmentOrDefault("TRADING212_IT_DB_PASSWORD", ""));
    }

    @Autowired Trading212TradeImportService importService;
    @Autowired TradeDataManagementService dataManagementService;
    @Autowired UserRepository userRepository;
    @Autowired AccountRepository accountRepository;
    @Autowired InstrumentAliasRepository aliasRepository;
    @Autowired TradeRepository tradeRepository;
    @Autowired NotebookNoteRepository notebookNoteRepository;
    @Autowired EntityManager entityManager;
    @Autowired DataSource dataSource;
    @MockBean CurrentUserService currentUserService;
    @MockBean JavaMailSender javaMailSender;

    @Test
    @Timeout(180)
    void fixtureIsIdempotentAcrossOverlapConcurrencyDeletionAndAccountProviderScopes() throws Exception {
        byte[] complete = Files.readAllBytes(Path.of(System.getProperty("trading212.fixture")));
        byte[] firstSixty = firstDataRows(complete, 60);
        User user = userRepository.save(User.builder()
                .email("trading212-lifecycle@example.test")
                .passwordHash("not-used")
                .role(Role.USER)
                .timezone("Europe/Bucharest")
                .baseCurrency("EUR")
                .demoEnabled(false)
                .build());
        when(currentUserService.getCurrentUser()).thenReturn(user);
        saveAliases(user);

        Account subsetThenFull = saveAccount(user, "Subset then complete");
        Trading212ImportCommitResponse first = importFile(subsetThenFull, firstSixty, "first-60.csv");
        Trading212ImportCommitResponse overlap = importFile(subsetThenFull, complete, "complete.csv");
        assertThat(first.created()).isEqualTo(60);
        assertThat(overlap.created()).isEqualTo(49);
        assertThat(overlap.duplicatesSkipped()).isEqualTo(60);
        assertAccountIdentities(subsetThenFull, 109);

        Account fullThenSubset = saveAccount(user, "Complete then subset");
        Trading212ImportCommitResponse full = importFile(fullThenSubset, complete, "complete.csv");
        Trading212ImportCommitResponse reverseOverlap = importFile(fullThenSubset, firstSixty, "first-60.csv");
        assertThat(full.created()).isEqualTo(109);
        assertThat(reverseOverlap.created()).isZero();
        assertThat(reverseOverlap.duplicatesSkipped()).isEqualTo(60);
        assertAccountIdentities(fullThenSubset, 109);

        String sharedOrderId = trading212Trades(fullThenSubset).get(0).getExternalTradeId();
        Trade otherProvider = tradeRepository.saveAndFlush(Trade.builder()
                .user(user)
                .account(fullThenSubset)
                .source(TradeSource.MT5_HTML)
                .externalTradeId(sharedOrderId)
                .symbol("GER40")
                .market(Market.CFD)
                .direction(Direction.LONG)
                .status(TradeStatus.CLOSED)
                .openedAt(OffsetDateTime.parse("2026-07-01T08:00:00Z"))
                .closedAt(OffsetDateTime.parse("2026-07-01T08:05:00Z"))
                .quantity(BigDecimal.ONE)
                .entryPrice(new BigDecimal("25000"))
                .exitPrice(new BigDecimal("25001"))
                .tradeCurrency("EUR")
                .profileCurrency("EUR")
                .pnlGross(BigDecimal.ONE)
                .pnlNet(BigDecimal.ONE)
                .build());
        assertThat(otherProvider.getId()).isNotNull();
        assertThat(trading212Trades(fullThenSubset)).hasSize(109);

        Account concurrent = saveAccount(user, "Concurrent requests");
        Trading212ImportPreviewResponse leftPreview = preview(concurrent, complete, "left.csv");
        Trading212ImportPreviewResponse rightPreview = preview(concurrent, complete, "right.csv");
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<Trading212ImportCommitResponse> left = executor.submit(() -> {
                start.await();
                return commit(concurrent, leftPreview);
            });
            Future<Trading212ImportCommitResponse> right = executor.submit(() -> {
                start.await();
                return commit(concurrent, rightPreview);
            });
            start.countDown();
            List<Trading212ImportCommitResponse> responses = List.of(left.get(), right.get());
            assertThat(responses).extracting(Trading212ImportCommitResponse::created)
                    .containsExactlyInAnyOrder(109, 0);
            assertThat(responses).extracting(Trading212ImportCommitResponse::duplicatesSkipped)
                    .containsExactlyInAnyOrder(0, 109);
        }
        assertAccountIdentities(concurrent, 109);

        Trade journalledTrade = trading212Trades(subsetThenFull).stream()
                .filter(trade -> !trade.getClosedAt().isBefore(OffsetDateTime.parse("2026-07-13T00:00:00+03:00")))
                .filter(trade -> trade.getClosedAt().isBefore(OffsetDateTime.parse("2026-07-17T00:00:00+03:00")))
                .findFirst()
                .orElseThrow();
        NotebookNote note = notebookNoteRepository.saveAndFlush(NotebookNote.builder()
                .user(user)
                .type(NotebookNoteType.TRADE_NOTE)
                .title("Keep this journal record")
                .relatedTrade(journalledTrade)
                .build());

        TradeDataDeletionRequest range = new TradeDataDeletionRequest(
                subsetThenFull.getId(), TradeDataDeletionRequest.Scope.DATE_RANGE,
                LocalDate.of(2026, 7, 13), LocalDate.of(2026, 7, 16),
                "Europe/Bucharest", false, null, null);
        var rangePreview = dataManagementService.preview(range);
        assertThat(rangePreview.tradeCount()).isEqualTo(15);
        assertThat(rangePreview.realizedPnl()).isEqualByComparingTo("94.01");
        assertThat(rangePreview.linkedJournalRecords()).isEqualTo(1);
        var rangeDeleted = dataManagementService.delete(new TradeDataDeletionRequest(
                subsetThenFull.getId(), TradeDataDeletionRequest.Scope.DATE_RANGE,
                range.startDate(), range.endDate(), range.timezone(),
                true, null, rangePreview.previewToken()));
        assertThat(rangeDeleted.deletedTrades()).isEqualTo(15);
        assertThat(rangeDeleted.deletedRealizedPnl()).isEqualByComparingTo("94.01");
        assertAccountIdentities(subsetThenFull, 94);
        entityManager.clear();
        assertThat(notebookNoteRepository.findById(note.getId()).orElseThrow().getRelatedTrade()).isNull();

        Trading212ImportCommitResponse restoreRange = importFile(subsetThenFull, complete, "restore-range.csv");
        assertThat(restoreRange.created()).isEqualTo(15);
        assertThat(restoreRange.duplicatesSkipped()).isEqualTo(94);
        assertAccountIdentities(subsetThenFull, 109);

        TradeDataDeletionRequest entire = new TradeDataDeletionRequest(
                subsetThenFull.getId(), TradeDataDeletionRequest.Scope.ENTIRE_HISTORY,
                null, null, "Europe/Bucharest", false, null, null);
        var entirePreview = dataManagementService.preview(entire);
        assertThat(entirePreview.tradeCount()).isEqualTo(109);
        var entireDeleted = dataManagementService.delete(new TradeDataDeletionRequest(
                subsetThenFull.getId(), TradeDataDeletionRequest.Scope.ENTIRE_HISTORY,
                null, null, "Europe/Bucharest", true, subsetThenFull.getName(), entirePreview.previewToken()));
        assertThat(entireDeleted.deletedTrades()).isEqualTo(109);
        assertThat(accountRepository.findById(subsetThenFull.getId())).isPresent();
        assertThat(tradeRepository.countByAccount_Id(subsetThenFull.getId())).isZero();

        Trading212ImportCommitResponse restoreAll = importFile(subsetThenFull, complete, "restore-all.csv");
        assertThat(restoreAll.created()).isEqualTo(109);
        assertAccountIdentities(subsetThenFull, 109);

        Trade existing = trading212Trades(subsetThenFull).get(0);
        Trade databaseDuplicate = Trade.builder()
                .user(user)
                .account(subsetThenFull)
                .source(TradeSource.TRADING212_CSV)
                .externalPositionId("DIFFERENT-POSITION")
                .externalOrderId(existing.getExternalTradeId())
                .externalTradeId(existing.getExternalTradeId())
                .symbol(existing.getSymbol())
                .market(existing.getMarket())
                .direction(existing.getDirection())
                .status(TradeStatus.CLOSED)
                .openedAt(existing.getOpenedAt())
                .closedAt(existing.getClosedAt())
                .quantity(existing.getQuantity())
                .entryPrice(existing.getEntryPrice())
                .exitPrice(existing.getExitPrice())
                .tradeCurrency(existing.getTradeCurrency())
                .profileCurrency(existing.getProfileCurrency())
                .pnlGross(existing.getPnlGross())
                .pnlNet(existing.getPnlNet())
                .build();
        assertThatThrownBy(() -> tradeRepository.saveAndFlush(databaseDuplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertAccountIdentities(subsetThenFull, 109);
    }

    @Test
    @Timeout(60)
    void migrationReportsExistingIdentityConflictsWithoutDeletingThem() {
        String schema = "trading212_identity_conflict_test";
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
        try {
            Flyway.configure()
                    .dataSource(dataSource)
                    .defaultSchema(schema)
                    .schemas(schema)
                    .locations("classpath:db/migration")
                    .target("62")
                    .load()
                    .migrate();
            UUID userId = UUID.randomUUID();
            UUID accountId = UUID.randomUUID();
            UUID firstTradeId = UUID.randomUUID();
            UUID secondTradeId = UUID.randomUUID();
            jdbc.update("""
                    INSERT INTO %s.users
                        (id, email, password_hash, role, theme_preference,
                         tradingview_webhook_enabled, demo_enabled)
                    VALUES (?, ?, 'not-used', 'USER', 'SYSTEM', false, false)
                    """.formatted(schema), userId, "migration-conflict@example.test");
            jdbc.update("""
                    INSERT INTO %s.accounts
                        (id, user_id, name, account_currency, status, is_default)
                    VALUES (?, ?, 'Migration conflict', 'EUR', 'ACTIVE', false)
                    """.formatted(schema), accountId, userId);
            String tradeSql = """
                    INSERT INTO %s.trades
                        (id, user_id, account_id, symbol, market, direction, status,
                         opened_at, closed_at, quantity, entry_price, exit_price,
                         trade_currency, profile_currency, contract_multiplier,
                         source, external_position_id, external_order_id)
                    VALUES (?, ?, ?, 'GER40', 'CFD', 'LONG', 'CLOSED',
                            '2026-07-01T08:00:00Z', '2026-07-01T08:01:00Z',
                            1, 25000, 25001, 'EUR', 'EUR', 1,
                            'TRADING212_CSV', ?, 'DUPLICATE-ORDER')
                    """.formatted(schema);
            jdbc.update(tradeSql, firstTradeId, userId, accountId, "POSITION-1");
            jdbc.update(tradeSql, secondTradeId, userId, accountId, "POSITION-2");

            Flyway v63 = Flyway.configure()
                    .dataSource(dataSource)
                    .defaultSchema(schema)
                    .schemas(schema)
                    .locations("classpath:db/migration")
                    .load();
            assertThatThrownBy(v63::migrate)
                    .hasStackTraceContaining("Trading 212 duplicate external identities must be resolved")
                    .hasStackTraceContaining(accountId.toString())
                    .hasStackTraceContaining("DUPLICATE-ORDER")
                    .hasStackTraceContaining(firstTradeId.toString())
                    .hasStackTraceContaining(secondTradeId.toString());
            assertThat(jdbc.queryForObject(
                    "SELECT COUNT(*) FROM " + schema + ".trades", Integer.class)).isEqualTo(2);
        } finally {
            jdbc.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
        }
    }

    private Trading212ImportCommitResponse importFile(Account account, byte[] bytes, String filename) throws Exception {
        return commit(account, preview(account, bytes, filename));
    }

    private Trading212ImportPreviewResponse preview(Account account, byte[] bytes, String filename) throws Exception {
        return importService.preview(new MockMultipartFile("file", filename, "text/csv", bytes), account.getId());
    }

    private Trading212ImportCommitResponse commit(Account account, Trading212ImportPreviewResponse preview) {
        return importService.commit(preview.importBatchId(), new Trading212ImportCommitRequest(
                account.getId(), null, null, List.of(), Map.of()));
    }

    private List<Trade> trading212Trades(Account account) {
        return tradeRepository.findByUser_IdAndAccount_IdOrderByClosedAtAsc(
                        account.getUser().getId(), account.getId()).stream()
                .filter(trade -> trade.getSource() == TradeSource.TRADING212_CSV)
                .toList();
    }

    private void assertAccountIdentities(Account account, int expected) {
        List<Trade> trades = trading212Trades(account);
        assertThat(trades).hasSize(expected);
        assertThat(trades).extracting(Trade::getExternalTradeId)
                .doesNotContainNull()
                .doesNotHaveDuplicates();
    }

    private Account saveAccount(User user, String name) {
        return accountRepository.saveAndFlush(Account.builder()
                .user(user)
                .name(name)
                .broker("Trading 212")
                .brokerTimezone("Europe/Bucharest")
                .accountCurrency("EUR")
                .startingBalance(new BigDecimal("10000"))
                .build());
    }

    private void saveAliases(User user) {
        for (String symbol : List.of("GER40", "INTC", "TECH100", "MU")) {
            aliasRepository.save(InstrumentAlias.builder()
                    .user(user)
                    .broker("Trading 212")
                    .brokerServer("")
                    .externalSymbol(symbol)
                    .internalSymbol(symbol)
                    .market(Market.CFD)
                    .tradeCurrency("EUR")
                    .contractMultiplier(BigDecimal.ONE)
                    .active(true)
                    .build());
        }
        aliasRepository.flush();
    }

    private static byte[] firstDataRows(byte[] complete, int rows) {
        String[] lines = new String(complete, java.nio.charset.StandardCharsets.UTF_8).split("\\R");
        if (lines.length < rows + 1) {
            throw new IllegalArgumentException("Fixture contains fewer than " + rows + " data rows");
        }
        return String.join("\n", Arrays.copyOfRange(lines, 0, rows + 1))
                .getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    private static String environmentOrDefault(String key, String fallback) {
        String value = System.getenv(key);
        return value == null ? fallback : value;
    }
}
