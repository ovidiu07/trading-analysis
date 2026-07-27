package com.tradevault.service.growthcoach;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.*;
import com.tradevault.domain.enums.*;
import com.tradevault.dto.growthcoach.GrowthCoachResponse.OperatingSystem;
import com.tradevault.dto.growthcoach.GrowthCoachResponse.PeriodContext;
import com.tradevault.dto.growthcoach.GrowthCoachResponse.PeriodPlan;
import com.tradevault.dto.growthcoach.PeriodPlanRequest;
import com.tradevault.repository.AccountPeriodPlanRepository;
import com.tradevault.repository.AccountPeriodPlanRevisionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GrowthCoachOperatingServiceTest {
    @Mock AccountPeriodPlanRepository planRepository;
    @Mock AccountPeriodPlanRevisionRepository revisionRepository;

    private GrowthCoachOperatingService service;
    private User user;
    private Account account;
    private AccountGrowthProfile profile;
    private MonthlyGrowthPlan monthlyPlan;

    @BeforeEach
    void setUp() {
        service = new GrowthCoachOperatingService(
                planRepository, revisionRepository, new ObjectMapper().findAndRegisterModules());
        user = User.builder().id(UUID.randomUUID()).timezone("Europe/Bucharest").build();
        account = Account.builder().id(UUID.randomUUID()).user(user).name("Primary")
                .accountCurrency("USD").startingBalance(new BigDecimal("10000")).build();
        profile = AccountGrowthProfile.builder().id(UUID.randomUUID()).user(user).account(account)
                .accountType(GrowthAccountType.PERSONAL).initialCapital(new BigDecimal("10000"))
                .defaultRiskPerTradePct(new BigDecimal("0.5"))
                .preferredMaxRiskPerTradePct(BigDecimal.ONE)
                .maxConcurrentRiskPct(new BigDecimal("2"))
                .maxDailyLossAmount(new BigDecimal("200"))
                .monthlyTargetPct(new BigDecimal("3")).build();
        monthlyPlan = MonthlyGrowthPlan.builder().id(UUID.randomUUID()).user(user).account(account)
                .monthKey("2026-07").timezone("Europe/Bucharest")
                .targetType(GrowthTargetType.PERCENTAGE).targetPct(new BigDecimal("3"))
                .targetAmount(new BigDecimal("300")).plannedMaxTradesPerDay(4)
                .plannedMaxTradesPerWeek(12).plannedMinimumRr(new BigDecimal("1.5")).build();

        when(planRepository.findByAccountIdAndUserIdAndPeriodTypeAndPeriodKey(
                any(), any(), any(), any())).thenReturn(Optional.empty());
        when(planRepository.save(any())).thenAnswer(invocation -> {
            AccountPeriodPlan plan = invocation.getArgument(0);
            if (plan.getId() == null) plan.setId(UUID.randomUUID());
            if (plan.getUpdatedAt() == null) plan.setUpdatedAt(OffsetDateTime.now());
            return plan;
        });
        lenient().when(revisionRepository.findByPlanIdOrderByVersionDesc(any())).thenReturn(List.of());
    }

    @Test
    void includesTwoTradesClosedTodayAndKeepsWithdrawalOutOfTargetProgress() {
        Trade first = closedTrade("EURUSD", "2026-07-27T08:00:00+03:00", "100", "50", "2");
        Trade second = closedTrade("GBPUSD", "2026-07-27T10:00:00+03:00", "50", "50", "1");
        AccountLedgerEvent withdrawal = AccountLedgerEvent.builder()
                .id(UUID.randomUUID()).user(user).account(account)
                .eventType(LedgerEventType.WITHDRAWAL).amount(new BigDecimal("100"))
                .currency("USD").eventTime(OffsetDateTime.parse("2026-07-27T07:00:00+03:00"))
                .eventStatus("COMPLETED").metadataJson("{}").planningBehavior("PRESERVE_BASELINE").build();
        PeriodContext context = GrowthCoachPeriodResolver.resolve(
                "DAY", LocalDate.parse("2026-07-27"), ZoneId.of("Europe/Bucharest"),
                Clock.fixed(Instant.parse("2026-07-27T12:00:00Z"), ZoneOffset.UTC));

        OperatingSystem result = service.build(user, account, profile, monthlyPlan, context,
                List.of(first, second), List.of(withdrawal), new BigDecimal("10000"),
                BigDecimal.ZERO, BigDecimal.ZERO, true);

        assertEquals(2, result.todayActivity().closedTrades().size());
        assertEquals(0, new BigDecimal("150").compareTo(result.todayActivity().summary().realisedTradingPnl()));
        assertEquals(0, new BigDecimal("-100").compareTo(result.todayActivity().summary().netLedgerMovement()));
        assertEquals(0, new BigDecimal("10050").compareTo(result.todayActivity().summary().currentRealisedBalance()));
        assertEquals(0, new BigDecimal("500").compareTo(result.todayActivity().summary().targetProgressPct()));
        assertEquals(0, new BigDecimal("30").compareTo(result.plans().day().targetAmount()));
        assertEquals("AUTOMATIC", result.plans().day().allocationMode());
        assertEquals(40, result.planAdherence().evaluationCoverage());
        assertEquals("TARGET_EXCEEDED", result.periodComparisons().get(0).periodStatus());
        assertEquals(0, result.todayActivity().currentlyOpenTrades());
    }

    @Test
    void negativeResultSeparatesCompletionDeficitLossUsageAndResumeRisk() {
        Trade loss = closedTrade("EURUSD", "2026-07-27T08:00:00+03:00", "-229.60", "100", "-2.296");
        PeriodContext context = GrowthCoachPeriodResolver.resolve(
                "WEEK", LocalDate.parse("2026-07-27"), ZoneId.of("Europe/Bucharest"),
                Clock.fixed(Instant.parse("2026-07-27T12:00:00Z"), ZoneOffset.UTC));

        OperatingSystem result = service.build(user, account, profile, monthlyPlan, context,
                List.of(loss), List.of(), new BigDecimal("10000"),
                BigDecimal.ZERO, BigDecimal.ZERO, true);

        assertEquals(0, BigDecimal.ZERO.compareTo(result.selectedSummary().targetProgressPct()));
        assertEquals(0, new BigDecimal("229.6000").compareTo(result.selectedSummary().distanceToBreakeven()));
        assertEquals(0, new BigDecimal("759.2000").compareTo(result.selectedSummary().distanceToTarget()));
        assertEquals(0, new BigDecimal("370.4000").compareTo(result.selectedSummary().lossAllowanceRemaining()));
        assertEquals(0, new BigDecimal("38.266667").compareTo(result.selectedSummary().lossLimitUtilisationPct()));
        assertEquals("DAILY_LOCKOUT", result.tradingPermission().state());
        assertEquals(0, BigDecimal.ZERO.compareTo(result.tradingPermission().maximumPermittedRisk()));
        assertEquals(0, new BigDecimal("48.8520").compareTo(
                result.tradingPermission().recommendedRiskWhenTradingResumes()));
        assertEquals(0, new BigDecimal("97.7040").compareTo(result.tradingPermission().theoreticalMaximumRisk()));
        assertEquals("LOSS_WITHIN_LIMIT", result.periodComparisons().get(1).periodStatus());
    }

    @Test
    void customPlanOverridePersistsIndependentlyFromAutomaticAllocation() {
        PeriodContext context = GrowthCoachPeriodResolver.resolve(
                "DAY", LocalDate.parse("2026-07-27"), ZoneId.of("Europe/Bucharest"),
                Clock.fixed(Instant.parse("2026-07-27T12:00:00Z"), ZoneOffset.UTC));
        AccountPeriodPlan existing = AccountPeriodPlan.builder()
                .id(UUID.randomUUID()).user(user).account(account).periodType("DAY").periodKey("2026-07-27")
                .timezone("Europe/Bucharest").targetType(GrowthTargetType.FIXED_AMOUNT)
                .targetValue(new BigDecimal("15")).targetAmount(new BigDecimal("15"))
                .maxLossType("FIXED_AMOUNT").maxLossValue(new BigDecimal("100"))
                .maxLossAmount(new BigDecimal("100")).allocationMode("AUTOMATIC").active(true).version(1)
                .effectiveFrom(context.startsAt()).build();
        when(planRepository.findByAccountIdAndUserIdAndPeriodTypeAndPeriodKey(
                account.getId(), user.getId(), "DAY", "2026-07-27")).thenReturn(Optional.of(existing));
        PeriodPlanRequest request = new PeriodPlanRequest(
                GrowthTargetType.FIXED_AMOUNT, new BigDecimal("75"), "FIXED_AMOUNT", new BigDecimal("125"),
                4, new BigDecimal("125"), 2, null, null, null, new BigDecimal("0.5"),
                new BigDecimal("1.5"), false, true, new BigDecimal("50"), "PERCENTAGE",
                new BigDecimal("50"), null, null, null, null, null, true, true,
                "LONDON", "A setups", "Custom daily plan", "MANUAL", null, null,
                true, "Use custom daily limits");

        PeriodPlan result = service.update(user, account, profile, monthlyPlan, context,
                new BigDecimal("10000"), request);

        assertEquals("MANUAL", result.allocationMode());
        assertEquals(0, new BigDecimal("75.0000").compareTo(result.targetAmount()));
        assertEquals(2, result.version());
    }

    @Test
    void monthlyPlanCanSetDailyAndWeeklyAllocationModesTogether() {
        PeriodContext context = GrowthCoachPeriodResolver.resolve(
                "MONTH", LocalDate.parse("2026-07-27"), ZoneId.of("Europe/Bucharest"),
                Clock.fixed(Instant.parse("2026-07-27T12:00:00Z"), ZoneOffset.UTC));
        PeriodPlanRequest request = new PeriodPlanRequest(
                GrowthTargetType.FIXED_AMOUNT, new BigDecimal("300"), "FIXED_AMOUNT", new BigDecimal("800"),
                40, new BigDecimal("800"), 3, 2, null, null, new BigDecimal("0.5"),
                new BigDecimal("1.5"), false, true, new BigDecimal("50"), "PERCENTAGE",
                new BigDecimal("50"), new BigDecimal("50"), new BigDecimal("800"), 20,
                "Withdraw quarterly", "FIXED_BASELINE", true, true,
                null, null, "Monthly plan", "MANUAL", "MANUAL", "MANUAL",
                true, "Set child allocation modes");

        service.update(user, account, profile, monthlyPlan, context, new BigDecimal("10000"), request);

        verify(planRepository, atLeastOnce()).save(argThat(plan ->
                "DAY".equals(plan.getPeriodType()) && "MANUAL".equals(plan.getAllocationMode())));
        verify(planRepository, atLeastOnce()).save(argThat(plan ->
                "WEEK".equals(plan.getPeriodType()) && "MANUAL".equals(plan.getAllocationMode())));
    }

    private Trade closedTrade(String symbol, String closedAt, String pnl, String risk, String r) {
        return Trade.builder()
                .id(UUID.randomUUID()).user(user).account(account).symbol(symbol)
                .direction(Direction.LONG).status(TradeStatus.CLOSED)
                .openedAt(OffsetDateTime.parse(closedAt).minusHours(1))
                .closedAt(OffsetDateTime.parse(closedAt))
                .pnlNet(new BigDecimal(pnl)).riskAmount(new BigDecimal(risk))
                .rMultiple(new BigDecimal(r)).contractMultiplier(BigDecimal.ONE)
                .build();
    }
}
