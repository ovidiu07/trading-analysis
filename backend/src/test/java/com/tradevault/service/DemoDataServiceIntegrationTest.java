package com.tradevault.service;

import com.tradevault.analytics.AnalyticsService;
import com.tradevault.domain.entity.NotebookNote;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.NotebookNoteType;
import com.tradevault.domain.enums.Role;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.analytics.AnalyticsResponse;
import com.tradevault.dto.demo.DemoRemovalResponse;
import com.tradevault.repository.NotebookNoteRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@SpringBootTest
@Testcontainers
class DemoDataServiceIntegrationTest {

    private static final ZoneId DEMO_ZONE = ZoneId.of("Europe/Bucharest");

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
    DemoDataService demoDataService;

    @Autowired
    UserRepository userRepository;

    @Autowired
    TradeRepository tradeRepository;

    @Autowired
    NotebookNoteRepository notebookNoteRepository;

    @Autowired
    AnalyticsService analyticsService;

    @MockBean
    CurrentUserService currentUserService;

    @AfterEach
    void cleanup() {
        userRepository.deleteAll();
    }

    @Test
    void generateDemoDataFlagsRowsAndUser() {
        User user = userRepository.save(User.builder()
                .email("demo-flags@example.com")
                .passwordHash("hash")
                .role(Role.USER)
                .baseCurrency("USD")
                .timezone("Europe/Bucharest")
                .build());

        demoDataService.generateDemoDataForUser(user.getId(), true);

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertThat(reloaded.isDemoEnabled()).isTrue();
        assertThat(reloaded.getDemoSeedId()).isNotNull();
        assertThat(demoDataService.hasDemoData(user.getId())).isTrue();

        var trades = tradeRepository.findByUserId(user.getId());
        var notes = notebookNoteRepository.findByUserIdAndIsDeletedFalse(user.getId());

        assertThat(trades).hasSizeGreaterThanOrEqualTo(30);
        assertThat(notes).hasSizeGreaterThanOrEqualTo(5);
        assertThat(trades).allMatch(trade -> reloaded.getDemoSeedId().equals(trade.getDemoSeedId()));
        assertThat(notes).allMatch(note -> reloaded.getDemoSeedId().equals(note.getDemoSeedId()));
    }

    @Test
    void removeDemoDataDeletesOnlyDemoRows() {
        User user = userRepository.save(User.builder()
                .email("demo-remove@example.com")
                .passwordHash("hash")
                .role(Role.USER)
                .baseCurrency("USD")
                .timezone("Europe/Bucharest")
                .build());

        demoDataService.generateDemoDataForUser(user.getId(), true);

        Trade realTrade = Trade.builder()
                .user(user)
                .symbol("MSFT")
                .market(Market.STOCK)
                .direction(Direction.LONG)
                .status(TradeStatus.OPEN)
                .openedAt(OffsetDateTime.now(DEMO_ZONE))
                .quantity(new BigDecimal("2"))
                .entryPrice(new BigDecimal("400"))
                .fees(BigDecimal.ZERO)
                .commission(BigDecimal.ZERO)
                .slippage(BigDecimal.ZERO)
                .build();
        realTrade = tradeRepository.save(realTrade);

        NotebookNote realNote = NotebookNote.builder()
                .user(user)
                .type(NotebookNoteType.NOTE)
                .title("Real note")
                .body("Keep this")
                .isDeleted(false)
                .build();
        realNote = notebookNoteRepository.save(realNote);

        DemoRemovalResponse response = demoDataService.removeDemoDataForUser(user.getId());

        assertThat(response.isDemoEnabled()).isFalse();
        assertThat(response.getRemovedCount().getTrades()).isGreaterThan(0);
        assertThat(response.getRemovedCount().getNotes()).isGreaterThan(0);

        var tradesAfter = tradeRepository.findByUserId(user.getId());
        var notesAfter = notebookNoteRepository.findByUserIdAndIsDeletedFalse(user.getId());

        assertThat(tradesAfter).extracting(Trade::getId).containsExactly(realTrade.getId());
        assertThat(notesAfter).extracting(NotebookNote::getId).contains(realNote.getId());
        assertThat(tradesAfter).allMatch(trade -> trade.getDemoSeedId() == null);
        assertThat(notesAfter).allMatch(note -> note.getDemoSeedId() == null);

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertThat(reloaded.isDemoEnabled()).isFalse();
        assertThat(reloaded.getDemoSeedId()).isNull();
        assertThat(reloaded.getDemoRemovedAt()).isNotNull();
        assertThat(demoDataService.hasDemoData(user.getId())).isFalse();
    }

    @Test
    void removeDemoDataIsIdempotent() {
        User user = userRepository.save(User.builder()
                .email("demo-idempotent@example.com")
                .passwordHash("hash")
                .role(Role.USER)
                .baseCurrency("USD")
                .timezone("Europe/Bucharest")
                .build());

        demoDataService.generateDemoDataForUser(user.getId(), true);

        DemoRemovalResponse first = demoDataService.removeDemoDataForUser(user.getId());
        DemoRemovalResponse second = demoDataService.removeDemoDataForUser(user.getId());

        assertThat(first.getRemovedCount().getTrades()).isGreaterThan(0);
        assertThat(second.getRemovedCount().getTrades()).isZero();
        assertThat(second.getRemovedCount().getNotes()).isZero();

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertThat(reloaded.isDemoEnabled()).isFalse();
        assertThat(reloaded.getDemoSeedId()).isNull();
        assertThat(demoDataService.hasDemoData(user.getId())).isFalse();
    }

    @Test
    void analyticsReflectDemoDataBeforeAndAfterRemoval() {
        User user = userRepository.save(User.builder()
                .email("demo-analytics@example.com")
                .passwordHash("hash")
                .role(Role.USER)
                .baseCurrency("USD")
                .timezone("Europe/Bucharest")
                .build());

        demoDataService.generateDemoDataForUser(user.getId(), true);
        when(currentUserService.getCurrentUser()).thenAnswer(invocation -> userRepository.findById(user.getId()).orElseThrow());

        AnalyticsResponse before = analyticsService.summarize(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                "CLOSE",
                false,
                null
        );

        demoDataService.removeDemoDataForUser(user.getId());

        AnalyticsResponse after = analyticsService.summarize(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                "CLOSE",
                false,
                null
        );

        assertThat(before.getKpi().getTotalTrades()).isGreaterThan(0);
        assertThat(after.getKpi().getTotalTrades()).isZero();
        assertThat(after.getKpi().getTotalPnlNet()).isEqualByComparingTo(BigDecimal.ZERO);
    }
}
