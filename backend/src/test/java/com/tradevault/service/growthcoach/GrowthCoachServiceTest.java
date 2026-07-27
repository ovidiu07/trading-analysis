package com.tradevault.service.growthcoach;

import com.tradevault.analytics.AnalyticsService;
import com.tradevault.domain.entity.*;
import com.tradevault.domain.enums.*;
import com.tradevault.dto.analytics.AnalyticsResponse;
import com.tradevault.dto.growthcoach.GrowthCoachResponse;
import com.tradevault.dto.session.LiveQuoteResponse;
import com.tradevault.repository.*;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.QuoteService;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GrowthCoachServiceTest {
    @Mock CurrentUserService currentUserService;
    @Mock AccountRepository accountRepository;
    @Mock TradeRepository tradeRepository;
    @Mock AccountGrowthProfileRepository profileRepository;
    @Mock MonthlyGrowthPlanRepository planRepository;
    @Mock MonthlyGrowthPlanRevisionRepository revisionRepository;
    @Mock AccountLedgerEventRepository ledgerRepository;
    @Mock AnalyticsService analyticsService;
    @Mock QuoteService quoteService;
    @Mock GrowthCoachOperatingService operatingService;
    @Mock PlatformTransactionManager transactionManager;

    private GrowthCoachService service;
    private User user;
    private Account account;
    private AccountGrowthProfile profile;
    private MonthlyGrowthPlan plan;

    @BeforeEach
    void setUp() {
        service = new GrowthCoachService(
                currentUserService, accountRepository, tradeRepository, profileRepository,
                planRepository, revisionRepository, ledgerRepository, analyticsService,
                quoteService, new GrowthCoachMessageEngine(), operatingService, transactionManager);
        user = User.builder().id(UUID.randomUUID()).timezone("Europe/Bucharest").build();
        account = Account.builder()
                .id(UUID.randomUUID()).user(user).name("Primary").accountCurrency("USD")
                .accountType("PERSONAL").startingBalance(new BigDecimal("10000"))
                .status(AccountStatus.ACTIVE).build();
        profile = AccountGrowthProfile.builder()
                .id(UUID.randomUUID()).user(user).account(account).accountType(GrowthAccountType.PERSONAL)
                .initialCapital(new BigDecimal("10000")).capitalSource(CapitalSource.USER_ENTERED)
                .defaultRiskPerTradePct(new BigDecimal("0.5"))
                .preferredMaxRiskPerTradePct(BigDecimal.ONE)
                .maxConcurrentRiskPct(new BigDecimal("2"))
                .drawdownType(DrawdownType.STATIC).maxTotalDrawdownPct(new BigDecimal("10"))
                .monthlyTargetPct(new BigDecimal("3")).active(true).build();
        plan = MonthlyGrowthPlan.builder()
                .id(UUID.randomUUID()).user(user).account(account).monthKey("2026-07")
                .timezone("Europe/Bucharest").monthStartBalance(new BigDecimal("10000"))
                .monthStartEquity(new BigDecimal("10000")).targetType(GrowthTargetType.PERCENTAGE)
                .targetBasis("MONTH_START_BALANCE").targetPct(new BigDecimal("3"))
                .targetAmount(new BigDecimal("300")).plannedRiskPerTradePct(new BigDecimal("0.5"))
                .hardMaxRiskPerTradePct(BigDecimal.ONE).plannedMaxTradesPerDay(3)
                .plannedMaxTradesPerWeek(12).plannedMinimumRr(new BigDecimal("1.5"))
                .snapshotSource(SnapshotSource.CAPTURED).status("ACTIVE").build();
    }

    @Test
    void usesCloseTimeForMonthlyRealisedAndIncludesEveryCurrentlyOpenTrade() {
        plan.setTargetAmount(null);
        OffsetDateTime previousMonth = OffsetDateTime.parse("2026-06-29T10:00:00+03:00");
        Trade closedThisMonth = Trade.builder()
                .id(UUID.randomUUID()).user(user).account(account).symbol("EUR_USD")
                .direction(Direction.LONG).status(TradeStatus.CLOSED)
                .openedAt(previousMonth).closedAt(OffsetDateTime.parse("2026-07-03T12:00:00+03:00"))
                .quantity(BigDecimal.ONE).entryPrice(new BigDecimal("1.10"))
                .exitPrice(new BigDecimal("1.11")).contractMultiplier(new BigDecimal("10000"))
                .pnlNet(new BigDecimal("100")).riskAmount(new BigDecimal("50"))
                .rMultiple(new BigDecimal("2")).build();
        Trade oldOpenTrade = Trade.builder()
                .id(UUID.randomUUID()).user(user).account(account).symbol("EUR_USD")
                .direction(Direction.LONG).status(TradeStatus.OPEN)
                .openedAt(previousMonth).quantity(BigDecimal.ONE).entryPrice(new BigDecimal("1.10"))
                .contractMultiplier(new BigDecimal("10000")).build();

        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(accountRepository.findByIdAndUserId(account.getId(), user.getId())).thenReturn(Optional.of(account));
        when(profileRepository.findByAccountIdAndUserId(account.getId(), user.getId())).thenReturn(Optional.of(profile));
        when(planRepository.findByAccountIdAndUserIdAndMonthKey(account.getId(), user.getId(), "2026-07"))
                .thenReturn(Optional.of(plan));
        when(planRepository.save(plan)).thenReturn(plan);
        when(tradeRepository.findByUser_IdAndAccount_IdOrderByClosedAtAsc(user.getId(), account.getId()))
                .thenReturn(List.of(closedThisMonth, oldOpenTrade));
        when(ledgerRepository.findByAccountIdAndUserIdOrderByEventTimeAsc(account.getId(), user.getId()))
                .thenReturn(List.of());
        when(analyticsService.summarize(any(), any(), isNull(), isNull(), isNull(), anyString(), isNull(),
                isNull(), isNull(), isNull(), isNull(), eq("CLOSE"), eq(false), isNull()))
                .thenReturn(AnalyticsResponse.builder().build());
        when(quoteService.getLiveQuoteForUser(user.getId(), "EUR_USD")).thenReturn(LiveQuoteResponse.builder()
                .symbol("EUR_USD").bid(new BigDecimal("1.12")).ask(new BigDecimal("1.1202"))
                .available(true).tsUtc(OffsetDateTime.now()).build());

        GrowthCoachResponse response = service.getPage(account.getId(), "2026-07");

        assertEquals(0, new BigDecimal("300.0000").compareTo(plan.getTargetAmount()));
        assertEquals(0, new BigDecimal("100").compareTo(response.detail().target().realisedCurrentMonthPnl()));
        assertEquals(1, response.detail().openExposure().openTradeCount());
        assertEquals(oldOpenTrade.getId(), response.detail().openExposure().trades().get(0).tradeId());
        assertFalse(response.detail().openExposure().openRiskKnown());
        assertNull(response.detail().openExposure().totalOpenRisk());
        assertEquals("UNKNOWN", response.detail().riskPlan().state());
    }

    @Test
    void rejectsAnAccountNotOwnedByTheCurrentUser() {
        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(accountRepository.findByIdAndUserId(account.getId(), user.getId())).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> service.getPage(account.getId(), "2026-07"));
    }

    @Test
    void isolatesFailedPortfolioAccountBeforeReturningItsFallbackSummary() {
        SimpleTransactionStatus status = new SimpleTransactionStatus();
        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(accountRepository.findByUserIdOrderByNameAsc(user.getId())).thenReturn(List.of(account));
        when(profileRepository.findByAccountIdAndUserId(account.getId(), user.getId()))
                .thenReturn(Optional.of(profile));
        when(planRepository.findByAccountIdAndUserIdAndMonthKey(account.getId(), user.getId(), "2026-07"))
                .thenReturn(Optional.of(plan));
        when(tradeRepository.findByUser_IdAndAccount_IdOrderByClosedAtAsc(user.getId(), account.getId()))
                .thenReturn(List.of());
        when(ledgerRepository.findByAccountIdAndUserIdOrderByEventTimeAsc(account.getId(), user.getId()))
                .thenReturn(List.of());
        when(analyticsService.summarize(any(), any(), isNull(), isNull(), isNull(), anyString(), isNull(),
                isNull(), isNull(), isNull(), isNull(), eq("CLOSE"), eq(false), isNull()))
                .thenReturn(AnalyticsResponse.builder().build());
        when(transactionManager.getTransaction(any())).thenReturn(status);
        doThrow(new IllegalStateException("account summary failed")).when(operatingService)
                .build(any(), any(), any(), any(), any(), anyList(), anyList(),
                        any(), any(), any(), anyBoolean());

        GrowthCoachResponse response = service.getPage(null, "2026-07");

        assertEquals("PORTFOLIO", response.mode());
        assertEquals(1, response.portfolioAccounts().size());
        assertNull(response.portfolioAccounts().get(0).realisedBalance());
        assertEquals("UNKNOWN", response.portfolioAccounts().get(0).riskState());
        verify(transactionManager).getTransaction(argThat(definition ->
                definition.getPropagationBehavior() == TransactionDefinition.PROPAGATION_REQUIRES_NEW));
        verify(transactionManager).rollback(status);
        verify(transactionManager, never()).commit(status);
    }
}
