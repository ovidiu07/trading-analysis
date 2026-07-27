package com.tradevault.service.growthcoach;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.*;
import com.tradevault.domain.enums.GrowthTargetType;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.growthcoach.GrowthCoachResponse.*;
import com.tradevault.dto.growthcoach.PeriodPlanRequest;
import com.tradevault.repository.AccountPeriodPlanRepository;
import com.tradevault.repository.AccountPeriodPlanRevisionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GrowthCoachOperatingService {
    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final AccountPeriodPlanRepository planRepository;
    private final AccountPeriodPlanRevisionRepository revisionRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public OperatingSystem build(User user,
                                 Account account,
                                 AccountGrowthProfile profile,
                                 MonthlyGrowthPlan legacyMonthPlan,
                                 PeriodContext selected,
                                 List<Trade> trades,
                                 List<AccountLedgerEvent> ledger,
                                 BigDecimal initialCapital,
                                 BigDecimal floatingPnl,
                                 BigDecimal openRisk,
                                 boolean openRiskKnown) {
        ZoneId zone = ZoneId.of(selected.timezone());
        PeriodContext dayContext = GrowthCoachPeriodResolver.resolve("DAY", selected.anchorDate(), zone, Clock.systemUTC());
        PeriodContext weekContext = GrowthCoachPeriodResolver.resolve("WEEK", selected.anchorDate(), zone, Clock.systemUTC());
        PeriodContext monthContext = GrowthCoachPeriodResolver.resolve("MONTH", selected.anchorDate(), zone, Clock.systemUTC());
        AccountPeriodPlan day = getOrCreate(user, account, profile, legacyMonthPlan, dayContext);
        AccountPeriodPlan week = getOrCreate(user, account, profile, legacyMonthPlan, weekContext);
        AccountPeriodPlan month = getOrCreate(user, account, profile, legacyMonthPlan, monthContext);
        refreshAutomaticTarget(day, month, monthContext, trades, selected.anchorDate());
        refreshAutomaticTarget(week, month, monthContext, trades, selected.anchorDate());
        Map<String, AccountPeriodPlan> plans = Map.of("DAY", day, "WEEK", week, "MONTH", month);

        PeriodSummary daySummary = summarize(dayContext, day, trades, ledger, initialCapital,
                floatingPnl, openRisk, openRiskKnown);
        PeriodSummary weekSummary = summarize(weekContext, week, trades, ledger, initialCapital,
                floatingPnl, openRisk, openRiskKnown);
        PeriodSummary monthSummary = summarize(monthContext, month, trades, ledger, initialCapital,
                floatingPnl, openRisk, openRiskKnown);
        Map<String, PeriodSummary> summaries = Map.of(
                "DAY", daySummary, "WEEK", weekSummary, "MONTH", monthSummary);
        PeriodSummary selectedSummary = summaries.get(selected.periodType());
        PlanAdherence adherence = adherence(plans.get(selected.periodType()), tradesIn(selected, trades));
        TradingPermission permission = permission(profile, day, week, month, daySummary, weekSummary, monthSummary,
                openRisk, openRiskKnown);
        List<ClosedTradeActivity> todayTrades = tradesIn(dayContext, trades).stream()
                .map(this::toClosedTrade)
                .toList();

        return new OperatingSystem(
                selected,
                new PlanBundle(toPlan(day), toPlan(week), toPlan(month)),
                selectedSummary,
                new TodayActivity(daySummary,
                        (int) trades.stream().filter(t -> t.getStatus() == TradeStatus.OPEN).count(),
                        todayTrades,
                        permission.state()),
                permission,
                List.of(
                        comparison(daySummary, day, adherence(day, tradesIn(dayContext, trades))),
                        comparison(weekSummary, week, adherence(week, tradesIn(weekContext, trades))),
                        comparison(monthSummary, month, adherence(month, tradesIn(monthContext, trades)))),
                adherence,
                confidence(trades, initialCapital, floatingPnl, openRisk, openRiskKnown),
                chart(selected, plans.get(selected.periodType()), selectedSummary, trades, ledger, initialCapital, floatingPnl),
                markers(selected, trades, ledger),
                history(plans.get(selected.periodType()))
        );
    }

    @Transactional
    public PeriodPlan update(User user,
                             Account account,
                             AccountGrowthProfile profile,
                             MonthlyGrowthPlan legacyMonthPlan,
                             PeriodContext context,
                             BigDecimal planBaseline,
                             PeriodPlanRequest request) {
        AccountPeriodPlan plan = getOrCreate(user, account, profile, legacyMonthPlan, context);
        validate(request, profile);
        revisionRepository.save(AccountPeriodPlanRevision.builder()
                .user(user)
                .account(account)
                .plan(plan)
                .version(plan.getVersion())
                .snapshotJson(snapshot(plan))
                .changeReason(request.changeReason().trim())
                .changedBy(user)
                .build());
        plan.setTargetType(request.targetType());
        plan.setTargetValue(scale(request.targetValue()));
        plan.setMaxLossType(request.maxLossType());
        plan.setMaxLossValue(scale(request.maxLossValue()));
        plan.setMaxTrades(request.maxTrades());
        plan.setMaxRiskBudget(scale(request.maxRiskBudget()));
        plan.setMaxConsecutiveLosses(request.maxConsecutiveLosses());
        plan.setMaxLosingDays(request.maxLosingDays());
        plan.setMaxConsecutiveLosingDays(request.maxConsecutiveLosingDays());
        plan.setMinimumReviewDays(request.minimumReviewDays());
        plan.setDefaultRiskPerTrade(scale(request.defaultRiskPerTrade()));
        plan.setMinimumRr(scale(request.minimumRr()));
        plan.setStopAfterTarget(request.stopAfterTarget());
        plan.setReduceRiskAfterTarget(request.reduceRiskAfterTarget());
        plan.setRiskReductionPct(scale(request.riskReductionPct()));
        plan.setRiskReductionType(request.riskReductionType());
        plan.setRiskReductionValue(scale(request.riskReductionValue()));
        plan.setRiskReductionAfterDrawdownPct(scale(request.riskReductionAfterDrawdownPct()));
        plan.setMaximumDrawdownTolerance(scale(request.maximumDrawdownTolerance()));
        plan.setPlannedTradingDays(request.plannedTradingDays());
        plan.setWithdrawalPolicy(trim(request.withdrawalPolicy()));
        plan.setCompoundingBehavior(trim(request.compoundingBehavior()));
        plan.setStopAfterMaxLoss(request.stopAfterMaxLoss());
        plan.setStopAfterConsecutiveLosses(request.stopAfterConsecutiveLosses());
        plan.setPermittedSessions(trim(request.permittedSessions()));
        plan.setFocus(trim(request.focus()));
        plan.setNotes(trim(request.notes()));
        plan.setAllocationMode(request.allocationMode());
        plan.setActive(request.active());
        plan.setVersion(plan.getVersion() + 1);
        BigDecimal effectiveBaseline = first(planBaseline, baseline(account, profile));
        plan.setTargetAmount(resolveAmount(plan.getTargetType(), plan.getTargetValue(), effectiveBaseline));
        plan.setMaxLossAmount(resolveAmount(parseTargetType(plan.getMaxLossType()), plan.getMaxLossValue(),
                effectiveBaseline));
        AccountPeriodPlan saved = planRepository.save(plan);
        if ("MONTH".equals(context.periodType())) {
            updateChildAllocation(user, account, profile, legacyMonthPlan, context, "DAY",
                    request.dailyAllocationMode(), request.changeReason());
            updateChildAllocation(user, account, profile, legacyMonthPlan, context, "WEEK",
                    request.weeklyAllocationMode(), request.changeReason());
        }
        return toPlan(saved);
    }

    private void updateChildAllocation(User user,
                                       Account account,
                                       AccountGrowthProfile profile,
                                       MonthlyGrowthPlan legacyMonthPlan,
                                       PeriodContext monthContext,
                                       String periodType,
                                       String allocationMode,
                                       String changeReason) {
        if (allocationMode == null) return;
        PeriodContext context = GrowthCoachPeriodResolver.resolve(
                periodType, monthContext.anchorDate(), ZoneId.of(monthContext.timezone()), Clock.systemUTC());
        AccountPeriodPlan child = getOrCreate(user, account, profile, legacyMonthPlan, context);
        if (allocationMode.equals(child.getAllocationMode())) return;
        revisionRepository.save(AccountPeriodPlanRevision.builder()
                .user(user)
                .account(account)
                .plan(child)
                .version(child.getVersion())
                .snapshotJson(snapshot(child))
                .changeReason(changeReason.trim())
                .changedBy(user)
                .build());
        child.setAllocationMode(allocationMode);
        child.setVersion(child.getVersion() + 1);
        planRepository.save(child);
    }

    public List<PlanRevision> revisions(UUID planId, UUID userId, UUID accountId) {
        return revisionRepository.findByPlanIdOrderByVersionDesc(planId).stream()
                .filter(item -> item.getUser().getId().equals(userId) && item.getAccount().getId().equals(accountId))
                .map(item -> new PlanRevision(item.getId(), item.getPlan().getPeriodType(),
                        item.getPlan().getPeriodKey(), item.getVersion(), item.getChangeReason(), item.getChangedAt()))
                .toList();
    }

    @Transactional
    public void resetActivePlans(User user,
                                 Account account,
                                 AccountGrowthProfile profile,
                                 MonthlyGrowthPlan legacyMonthPlan,
                                 LocalDate effectiveDate,
                                 ZoneId zone,
                                 OffsetDateTime effectiveAt,
                                 String reason) {
        for (String periodType : List.of("DAY", "WEEK", "MONTH")) {
            PeriodContext context = GrowthCoachPeriodResolver.resolve(
                    periodType, effectiveDate, zone, Clock.systemUTC());
            AccountPeriodPlan plan = getOrCreate(user, account, profile, legacyMonthPlan, context);
            revisionRepository.save(AccountPeriodPlanRevision.builder()
                    .user(user)
                    .account(account)
                    .plan(plan)
                    .version(plan.getVersion())
                    .snapshotJson(snapshot(plan))
                    .changeReason(reason)
                    .changedBy(user)
                    .changedAt(effectiveAt)
                    .build());
            plan.setVersion(plan.getVersion() + 1);
            plan.setEffectiveFrom(effectiveAt);
            planRepository.save(plan);
        }
    }

    private AccountPeriodPlan getOrCreate(User user,
                                          Account account,
                                          AccountGrowthProfile profile,
                                          MonthlyGrowthPlan legacyMonthPlan,
                                          PeriodContext context) {
        return planRepository.findByAccountIdAndUserIdAndPeriodTypeAndPeriodKey(
                        account.getId(), user.getId(), context.periodType(), context.periodKey())
                .map(plan -> restoreTargetAmount(plan, account, profile, legacyMonthPlan, context))
                .orElseGet(() -> {
                    BigDecimal baseline = baseline(account, profile);
                    BigDecimal monthlyTarget = legacyMonthPlan == null
                            ? amountFromPct(profile.getMonthlyTargetPct(), baseline)
                            : first(legacyMonthPlan.getTargetAmount(),
                            amountFromPct(legacyMonthPlan.getTargetPct(), baseline), ZERO);
                    BigDecimal target = switch (context.periodType()) {
                        case "DAY" -> monthlyTarget.divide(new BigDecimal("20"), 4, RoundingMode.HALF_UP);
                        case "WEEK" -> monthlyTarget.divide(new BigDecimal("4"), 4, RoundingMode.HALF_UP);
                        default -> monthlyTarget;
                    };
                    Integer maxTrades = switch (context.periodType()) {
                        case "DAY" -> legacyMonthPlan == null ? 3 : legacyMonthPlan.getPlannedMaxTradesPerDay();
                        case "WEEK" -> legacyMonthPlan == null ? 12 : legacyMonthPlan.getPlannedMaxTradesPerWeek();
                        default -> legacyMonthPlan == null || legacyMonthPlan.getPlannedMaxTradesPerWeek() == null
                                ? null : legacyMonthPlan.getPlannedMaxTradesPerWeek() * 4;
                    };
                    BigDecimal loss = first(profile.getMaxDailyLossAmount(),
                            amountFromPct(profile.getMaxDailyRiskPct(), baseline));
                    if (!context.periodType().equals("DAY") && loss != null) {
                        loss = loss.multiply(context.periodType().equals("WEEK")
                                ? new BigDecimal("3") : new BigDecimal("8"));
                    }
                    return planRepository.save(AccountPeriodPlan.builder()
                            .user(user)
                            .account(account)
                            .periodType(context.periodType())
                            .periodKey(context.periodKey())
                            .timezone(context.timezone())
                            .targetType(GrowthTargetType.FIXED_AMOUNT)
                            .targetValue(scale(target))
                            .targetAmount(scale(target))
                            .maxLossType("FIXED_AMOUNT")
                            .maxLossValue(scale(loss))
                            .maxLossAmount(scale(loss))
                            .maxTrades(maxTrades)
                            .maxRiskBudget(loss)
                            .maxConsecutiveLosses(context.periodType().equals("DAY") ? 2 : 3)
                            .maxLosingDays(context.periodType().equals("DAY") ? null : 2)
                            .maxConsecutiveLosingDays(context.periodType().equals("WEEK") ? 2 : null)
                            .minimumReviewDays(context.periodType().equals("WEEK") ? 1 : null)
                            .defaultRiskPerTrade(profile.getDefaultRiskPerTradePct())
                            .minimumRr(legacyMonthPlan == null ? new BigDecimal("1.5") : legacyMonthPlan.getPlannedMinimumRr())
                            .stopAfterTarget(false)
                            .reduceRiskAfterTarget(true)
                            .riskReductionPct(new BigDecimal("50"))
                            .riskReductionType("PERCENTAGE")
                            .riskReductionValue(new BigDecimal("50"))
                            .riskReductionAfterDrawdownPct(new BigDecimal("50"))
                            .maximumDrawdownTolerance(loss)
                            .plannedTradingDays(context.periodType().equals("MONTH") ? 20 : null)
                            .compoundingBehavior(profile.isCompoundsMonthly() ? "COMPOUND" : "FIXED_BASELINE")
                            .stopAfterMaxLoss(true)
                            .stopAfterConsecutiveLosses(true)
                            .allocationMode(context.periodType().equals("MONTH") ? "MANUAL" : "AUTOMATIC")
                            .active(true)
                            .version(1)
                            .effectiveFrom(context.startsAt())
                            .createdBy(user)
                            .build());
                });
    }

    private AccountPeriodPlan restoreTargetAmount(AccountPeriodPlan plan,
                                                  Account account,
                                                  AccountGrowthProfile profile,
                                                  MonthlyGrowthPlan legacyMonthPlan,
                                                  PeriodContext context) {
        if (plan.getTargetAmount() != null) return plan;

        BigDecimal resolved = null;
        if ("MONTH".equals(context.periodType()) && legacyMonthPlan != null
                && Objects.equals(context.periodKey(), legacyMonthPlan.getMonthKey())) {
            resolved = legacyMonthPlan.getTargetAmount();
        }
        if (resolved == null && plan.getTargetType() == GrowthTargetType.PERCENTAGE) {
            resolved = amountFromPct(plan.getTargetValue(), baseline(account, profile));
        } else if (resolved == null && plan.getTargetType() == GrowthTargetType.FIXED_AMOUNT) {
            resolved = plan.getTargetValue();
        }
        if (resolved != null) plan.setTargetAmount(scale(resolved));
        return plan;
    }

    private void refreshAutomaticTarget(AccountPeriodPlan plan,
                                        AccountPeriodPlan monthPlan,
                                        PeriodContext monthContext,
                                        List<Trade> trades,
                                        LocalDate anchorDate) {
        if (plan == null || monthPlan == null || "MONTH".equals(plan.getPeriodType())
                || !"AUTOMATIC".equals(plan.getAllocationMode())) {
            return;
        }
        BigDecimal realisedMonth = sumTrades(tradesIn(monthContext, trades));
        BigDecimal remaining = first(monthPlan.getTargetAmount(), ZERO)
                .subtract(realisedMonth).max(ZERO);
        LocalDate monthEnd = monthContext.endsAtExclusive().toLocalDate();
        LocalDate cursor = anchorDate.isBefore(monthContext.startsAt().toLocalDate())
                ? monthContext.startsAt().toLocalDate() : anchorDate;
        int remainingTradingDays = 0;
        while (cursor.isBefore(monthEnd)) {
            DayOfWeek day = cursor.getDayOfWeek();
            if (day != DayOfWeek.SATURDAY && day != DayOfWeek.SUNDAY) remainingTradingDays++;
            cursor = cursor.plusDays(1);
        }
        int divisor = "DAY".equals(plan.getPeriodType())
                ? Math.max(1, remainingTradingDays)
                : Math.max(1, (int) Math.ceil(remainingTradingDays / 5.0));
        BigDecimal derived = remaining.divide(BigDecimal.valueOf(divisor), 4, RoundingMode.HALF_UP);
        plan.setTargetType(GrowthTargetType.FIXED_AMOUNT);
        plan.setTargetValue(derived);
        plan.setTargetAmount(derived);
    }

    private PeriodSummary summarize(PeriodContext context,
                                    AccountPeriodPlan plan,
                                    List<Trade> trades,
                                    List<AccountLedgerEvent> ledger,
                                    BigDecimal initial,
                                    BigDecimal floating,
                                    BigDecimal openRisk,
                                    boolean openRiskKnown) {
        List<Trade> before = validClosed(trades).stream()
                .filter(t -> t.getClosedAt().isBefore(context.startsAt())).toList();
        List<Trade> inPeriod = tradesIn(context, trades);
        List<AccountLedgerEvent> ledgerBefore = ledger.stream()
                .filter(e -> e.getEventTime().isBefore(context.startsAt())).toList();
        OffsetDateTime effectiveEnd = min(context.endsAtExclusive(), OffsetDateTime.now());
        List<AccountLedgerEvent> ledgerInPeriod = ledger.stream()
                .filter(e -> !e.getEventTime().isBefore(context.startsAt()) && e.getEventTime().isBefore(effectiveEnd))
                .toList();
        BigDecimal startBalance = add(initial, sumTrades(before), sumLedger(ledgerBefore));
        BigDecimal pnl = sumTrades(inPeriod);
        BigDecimal ledgerMovement = sumLedger(ledgerInPeriod);
        BigDecimal realisedBalance = add(startBalance, pnl, ledgerMovement);
        BigDecimal currentEquity = realisedBalance == null || floating == null ? null : realisedBalance.add(floating);
        BigDecimal realisedR = sum(inPeriod.stream().map(this::outcomeR).filter(Objects::nonNull).toList());
        BigDecimal riskUsed = sum(inPeriod.stream().map(Trade::getRiskAmount)
                .filter(Objects::nonNull).map(BigDecimal::abs).toList());
        long wins = inPeriod.stream().filter(t -> nvl(t.getPnlNet()).signum() > 0).count();
        long losses = inPeriod.stream().filter(t -> nvl(t.getPnlNet()).signum() < 0).count();
        BigDecimal target = first(plan.getTargetAmount(), ZERO);
        BigDecimal maxLoss = plan.getMaxLossAmount();
        BigDecimal riskBudget = plan.getMaxRiskBudget();
        int streak = currentLosingStreak(inPeriod);
        return new PeriodSummary(
                context.periodType(),
                scale(startBalance),
                scale(pnl),
                pct(pnl, startBalance),
                scale(realisedR),
                scale(ledgerMovement),
                scale(add(pnl, ledgerMovement)),
                scale(realisedBalance),
                scale(currentEquity),
                scale(floating),
                scale(target),
                GrowthCoachMath.progressPercent(pnl, target),
                GrowthCoachMath.remainingTarget(pnl, target),
                GrowthCoachMath.targetExceededAmount(pnl, target),
                GrowthCoachMath.distanceToBreakeven(pnl),
                GrowthCoachMath.remainingTarget(pnl, target),
                GrowthCoachMath.lossLimitUtilisationPercent(pnl, maxLoss),
                maxLoss == null ? null : scale(maxLoss.add(pnl.min(ZERO)).max(ZERO)),
                inPeriod.size(),
                (int) wins,
                (int) losses,
                inPeriod.isEmpty() ? ZERO : pct(BigDecimal.valueOf(wins), BigDecimal.valueOf(inPeriod.size())),
                inPeriod.isEmpty() ? ZERO : pnl.divide(BigDecimal.valueOf(inPeriod.size()), 4, RoundingMode.HALF_UP),
                scale(sum(inPeriod.stream().map(Trade::getPnlNet).filter(Objects::nonNull)
                        .filter(value -> value.signum() > 0).toList())),
                scale(sum(inPeriod.stream().map(Trade::getPnlNet).filter(Objects::nonNull)
                        .filter(value -> value.signum() < 0).toList())),
                scale(riskUsed),
                riskBudget == null ? null : scale(riskBudget.subtract(riskUsed)
                        .subtract(openRiskKnown && openRisk != null ? openRisk : ZERO).max(ZERO)),
                plan.getMaxTrades() == null ? null : Math.max(0, plan.getMaxTrades() - inPeriod.size()),
                streak,
                maximumDrawdown(inPeriod),
                openRiskKnown ? scale(openRisk) : null
        );
    }

    private TradingPermission permission(AccountGrowthProfile profile,
                                         AccountPeriodPlan dayPlan,
                                         AccountPeriodPlan weekPlan,
                                         AccountPeriodPlan monthPlan,
                                         PeriodSummary day,
                                         PeriodSummary week,
                                         PeriodSummary month,
                                         BigDecimal openRisk,
                                         boolean openRiskKnown) {
        List<String> secondary = new ArrayList<>();
        String state = "TRADING_PERMITTED";
        String primary = "growthCoach.permission.reasons.withinLimits";
        String action = "growthCoach.permission.actions.followPlan";
        String limit = "DAY";
        BigDecimal baseline = day.currentRealisedBalance();
        BigDecimal profileCap = amountFromPct(profile.getPreferredMaxRiskPerTradePct(), baseline);
        BigDecimal plannedResumeRisk = amountFromPct(
                first(dayPlan.getDefaultRiskPerTrade(), profile.getDefaultRiskPerTradePct()), baseline);
        BigDecimal resumeRisk = min(plannedResumeRisk, profileCap);
        BigDecimal cap = min(profileCap, day.riskRemaining(), week.riskRemaining(), month.riskRemaining());
        if (cap != null && openRiskKnown && openRisk != null) cap = cap.subtract(openRisk).max(ZERO);

        if (month.lossAllowanceRemaining() != null && month.lossAllowanceRemaining().signum() <= 0) {
            state = "MONTHLY_PROTECTION_MODE";
            primary = "growthCoach.permission.reasons.monthlyLoss";
            action = "growthCoach.permission.actions.stopAndReview";
            limit = "MONTH";
            cap = ZERO;
        } else if (week.lossAllowanceRemaining() != null && week.lossAllowanceRemaining().signum() <= 0) {
            state = "WEEKLY_LOCKOUT";
            primary = "growthCoach.permission.reasons.weeklyLoss";
            action = "growthCoach.permission.actions.stopForWeek";
            limit = "WEEK";
            cap = ZERO;
        } else if (day.lossAllowanceRemaining() != null && day.lossAllowanceRemaining().signum() <= 0) {
            state = "DAILY_LOCKOUT";
            primary = "growthCoach.permission.reasons.dailyLoss";
            action = "growthCoach.permission.actions.stopForDay";
            cap = ZERO;
        } else if (dayPlan.isStopAfterConsecutiveLosses()
                && dayPlan.getMaxConsecutiveLosses() != null
                && day.currentConsecutiveLosses() >= dayPlan.getMaxConsecutiveLosses()) {
            state = "DAILY_LOCKOUT";
            primary = "growthCoach.permission.reasons.consecutiveLosses";
            action = "growthCoach.permission.actions.stopForDay";
            cap = ZERO;
        } else if (!openRiskKnown && day.openRisk() == null) {
            state = "INSUFFICIENT_DATA";
            primary = "growthCoach.permission.reasons.openRiskUnknown";
            action = "growthCoach.permission.actions.completeRiskData";
            cap = null;
        } else if ((monthPlan.isReduceRiskAfterTarget() && month.targetProgressPct().compareTo(HUNDRED) >= 0)
                || (weekPlan.isReduceRiskAfterTarget() && week.targetProgressPct().compareTo(HUNDRED) >= 0)
                || (dayPlan.isReduceRiskAfterTarget() && day.targetProgressPct().compareTo(HUNDRED) >= 0)) {
            state = "REDUCED_RISK_ONLY";
            primary = "growthCoach.permission.reasons.targetReached";
            action = "growthCoach.permission.actions.protectResult";
            AccountPeriodPlan reductionPlan = month.targetProgressPct().compareTo(HUNDRED) >= 0
                    ? monthPlan : week.targetProgressPct().compareTo(HUNDRED) >= 0 ? weekPlan : dayPlan;
            cap = applyTargetReduction(cap, reductionPlan);
        } else if (drawdownReductionTriggered(week, weekPlan) || drawdownReductionTriggered(month, monthPlan)) {
            state = "REDUCED_RISK_ONLY";
            primary = "growthCoach.permission.reasons.drawdownReduction";
            action = "growthCoach.permission.actions.protectResult";
            AccountPeriodPlan reductionPlan = drawdownReductionTriggered(month, monthPlan) ? monthPlan : weekPlan;
            BigDecimal reduction = first(reductionPlan.getRiskReductionAfterDrawdownPct(), new BigDecimal("50"));
            if (cap != null) cap = cap.multiply(HUNDRED.subtract(reduction))
                    .divide(HUNDRED, 4, RoundingMode.HALF_UP);
        }
        if (month.targetProgressPct().compareTo(HUNDRED) >= 0) secondary.add("growthCoach.permission.reasons.monthlyTargetComplete");
        if (week.targetProgressPct().compareTo(HUNDRED) >= 0) secondary.add("growthCoach.permission.reasons.weeklyTargetComplete");
        return new TradingPermission(state, primary, secondary, scale(cap), pct(cap, baseline),
                scale(resumeRisk), pct(resumeRisk, baseline), scale(profileCap), pct(profileCap, baseline),
                minInteger(day.tradesRemaining(), week.tradesRemaining(), month.tradesRemaining()),
                limit, action);
    }

    private BigDecimal applyTargetReduction(BigDecimal cap, AccountPeriodPlan plan) {
        if (cap == null) return null;
        BigDecimal value = first(plan.getRiskReductionValue(), plan.getRiskReductionPct(), new BigDecimal("50"));
        if ("FIXED_AMOUNT".equals(plan.getRiskReductionType())) return cap.subtract(value).max(ZERO);
        return cap.multiply(HUNDRED.subtract(value.min(HUNDRED)))
                .divide(HUNDRED, 4, RoundingMode.HALF_UP);
    }

    private boolean drawdownReductionTriggered(PeriodSummary summary, AccountPeriodPlan plan) {
        BigDecimal threshold = first(plan.getMaximumDrawdownTolerance(), plan.getMaxLossAmount());
        return plan.getRiskReductionAfterDrawdownPct() != null && threshold != null
                && summary.maximumDrawdown().compareTo(threshold.multiply(new BigDecimal("0.5"))) >= 0;
    }

    private PlanAdherence adherence(AccountPeriodPlan plan, List<Trade> trades) {
        List<String> passed = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        List<String> unavailable = new ArrayList<>();
        check(plan.getMaxTrades() == null, trades.size() <= first(plan.getMaxTrades(), Integer.MAX_VALUE),
                "growthCoach.adherence.rules.maxTrades", passed, failed, unavailable);
        BigDecimal maxRisk = plan.getDefaultRiskPerTrade();
        boolean riskAvailable = !trades.isEmpty() && trades.stream().allMatch(t -> t.getRiskAmount() != null);
        boolean riskPassed = maxRisk == null || trades.stream().allMatch(t -> t.getRiskPercent() == null
                || t.getRiskPercent().compareTo(maxRisk) <= 0);
        check(!riskAvailable, riskPassed, "growthCoach.adherence.rules.riskPerTrade", passed, failed, unavailable);
        check(trades.stream().allMatch(t -> t.getStopLossPrice() == null),
                trades.stream().allMatch(t -> t.getStopLossPrice() != null),
                "growthCoach.adherence.rules.stopRecorded", passed, failed, unavailable);
        check(trades.stream().allMatch(t -> trim(t.getStrategyTag()) == null),
                trades.stream().allMatch(t -> trim(t.getStrategyTag()) != null),
                "growthCoach.adherence.rules.strategyRecorded", passed, failed, unavailable);
        check(trades.stream().allMatch(t -> trim(t.getSetup()) == null),
                trades.stream().allMatch(t -> trim(t.getSetup()) != null),
                "growthCoach.adherence.rules.setupRecorded", passed, failed, unavailable);
        int applicable = passed.size() + failed.size();
        int score = applicable == 0 ? 0 : (int) Math.round(100.0 * passed.size() / applicable);
        int coverage = (int) Math.round(100.0 * applicable / (applicable + unavailable.size()));
        String confidence = unavailable.isEmpty() ? "HIGH" : unavailable.size() <= 2 ? "MEDIUM" : "LOW";
        return new PlanAdherence(score, passed.size(), failed.size(), unavailable.size(), coverage, confidence,
                passed, failed, unavailable);
    }

    private List<MetricConfidence> confidence(List<Trade> trades,
                                              BigDecimal initial,
                                              BigDecimal floating,
                                              BigDecimal openRisk,
                                              boolean openRiskKnown) {
        List<Trade> closed = validClosed(trades);
        int missingRisk = (int) closed.stream().filter(t -> outcomeR(t) == null).count();
        int missingStrategy = (int) closed.stream().filter(t -> trim(t.getStrategyTag()) == null).count();
        int missingSetup = (int) closed.stream().filter(t -> trim(t.getSetup()) == null).count();
        int missingSession = (int) closed.stream().filter(t -> t.getSession() == null).count();
        int openCount = (int) trades.stream().filter(t -> t.getStatus() == TradeStatus.OPEN).count();
        return List.of(
                metric("BALANCE", initial == null ? 20 : 95, initial == null ? 1 : 0,
                        "growthCoach.confidenceMetrics.balance", List.of("CURRENT_REALISED_BALANCE")),
                metric("REALISED_PNL", closed.isEmpty() ? 45 : 98, 0,
                        "growthCoach.confidenceMetrics.realisedPnl", List.of("TRADING_PNL")),
                metric("EQUITY", floating == null && openCount > 0 ? 30 : 90,
                        floating == null && openCount > 0 ? openCount : 0,
                        "growthCoach.confidenceMetrics.equity", List.of("CURRENT_EQUITY")),
                metric("R_METRICS", coverageScore(closed.size(), missingRisk), missingRisk,
                        "growthCoach.confidenceMetrics.rMetrics", List.of("REALISED_R", "RISK_USED")),
                metric("RISK", openRiskKnown ? 90 : 35, openRiskKnown ? 0 : openCount,
                        "growthCoach.confidenceMetrics.risk", List.of("OPEN_RISK", "PERMISSION")),
                metric("STRATEGY", coverageScore(closed.size(), missingStrategy), missingStrategy,
                        "growthCoach.confidenceMetrics.strategy", List.of("PERFORMANCE_DRIVERS")),
                metric("SETUP", coverageScore(closed.size(), missingSetup), missingSetup,
                        "growthCoach.confidenceMetrics.setup", List.of("PERFORMANCE_DRIVERS")),
                metric("SESSION", coverageScore(closed.size(), missingSession), missingSession,
                        "growthCoach.confidenceMetrics.session", List.of("PERFORMANCE_DRIVERS")),
                metric("PROJECTION", closed.size() >= 20 && missingRisk == 0 ? 80 : 30,
                        Math.max(0, 20 - closed.size()) + missingRisk,
                        "growthCoach.confidenceMetrics.projection", List.of("PROJECTION"))
        );
    }

    private MetricConfidence metric(String name, int score, int missing, String reason, List<String> affected) {
        String status = score >= 80 ? "HIGH" : score >= 55 ? "MEDIUM" : score >= 30 ? "LOW" : "INSUFFICIENT";
        return new MetricConfidence(name, status, score, reason, missing, affected,
                "growthCoach.confidenceMetrics.action");
    }

    private List<OperatingChartPoint> chart(PeriodContext context,
                                            AccountPeriodPlan plan,
                                            PeriodSummary summary,
                                            List<Trade> trades,
                                            List<AccountLedgerEvent> ledger,
                                            BigDecimal initial,
                                            BigDecimal floating) {
        ZoneId zone = ZoneId.of(context.timezone());
        Map<LocalDate, BigDecimal> pnlByDay = tradesIn(context, trades).stream()
                .collect(Collectors.groupingBy(t -> t.getClosedAt().atZoneSameInstant(zone).toLocalDate(),
                        Collectors.reducing(ZERO, t -> nvl(t.getPnlNet()), BigDecimal::add)));
        Map<LocalDate, BigDecimal> riskByDay = tradesIn(context, trades).stream()
                .collect(Collectors.groupingBy(t -> t.getClosedAt().atZoneSameInstant(zone).toLocalDate(),
                        Collectors.reducing(ZERO, t -> t.getRiskAmount() == null ? ZERO : t.getRiskAmount().abs(), BigDecimal::add)));
        Map<LocalDate, BigDecimal> rByDay = tradesIn(context, trades).stream()
                .collect(Collectors.groupingBy(t -> t.getClosedAt().atZoneSameInstant(zone).toLocalDate(),
                        Collectors.reducing(ZERO, t -> first(outcomeR(t), ZERO), BigDecimal::add)));
        Map<LocalDate, BigDecimal> ledgerByDay = ledger.stream()
                .filter(e -> !e.getEventTime().isBefore(context.startsAt()) && e.getEventTime().isBefore(context.endsAtExclusive()))
                .collect(Collectors.groupingBy(e -> e.getEventTime().atZoneSameInstant(zone).toLocalDate(),
                        Collectors.reducing(ZERO, this::signedLedger, BigDecimal::add)));
        long totalDays = Duration.between(context.startsAt().toInstant(), context.endsAtExclusive().toInstant()).toDays();
        BigDecimal cumulativePnl = ZERO;
        BigDecimal cumulativeLedger = ZERO;
        BigDecimal cumulativeRisk = ZERO;
        BigDecimal cumulativeR = ZERO;
        List<OperatingChartPoint> result = new ArrayList<>();
        LocalDate start = context.startsAt().atZoneSameInstant(zone).toLocalDate();
        LocalDate end = context.endsAtExclusive().atZoneSameInstant(zone).toLocalDate();
        BigDecimal targetAmount = first(plan.getTargetAmount(), summary.targetAmount(), ZERO);
        for (LocalDate date = start; date.isBefore(end); date = date.plusDays(1)) {
            BigDecimal daily = pnlByDay.getOrDefault(date, ZERO);
            cumulativePnl = cumulativePnl.add(daily);
            cumulativeLedger = cumulativeLedger.add(ledgerByDay.getOrDefault(date, ZERO));
            cumulativeRisk = cumulativeRisk.add(riskByDay.getOrDefault(date, ZERO));
            BigDecimal dailyR = rByDay.getOrDefault(date, ZERO);
            cumulativeR = cumulativeR.add(dailyR);
            BigDecimal fraction = BigDecimal.valueOf(ChronoUnit.DAYS.between(start, date) + 1)
                    .divide(BigDecimal.valueOf(Math.max(1, totalDays)), 6, RoundingMode.HALF_UP);
            BigDecimal balance = add(summary.periodStartBalance(), cumulativePnl, cumulativeLedger);
            result.add(new OperatingChartPoint(
                    date, scale(cumulativePnl), scale(daily), scale(cumulativeR), scale(dailyR), scale(balance),
                    floating == null ? null : scale(balance.add(floating)),
                    scale(targetAmount.multiply(fraction)),
                    scale(targetAmount),
                    plan.getMaxLossAmount() == null ? null : plan.getMaxLossAmount().negate(),
                    summary.periodStartBalance() == null || plan.getMaxLossAmount() == null ? null
                            : summary.periodStartBalance().subtract(plan.getMaxLossAmount()),
                    scale(cumulativeRisk)
            ));
        }
        return result;
    }

    private List<ChartMarker> markers(PeriodContext context, List<Trade> trades, List<AccountLedgerEvent> ledger) {
        List<ChartMarker> result = new ArrayList<>();
        tradesIn(context, trades).forEach(t -> result.add(new ChartMarker(
                "trade-" + t.getId(), "TRADE_CLOSE", t.getClosedAt(), t.getPnlNet(),
                t.getSymbol(), t.getId(), null)));
        ledger.stream()
                .filter(e -> !e.getEventTime().isBefore(context.startsAt()) && e.getEventTime().isBefore(context.endsAtExclusive()))
                .forEach(e -> result.add(new ChartMarker(
                        "ledger-" + e.getId(), e.getEventType().name(), e.getEventTime(), signedLedger(e),
                        e.getDescription(), null, e.getId())));
        result.sort(Comparator.comparing(ChartMarker::timestamp));
        return result;
    }

    private List<PlanRevision> history(AccountPeriodPlan plan) {
        return revisionRepository.findByPlanIdOrderByVersionDesc(plan.getId()).stream()
                .limit(20)
                .map(item -> new PlanRevision(item.getId(), plan.getPeriodType(), plan.getPeriodKey(),
                        item.getVersion(), item.getChangeReason(), item.getChangedAt()))
                .toList();
    }

    private PeriodComparison comparison(PeriodSummary summary, AccountPeriodPlan plan, PlanAdherence adherence) {
        return new PeriodComparison(summary.periodType(), summary.realisedTradingPnl(), summary.realisedPnlPct(),
                summary.realisedR(), summary.targetAmount(), summary.targetProgressPct(), summary.completedTrades(),
                summary.winRate(), summary.averageTrade(), summary.riskUsed(), summary.riskRemaining(),
                summary.maximumDrawdown(), adherence.score(), adherence.evaluationCoverage(),
                periodStatus(summary, plan));
    }

    private String periodStatus(PeriodSummary summary, AccountPeriodPlan plan) {
        if (!plan.isActive()) return "INACTIVE";
        if (summary.lossAllowanceRemaining() != null && summary.lossAllowanceRemaining().signum() <= 0) {
            return "LOSS_LIMIT_REACHED";
        }
        if (summary.targetExceededAmount() != null && summary.targetExceededAmount().signum() > 0) {
            return "TARGET_EXCEEDED";
        }
        if (summary.targetProgressPct().compareTo(HUNDRED) >= 0) return "TARGET_ACHIEVED";
        if (summary.realisedTradingPnl().signum() < 0) return "LOSS_WITHIN_LIMIT";
        if (summary.realisedTradingPnl().signum() > 0) return "PROFITABLE_BELOW_TARGET";
        return "FLAT";
    }

    private ClosedTradeActivity toClosedTrade(Trade trade) {
        return new ClosedTradeActivity(trade.getId(), trade.getSymbol(),
                trade.getDirection() == null ? null : trade.getDirection().name(), trade.getOpenedAt(),
                trade.getClosedAt(), scale(trade.getPnlNet()), outcomeR(trade), trade.getRiskAmount(),
                trade.getStrategyTag(), trade.getSetup(),
                trade.getSession() == null ? null : trade.getSession().name());
    }

    private PeriodPlan toPlan(AccountPeriodPlan plan) {
        return new PeriodPlan(plan.getId(), plan.getPeriodType(), plan.getPeriodKey(), plan.getTimezone(),
                plan.getTargetType().name(), plan.getTargetValue(), plan.getTargetAmount(),
                plan.getMaxLossType(), plan.getMaxLossValue(), plan.getMaxLossAmount(), plan.getMaxTrades(),
                plan.getMaxRiskBudget(), plan.getMaxConsecutiveLosses(), plan.getMaxLosingDays(),
                plan.getMaxConsecutiveLosingDays(), plan.getMinimumReviewDays(),
                plan.getDefaultRiskPerTrade(), plan.getMinimumRr(), plan.isStopAfterTarget(),
                plan.isReduceRiskAfterTarget(), plan.getRiskReductionPct(), plan.getRiskReductionType(),
                plan.getRiskReductionValue(), plan.getRiskReductionAfterDrawdownPct(),
                plan.getMaximumDrawdownTolerance(), plan.getPlannedTradingDays(), plan.getWithdrawalPolicy(),
                plan.getCompoundingBehavior(), plan.isStopAfterMaxLoss(),
                plan.isStopAfterConsecutiveLosses(), plan.getPermittedSessions(), plan.getFocus(), plan.getNotes(),
                plan.getAllocationMode(), plan.isActive(), plan.getVersion(), plan.getEffectiveFrom(), plan.getUpdatedAt());
    }

    private void validate(PeriodPlanRequest request, AccountGrowthProfile profile) {
        if (request.targetType() != GrowthTargetType.PERCENTAGE
                && request.targetType() != GrowthTargetType.FIXED_AMOUNT
                && request.targetType() != GrowthTargetType.R_MULTIPLE) {
            throw new IllegalArgumentException("Unsupported target type for a day, week, or month plan");
        }
        if (request.targetType() == GrowthTargetType.PERCENTAGE && request.targetValue().compareTo(HUNDRED) > 0) {
            throw new IllegalArgumentException("Percentage target cannot exceed 100%");
        }
        if (request.defaultRiskPerTrade() != null && profile.getPreferredMaxRiskPerTradePct() != null
                && request.defaultRiskPerTrade().compareTo(profile.getPreferredMaxRiskPerTradePct()) > 0) {
            throw new IllegalArgumentException("Default risk cannot exceed the account risk limit");
        }
        BigDecimal hardDrawdown = profile.getMaxTotalDrawdownAmount();
        if (hardDrawdown != null && request.maxLossType().equals("FIXED_AMOUNT")
                && request.maxLossValue() != null && request.maxLossValue().compareTo(hardDrawdown) > 0) {
            throw new IllegalArgumentException("Maximum loss cannot exceed the account drawdown limit");
        }
    }

    private String snapshot(AccountPeriodPlan plan) {
        try {
            return objectMapper.writeValueAsString(toPlan(plan));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not preserve the previous plan version", exception);
        }
    }

    private List<Trade> validClosed(List<Trade> trades) {
        return trades.stream().filter(t -> t.getStatus() == TradeStatus.CLOSED
                && t.getClosedAt() != null && t.getPnlNet() != null).toList();
    }

    private List<Trade> tradesIn(PeriodContext context, List<Trade> trades) {
        return validClosed(trades).stream()
                .filter(t -> !t.getClosedAt().isBefore(context.startsAt())
                        && t.getClosedAt().isBefore(context.endsAtExclusive()))
                .sorted(Comparator.comparing(Trade::getClosedAt))
                .toList();
    }

    private BigDecimal maximumDrawdown(List<Trade> trades) {
        BigDecimal running = ZERO;
        BigDecimal peak = ZERO;
        BigDecimal maxDrawdown = ZERO;
        for (Trade trade : trades) {
            running = running.add(nvl(trade.getPnlNet()));
            peak = peak.max(running);
            maxDrawdown = maxDrawdown.max(peak.subtract(running));
        }
        return scale(maxDrawdown);
    }

    private int currentLosingStreak(List<Trade> trades) {
        int result = 0;
        List<Trade> ordered = new ArrayList<>(trades);
        ordered.sort(Comparator.comparing(Trade::getClosedAt).reversed());
        for (Trade trade : ordered) {
            if (nvl(trade.getPnlNet()).signum() < 0) result++;
            else break;
        }
        return result;
    }

    private BigDecimal outcomeR(Trade trade) {
        if (trade.getRMultiple() != null) return scale(trade.getRMultiple());
        if (trade.getPnlNet() == null || trade.getRiskAmount() == null || trade.getRiskAmount().signum() == 0) return null;
        return trade.getPnlNet().divide(trade.getRiskAmount().abs(), 4, RoundingMode.HALF_UP);
    }

    private BigDecimal sumTrades(List<Trade> trades) {
        return sum(trades.stream().map(Trade::getPnlNet).filter(Objects::nonNull).toList());
    }

    private BigDecimal sumLedger(List<AccountLedgerEvent> events) {
        return sum(events.stream().map(this::signedLedger).toList());
    }

    private BigDecimal signedLedger(AccountLedgerEvent event) {
        BigDecimal amount = nvl(event.getAmount());
        if (event.getEventType().permitsSignedAmount()) return amount;
        return event.getEventType().isDebit() ? amount.abs().negate() : amount.abs();
    }

    private BigDecimal baseline(Account account, AccountGrowthProfile profile) {
        return first(profile.getInitialCapital(), account.getStartingBalance(), ZERO);
    }

    private GrowthTargetType parseTargetType(String value) {
        return switch (value) {
            case "PERCENTAGE" -> GrowthTargetType.PERCENTAGE;
            case "R_MULTIPLE" -> GrowthTargetType.R_MULTIPLE;
            default -> GrowthTargetType.FIXED_AMOUNT;
        };
    }

    private BigDecimal resolveAmount(GrowthTargetType type, BigDecimal value, BigDecimal baseline) {
        if (value == null) return null;
        return type == GrowthTargetType.PERCENTAGE ? amountFromPct(value, baseline) : scale(value);
    }

    private BigDecimal amountFromPct(BigDecimal pct, BigDecimal amount) {
        if (pct == null || amount == null) return null;
        return amount.multiply(pct).divide(HUNDRED, 4, RoundingMode.HALF_UP);
    }

    private BigDecimal pct(BigDecimal numerator, BigDecimal denominator) {
        if (numerator == null || denominator == null || denominator.signum() == 0) return null;
        return numerator.multiply(HUNDRED).divide(denominator, 4, RoundingMode.HALF_UP);
    }

    private BigDecimal add(BigDecimal... values) {
        BigDecimal result = ZERO;
        boolean any = false;
        for (BigDecimal value : values) {
            if (value != null) {
                result = result.add(value);
                any = true;
            }
        }
        return any ? scale(result) : null;
    }

    private BigDecimal sum(List<BigDecimal> values) {
        return scale(values.stream().reduce(ZERO, BigDecimal::add));
    }

    private BigDecimal nvl(BigDecimal value) {
        return value == null ? ZERO : value;
    }

    private BigDecimal scale(BigDecimal value) {
        return value == null ? null : value.setScale(4, RoundingMode.HALF_UP);
    }

    private BigDecimal min(BigDecimal... values) {
        return Arrays.stream(values).filter(Objects::nonNull).min(BigDecimal::compareTo).orElse(null);
    }

    private Integer minInteger(Integer... values) {
        return Arrays.stream(values).filter(Objects::nonNull).min(Integer::compareTo).orElse(null);
    }

    @SafeVarargs
    private final <T> T first(T... values) {
        return Arrays.stream(values).filter(Objects::nonNull).findFirst().orElse(null);
    }

    private OffsetDateTime min(OffsetDateTime left, OffsetDateTime right) {
        return left.isBefore(right) ? left : right;
    }

    private String trim(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }

    private int coverageScore(int total, int missing) {
        return total == 0 ? 20 : (int) Math.round(100.0 * (total - missing) / total);
    }

    private void check(boolean unavailableCondition,
                       boolean passedCondition,
                       String key,
                       List<String> passed,
                       List<String> failed,
                       List<String> unavailable) {
        if (unavailableCondition) unavailable.add(key);
        else if (passedCondition) passed.add(key);
        else failed.add(key);
    }
}
