package com.tradevault.service.growthcoach;

import com.tradevault.analytics.AnalyticsService;
import com.tradevault.domain.entity.*;
import com.tradevault.domain.enums.*;
import com.tradevault.dto.analytics.AnalyticsResponse;
import com.tradevault.dto.analytics.BreakdownRow;
import com.tradevault.dto.growthcoach.GrowthCoachResponse;
import com.tradevault.dto.growthcoach.GrowthProfileRequest;
import com.tradevault.dto.growthcoach.LedgerEventRequest;
import com.tradevault.dto.growthcoach.MonthlyGrowthPlanRequest;
import com.tradevault.dto.session.LiveQuoteResponse;
import com.tradevault.repository.*;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.QuoteService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Value;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.tradevault.dto.growthcoach.GrowthCoachResponse.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class GrowthCoachService {
    private static final ZoneId DEFAULT_ZONE = ZoneId.of("Europe/Bucharest");
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
    @Value("${growthcoach.projection-min-sample:20}")
    private int projectionMinSample = 20;
    @Value("${growthcoach.simulation-count:5000}")
    private int simulationCount = 5_000;
    @Value("${growthcoach.losing-streak-safety-buffer:2}")
    private int losingStreakSafetyBuffer = 2;

    private final CurrentUserService currentUserService;
    private final AccountRepository accountRepository;
    private final TradeRepository tradeRepository;
    private final AccountGrowthProfileRepository profileRepository;
    private final MonthlyGrowthPlanRepository planRepository;
    private final MonthlyGrowthPlanRevisionRepository planRevisionRepository;
    private final AccountLedgerEventRepository ledgerRepository;
    private final AnalyticsService analyticsService;
    private final QuoteService quoteService;
    private final GrowthCoachMessageEngine messageEngine;

    @Transactional
    public GrowthCoachResponse getPage(UUID accountId, String monthKey) {
        User user = currentUserService.getCurrentUser();
        YearMonth month = parseMonth(monthKey);
        if (accountId == null) {
            List<Account> accounts = accountRepository.findByUserIdOrderByNameAsc(user.getId());
            List<PortfolioAccount> summaries = accounts.stream()
                    .filter(account -> account.getStatus() == AccountStatus.ACTIVE)
                    .map(account -> buildPortfolioAccount(user, account, month))
                    .toList();
            return new GrowthCoachResponse("PORTFOLIO", OffsetDateTime.now(), true, summaries, null);
        }

        Account account = requireOwnedAccount(accountId, user.getId());
        Detail detail = buildDetail(user, account, month);
        return new GrowthCoachResponse("ACCOUNT", OffsetDateTime.now(), false, List.of(), detail);
    }

    @Transactional
    public GrowthProfile updateProfile(UUID accountId, GrowthProfileRequest request) {
        User user = currentUserService.getCurrentUser();
        Account account = requireOwnedAccount(accountId, user.getId());
        AccountGrowthProfile profile = getOrCreateProfile(user, account);

        validateProfile(request);
        String nextCurrency = normalizeCurrency(request.currency());
        if (nextCurrency != null && !Objects.equals(normalizeCurrency(account.getAccountCurrency()), nextCurrency)) {
            if (tradeRepository.countByAccount_Id(accountId) > 0) {
                throw new IllegalArgumentException("Account currency cannot be changed while linked trades exist");
            }
            account.setAccountCurrency(nextCurrency);
        }
        account.setAccountType(request.accountType().name());
        account.setStartingBalance(request.initialCapital());
        accountRepository.save(account);

        profile.setAccountType(request.accountType());
        profile.setInitialCapital(scale(request.initialCapital()));
        profile.setCapitalSource(request.capitalSource());
        profile.setDefaultRiskPerTradePct(scale(request.defaultRiskPerTradePct()));
        profile.setPreferredMaxRiskPerTradePct(scale(request.preferredMaxRiskPerTradePct()));
        profile.setMaxConcurrentRiskPct(scale(request.maxConcurrentRiskPct()));
        profile.setMaxDailyRiskPct(scale(request.maxDailyRiskPct()));
        profile.setMaxDailyLossAmount(scale(request.maxDailyLossAmount()));
        profile.setMaxTotalDrawdownPct(scale(request.maxTotalDrawdownPct()));
        profile.setMaxTotalDrawdownAmount(scale(request.maxTotalDrawdownAmount()));
        profile.setDrawdownType(request.drawdownType());
        profile.setMonthlyTargetPct(scale(request.monthlyTargetPct()));
        profile.setCompoundsMonthly(request.compoundsMonthly());
        profile.setProfitTargetPct(scale(request.profitTargetPct()));
        profile.setProfitTargetAmount(scale(request.profitTargetAmount()));
        profile.setMinimumTradingDays(request.minimumTradingDays());
        profile.setChallengeDeadline(request.challengeDeadline());
        profile.setConsistencyRuleType(trimToNull(request.consistencyRuleType()));
        profile.setConsistencyRuleValue(scale(request.consistencyRuleValue()));
        profile.setTrailingDrawdownEnabled(request.trailingDrawdownEnabled());
        profile.setTrailingDrawdownType(trimToNull(request.trailingDrawdownType()));
        profile.setTrailingDrawdownAmount(scale(request.trailingDrawdownAmount()));
        profile.setTrailingDrawdownHighWaterMark(scale(request.trailingDrawdownHighWaterMark()));
        profile.setContractLimit(request.contractLimit());
        profile.setScalingRestrictions(trimToNull(request.scalingRestrictions()));
        profile.setProfitSplitPct(scale(request.profitSplitPct()));
        profile.setPayoutThreshold(scale(request.payoutThreshold()));
        profile.setPayoutFrequency(trimToNull(request.payoutFrequency()));
        profile.setPayoutEligibilityRules(trimToNull(request.payoutEligibilityRules()));
        profile.setResetDetails(trimToNull(request.resetDetails()));
        profile.setActive(true);
        GrowthProfile result = toProfile(profileRepository.save(profile));
        log.info("Growth profile updated [userId={}, accountId={}, accountType={}]", user.getId(), accountId, request.accountType());
        return result;
    }

    @Transactional
    public MonthlyPlan updatePlan(UUID accountId, String monthKey, MonthlyGrowthPlanRequest request) {
        User user = currentUserService.getCurrentUser();
        Account account = requireOwnedAccount(accountId, user.getId());
        AccountGrowthProfile profile = getOrCreateProfile(user, account);
        YearMonth month = parseMonth(monthKey);
        MonthlyGrowthPlan plan = getOrCreatePlan(user, account, profile, month, loadTrades(user.getId(), accountId));
        validatePlan(request);

        boolean targetChanged = plan.getTargetType() != request.targetType()
                || different(plan.getTargetPct(), request.targetPct())
                || different(plan.getTargetAmount(), request.targetAmount())
                || different(plan.getTargetR(), request.targetR());
        if (targetChanged) {
            planRevisionRepository.save(MonthlyGrowthPlanRevision.builder()
                    .user(user)
                    .account(account)
                    .plan(plan)
                    .previousTargetType(plan.getTargetType() == null ? null : plan.getTargetType().name())
                    .previousTargetPct(plan.getTargetPct())
                    .previousTargetAmount(plan.getTargetAmount())
                    .previousTargetR(plan.getTargetR())
                    .newTargetType(request.targetType().name())
                    .newTargetPct(scale(request.targetPct()))
                    .newTargetAmount(scale(request.targetAmount()))
                    .newTargetR(scale(request.targetR()))
                    .reason(trimToNull(request.changeReason()))
                    .build());
            plan.setTargetChangedAt(OffsetDateTime.now());
        }

        plan.setTargetType(request.targetType());
        plan.setTargetBasis(request.targetBasis().trim().toUpperCase(Locale.ROOT));
        plan.setTargetPct(scale(request.targetPct()));
        plan.setTargetR(scale(request.targetR()));
        plan.setPlannedRiskPerTradePct(scale(request.plannedRiskPerTradePct()));
        plan.setHardMaxRiskPerTradePct(scale(request.hardMaxRiskPerTradePct()));
        plan.setPlannedMaxTradesPerDay(request.plannedMaxTradesPerDay());
        plan.setPlannedMaxTradesPerWeek(request.plannedMaxTradesPerWeek());
        plan.setPlannedMinimumRr(scale(request.plannedMinimumRr()));
        plan.setTargetAmount(resolveTargetAmount(plan, profile, request.targetAmount()));
        MonthlyPlan saved = toPlan(planRepository.save(plan));
        log.info("Monthly growth plan updated [userId={}, accountId={}, month={}, targetType={}]",
                user.getId(), accountId, month, request.targetType());
        return saved;
    }

    @Transactional
    public LedgerEvent createLedgerEvent(UUID accountId, LedgerEventRequest request) {
        User user = currentUserService.getCurrentUser();
        Account account = requireOwnedAccount(accountId, user.getId());
        AccountGrowthProfile profile = getOrCreateProfile(user, account);
        AccountLedgerEvent event = new AccountLedgerEvent();
        applyLedgerRequest(event, user, account, request);
        AccountLedgerEvent saved = ledgerRepository.save(event);
        if (request.eventType() == LedgerEventType.INITIAL_CAPITAL && profile.getInitialCapital() == null) {
            profile.setInitialCapital(saved.getAmount().abs());
            profile.setCapitalSource(CapitalSource.USER_ENTERED);
            profileRepository.save(profile);
        }
        log.info("Account ledger event created [userId={}, accountId={}, type={}, eventId={}]",
                user.getId(), accountId, request.eventType(), saved.getId());
        return toLedgerEvent(saved);
    }

    @Transactional
    public LedgerEvent updateLedgerEvent(UUID accountId, UUID eventId, LedgerEventRequest request) {
        User user = currentUserService.getCurrentUser();
        Account account = requireOwnedAccount(accountId, user.getId());
        AccountLedgerEvent event = ledgerRepository.findByIdAndAccountIdAndUserId(eventId, accountId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Ledger event was not found"));
        applyLedgerRequest(event, user, account, request);
        log.info("Account ledger event updated [userId={}, accountId={}, eventId={}]", user.getId(), accountId, eventId);
        return toLedgerEvent(ledgerRepository.save(event));
    }

    @Transactional
    public void deleteLedgerEvent(UUID accountId, UUID eventId) {
        User user = currentUserService.getCurrentUser();
        requireOwnedAccount(accountId, user.getId());
        AccountLedgerEvent event = ledgerRepository.findByIdAndAccountIdAndUserId(eventId, accountId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Ledger event was not found"));
        ledgerRepository.delete(event);
        log.info("Account ledger event deleted [userId={}, accountId={}, eventId={}]", user.getId(), accountId, eventId);
    }

    private Detail buildDetail(User user, Account account, YearMonth month) {
        AccountGrowthProfile profile = getOrCreateProfile(user, account);
        List<Trade> trades = loadTrades(user.getId(), account.getId());
        ZoneId zone = resolveZone(account, user);
        ZonedDateTime monthStart = month.atDay(1).atStartOfDay(zone);
        ZonedDateTime monthEnd = month.plusMonths(1).atDay(1).atStartOfDay(zone);
        OffsetDateTime from = monthStart.toOffsetDateTime();
        OffsetDateTime toExclusive = monthEnd.toOffsetDateTime();
        OffsetDateTime toInclusive = toExclusive.minusNanos(1);

        MonthlyGrowthPlan plan = getOrCreatePlan(user, account, profile, month, trades);
        List<Trade> validClosed = validClosed(trades);
        List<Trade> monthClosed = validClosed.stream()
                .filter(trade -> !trade.getClosedAt().isBefore(from) && trade.getClosedAt().isBefore(toExclusive))
                .toList();
        List<AccountLedgerEvent> ledgerEvents = ledgerRepository
                .findByAccountIdAndUserIdOrderByEventTimeAsc(account.getId(), user.getId());
        OpenExposure exposure = buildOpenExposure(user.getId(), account, trades);
        BigDecimal initialCapital = resolveInitialCapital(profile, ledgerEvents);
        BigDecimal ledgerNet = ledgerNet(ledgerEvents);
        BigDecimal lifetimePnl = sum(validClosed, Trade::getPnlNet);
        BigDecimal realisedBalance = add(initialCapital, ledgerNet, lifetimePnl);
        BigDecimal floating = exposure.floatingPnlAvailable() ? nvl(exposure.totalFloatingPnl()) : null;
        BigDecimal equity = realisedBalance == null || floating == null ? null : realisedBalance.add(floating);
        BigDecimal monthPnl = sum(monthClosed, Trade::getPnlNet);

        AnalyticsResponse realisedPerformance = analyticsService.summarize(
                from, toInclusive, null, null, null,
                account.getId().toString(), null, null, null, null, null,
                "CLOSE", false, null);

        CapitalRules capitalRules = buildCapitalRules(profile, plan, account, validClosed, monthClosed, realisedBalance, equity, floating, exposure, zone);
        CapitalSummary capital = buildCapitalSummary(profile, initialCapital, ledgerNet, lifetimePnl,
                realisedBalance, floating, equity, exposure, capitalRules);
        TargetSummary target = buildTarget(profile, plan, monthPnl, floating, capitalRules.riskReferenceCapital(), month, zone);
        HistoricalSample sample = selectProjectionSample(validClosed);
        Confidence confidence = buildConfidence(trades, validClosed, exposure, plan);
        RiskPlan riskPlan = buildRiskPlan(profile, plan, capitalRules, exposure, validClosed, confidence);
        Feasibility feasibility = buildFeasibility(target, riskPlan, sample, confidence, plan);
        Projection projection = buildProjection(account, month, target, riskPlan, sample, confidence, capitalRules, plan, zone);
        DataQuality dataQuality = buildDataQuality(trades, validClosed, exposure, plan);
        PerformanceDrivers drivers = buildPerformanceDrivers(monthClosed, realisedPerformance);
        List<Scenario> scenarios = buildScenarios(riskPlan, projection, capitalRules);
        int currentStreak = currentLosingStreak(monthClosed);
        BigDecimal expectedCalendarProgress = expectedCalendarProgress(month, zone);
        BigDecimal costPct = costPct(realisedPerformance);
        BigDecimal costR = sample.expectancyR() == null || monthClosed.isEmpty()
                ? null
                : average(monthClosed.stream().map(this::costInR).filter(Objects::nonNull).toList());
        List<CoachMessage> messages = messageEngine.evaluate(new GrowthCoachMessageEngine.Context(
                initialCapital,
                exposure.openRiskKnown(),
                exposure.openTradeCount(),
                exposure.tradesWithoutStop() + exposure.tradesWithoutQuantity(),
                riskPlan.state(),
                capital.dailyLossRemaining(),
                target.targetReached(),
                target.realisedCurrentMonthPnl().subtract(target.targetAmount()),
                monthClosed.size(),
                plan.getTargetPct(),
                target.targetAmount(),
                target.realisedProgressPct(),
                expectedCalendarProgress,
                feasibility.classification(),
                target.requiredR(),
                target.tradingDaysRemaining(),
                floating,
                plan.getPlannedRiskPerTradePct(),
                riskPlan.recommendedRiskPct(),
                riskPlan.recommendedRiskAmount(),
                currentStreak,
                sample.expectancyR(),
                sample.outcomes().size(),
                dataQuality.inconsistentPnl(),
                costPct,
                costR
        ));

        return new Detail(
                new AccountInfo(account.getId(), account.getName(), account.getBroker(), profile.getAccountType().name(),
                        account.getAccountCurrency(), zone.getId()),
                toProfile(profile),
                toPlan(plan),
                capital,
                target,
                realisedPerformance,
                exposure,
                riskPlan,
                feasibility,
                projection,
                confidence,
                messages,
                scenarios,
                drivers,
                dataQuality,
                ledgerEvents.stream().sorted(Comparator.comparing(AccountLedgerEvent::getEventTime).reversed())
                        .map(this::toLedgerEvent).toList(),
                buildProgressSeries(plan, monthClosed, capitalRules.totalDrawdownBoundary(), zone),
                "growthCoach.disclaimer"
        );
    }

    private PortfolioAccount buildPortfolioAccount(User user, Account account, YearMonth month) {
        try {
            Detail detail = buildDetail(user, account, month);
            return new PortfolioAccount(
                    account.getId(),
                    account.getName(),
                    detail.profile().accountType(),
                    account.getAccountCurrency(),
                    detail.capital().currentRealisedBalance(),
                    detail.capital().currentEquity(),
                    detail.target().realisedCurrentMonthPnl(),
                    detail.capital().currentFloatingPnl(),
                    detail.openExposure().openTradeCount(),
                    detail.riskPlan().state(),
                    detail.confidence().level()
            );
        } catch (RuntimeException ex) {
            log.warn("Growth coach portfolio summary failed [userId={}, accountId={}, reason={}]",
                    user.getId(), account.getId(), ex.getMessage());
            return new PortfolioAccount(account.getId(), account.getName(),
                    GrowthAccountType.from(account.getAccountType()).name(), account.getAccountCurrency(),
                    null, null, null, null, null, "UNKNOWN", "INSUFFICIENT");
        }
    }

    private AccountGrowthProfile getOrCreateProfile(User user, Account account) {
        return profileRepository.findByAccountIdAndUserId(account.getId(), user.getId())
                .orElseGet(() -> profileRepository.save(AccountGrowthProfile.builder()
                        .user(user)
                        .account(account)
                        .accountType(GrowthAccountType.from(account.getAccountType()))
                        .initialCapital(scale(account.getStartingBalance()))
                        .capitalSource(account.getStartingBalance() == null
                                ? CapitalSource.ACCOUNT_DEFAULT : CapitalSource.ACCOUNT_DEFAULT)
                        .defaultRiskPerTradePct(new BigDecimal("0.5000"))
                        .preferredMaxRiskPerTradePct(new BigDecimal("1.0000"))
                        .maxConcurrentRiskPct(new BigDecimal("2.0000"))
                        .drawdownType(DrawdownType.NONE)
                        .monthlyTargetPct(new BigDecimal("3.0000"))
                        .active(true)
                        .build()));
    }

    private MonthlyGrowthPlan getOrCreatePlan(User user,
                                               Account account,
                                               AccountGrowthProfile profile,
                                               YearMonth month,
                                               List<Trade> trades) {
        return planRepository.findByAccountIdAndUserIdAndMonthKey(account.getId(), user.getId(), month.toString())
                .orElseGet(() -> {
                    ZoneId zone = resolveZone(account, user);
                    OffsetDateTime monthStart = month.atDay(1).atStartOfDay(zone).toOffsetDateTime();
                    List<AccountLedgerEvent> ledgerBefore = ledgerRepository
                            .findByAccountIdAndUserIdAndEventTimeBeforeOrderByEventTimeAsc(account.getId(), user.getId(), monthStart);
                    BigDecimal initial = resolveInitialCapital(profile, ledgerBefore);
                    BigDecimal balance = add(initial,
                            ledgerNet(ledgerBefore),
                            sum(validClosed(trades).stream().filter(t -> t.getClosedAt().isBefore(monthStart)).toList(), Trade::getPnlNet));
                    MonthlyGrowthPlan created = MonthlyGrowthPlan.builder()
                            .user(user)
                            .account(account)
                            .monthKey(month.toString())
                            .timezone(zone.getId())
                            .monthStartBalance(balance)
                            .monthStartEquity(balance)
                            .targetType(GrowthTargetType.PERCENTAGE)
                            .targetBasis("MONTH_START_BALANCE")
                            .targetPct(profile.getMonthlyTargetPct())
                            .plannedRiskPerTradePct(profile.getDefaultRiskPerTradePct())
                            .hardMaxRiskPerTradePct(profile.getPreferredMaxRiskPerTradePct())
                            .plannedMaxTradesPerDay(3)
                            .plannedMaxTradesPerWeek(12)
                            .plannedMinimumRr(new BigDecimal("1.5"))
                            .snapshotSource(SnapshotSource.RECONSTRUCTED)
                            .snapshotLockedAt(OffsetDateTime.now())
                            .status("ACTIVE")
                            .build();
                    created.setTargetAmount(resolveTargetAmount(created, profile, null));
                    return planRepository.save(created);
                });
    }

    private OpenExposure buildOpenExposure(UUID userId, Account account, List<Trade> trades) {
        List<Trade> openTrades = trades.stream().filter(t -> t.getStatus() == TradeStatus.OPEN).toList();
        Map<String, LiveQuoteResponse> quotes = openTrades.stream()
                .map(Trade::getSymbol)
                .filter(Objects::nonNull)
                .map(value -> value.trim().toUpperCase(Locale.ROOT))
                .distinct()
                .collect(Collectors.toMap(Function.identity(), symbol -> quoteService.getLiveQuoteForUser(userId, symbol)));

        List<OpenTrade> rows = new ArrayList<>();
        BigDecimal totalFloating = ZERO;
        BigDecimal totalRisk = ZERO;
        BigDecimal totalReward = ZERO;
        BigDecimal grossLong = ZERO;
        BigDecimal grossShort = ZERO;
        boolean allFloatingKnown = true;
        boolean allRiskKnown = true;
        int noStop = 0;
        int noQuantity = 0;
        int noEntry = 0;
        int noPrice = 0;
        Map<String, BigDecimal> riskBySymbol = new HashMap<>();

        for (Trade trade : openTrades) {
            List<String> warnings = new ArrayList<>();
            BigDecimal quantity = positive(trade.getQuantity());
            BigDecimal entry = positive(trade.getEntryPrice());
            BigDecimal multiplier = positive(trade.getContractMultiplier()) == null ? BigDecimal.ONE : trade.getContractMultiplier();
            BigDecimal stop = trade.getStopLossPrice();
            BigDecimal target = trade.getTakeProfitPrice();
            if (quantity == null) {
                noQuantity++;
                warnings.add("MISSING_QUANTITY");
            }
            if (entry == null) {
                noEntry++;
                warnings.add("MISSING_ENTRY");
            }
            if (stop == null) {
                noStop++;
                warnings.add("MISSING_STOP");
            }
            LiveQuoteResponse quote = quotes.get(normalizeSymbol(trade.getSymbol()));
            boolean quoteAvailable = quote != null && quote.isAvailable() && quote.getBid() != null && quote.getAsk() != null;
            BigDecimal currentPrice = quoteAvailable
                    ? (trade.getDirection() == Direction.SHORT ? quote.getAsk() : quote.getBid())
                    : null;
            boolean stale = quoteAvailable && quote.getTsUtc() != null
                    && Duration.between(quote.getTsUtc(), OffsetDateTime.now()).abs().compareTo(Duration.ofMinutes(5)) > 0;
            if (!quoteAvailable) {
                noPrice++;
                warnings.add("PRICE_UNAVAILABLE");
            } else if (stale) {
                warnings.add("STALE_PRICE");
            }

            BigDecimal risk = calculateOpenRisk(trade, entry, stop, quantity, multiplier);
            if (risk == null) {
                allRiskKnown = false;
                warnings.add("RISK_UNKNOWN");
            } else {
                totalRisk = totalRisk.add(risk);
                riskBySymbol.merge(normalizeSymbol(trade.getSymbol()), risk, BigDecimal::add);
            }
            BigDecimal reward = calculateReward(trade, entry, target, quantity, multiplier);
            if (reward != null) totalReward = totalReward.add(reward);
            BigDecimal floating = calculateFloating(trade, entry, currentPrice, quantity, multiplier);
            if (floating == null) {
                allFloatingKnown = false;
            } else {
                totalFloating = totalFloating.add(floating);
            }
            BigDecimal notional = entry == null || quantity == null ? null : entry.multiply(quantity).multiply(multiplier).abs();
            if (notional != null) {
                if (trade.getDirection() == Direction.SHORT) grossShort = grossShort.add(notional);
                else if (trade.getDirection() == Direction.LONG) grossLong = grossLong.add(notional);
            }
            BigDecimal rr = risk == null || risk.signum() == 0 || reward == null
                    ? null : reward.divide(risk, 4, RoundingMode.HALF_UP);
            BigDecimal currentR = risk == null || risk.signum() == 0 || floating == null
                    ? null : floating.divide(risk, 4, RoundingMode.HALF_UP);
            long ageMinutes = trade.getOpenedAt() == null ? 0
                    : Math.max(0, Duration.between(trade.getOpenedAt(), OffsetDateTime.now()).toMinutes());
            rows.add(new OpenTrade(
                    trade.getId(), trade.getSymbol(),
                    trade.getDirection() == null ? null : trade.getDirection().name(),
                    entry, currentPrice, quote == null ? null : quote.getTsUtc(), stale,
                    quantity, stop, target, floating, risk, rr, currentR, notional,
                    ageMinutes, trade.getStrategyTag(), trade.getSetup(), warnings
            ));
        }

        Map.Entry<String, BigDecimal> concentration = riskBySymbol.entrySet().stream()
                .max(Map.Entry.comparingByValue()).orElse(null);
        BigDecimal concentrationPct = concentration == null || totalRisk.signum() == 0 ? null
                : pct(concentration.getValue(), totalRisk);
        BigDecimal balance = account.getStartingBalance();
        BigDecimal openRiskPct = allRiskKnown && balance != null && balance.signum() > 0 ? pct(totalRisk, balance) : null;
        return new OpenExposure(
                openTrades.size(),
                allFloatingKnown ? scale(totalFloating) : null,
                allFloatingKnown,
                scale(grossLong),
                scale(grossShort),
                scale(grossLong.subtract(grossShort)),
                allRiskKnown ? scale(totalRisk) : null,
                allRiskKnown,
                openRiskPct,
                scale(totalReward),
                noStop,
                noQuantity,
                noEntry,
                noPrice,
                concentration == null ? null : concentration.getKey(),
                concentrationPct,
                rows
        );
    }

    private CapitalRules buildCapitalRules(AccountGrowthProfile profile,
                                            MonthlyGrowthPlan plan,
                                            Account account,
                                            List<Trade> validClosed,
                                            List<Trade> monthClosed,
                                            BigDecimal realisedBalance,
                                            BigDecimal equity,
                                            BigDecimal floating,
                                            OpenExposure exposure,
                                            ZoneId zone) {
        BigDecimal riskReference = realisedBalance;
        BigDecimal dailyLimit = firstNonNull(profile.getMaxDailyLossAmount(),
                amountFromPct(profile.getMaxDailyRiskPct(), riskReference));
        LocalDate today = LocalDate.now(zone);
        BigDecimal todayPnl = sum(monthClosed.stream()
                .filter(t -> t.getClosedAt().atZoneSameInstant(zone).toLocalDate().equals(today)).toList(), Trade::getPnlNet);
        BigDecimal openLoss = floating != null && floating.signum() < 0 ? floating.abs() : ZERO;
        BigDecimal dailyRemaining = dailyLimit == null ? null : dailyLimit.add(todayPnl.min(ZERO)).subtract(openLoss).max(ZERO);

        BigDecimal totalLimit = firstNonNull(profile.getMaxTotalDrawdownAmount(),
                amountFromPct(profile.getMaxTotalDrawdownPct(), profile.getInitialCapital()));
        BigDecimal boundary = null;
        if (profile.isTrailingDrawdownEnabled() && profile.getTrailingDrawdownAmount() != null) {
            BigDecimal high = firstNonNull(profile.getTrailingDrawdownHighWaterMark(), realisedBalance, profile.getInitialCapital());
            boundary = high == null ? null : high.subtract(profile.getTrailingDrawdownAmount());
        } else if (totalLimit != null && profile.getInitialCapital() != null) {
            boundary = profile.getInitialCapital().subtract(totalLimit);
        }
        BigDecimal totalRemaining = boundary == null || equity == null ? null : equity.subtract(boundary).max(ZERO);
        BigDecimal drawdownBuffer = totalRemaining;
        return new CapitalRules(riskReference, dailyLimit, dailyRemaining, totalLimit, totalRemaining, drawdownBuffer, boundary, todayPnl);
    }

    private CapitalSummary buildCapitalSummary(AccountGrowthProfile profile,
                                                BigDecimal initial,
                                                BigDecimal ledgerNet,
                                                BigDecimal lifetimePnl,
                                                BigDecimal realisedBalance,
                                                BigDecimal floating,
                                                BigDecimal equity,
                                                OpenExposure exposure,
                                                CapitalRules rules) {
        BigDecimal grossWithdrawable = realisedBalance == null || initial == null
                ? null : realisedBalance.subtract(initial).max(ZERO);
        BigDecimal withdrawable = grossWithdrawable;
        if (withdrawable != null && profile.getPayoutThreshold() != null
                && withdrawable.compareTo(profile.getPayoutThreshold()) < 0) {
            withdrawable = ZERO;
        }
        BigDecimal afterSplit = grossWithdrawable;
        if (afterSplit != null && profile.getProfitSplitPct() != null) {
            afterSplit = afterSplit.multiply(profile.getProfitSplitPct())
                    .divide(HUNDRED, 4, RoundingMode.HALF_UP);
        }
        BigDecimal profitTargetRemaining = resolveProfitTarget(profile, initial, realisedBalance);
        return new CapitalSummary(
                initial, ledgerNet, lifetimePnl, realisedBalance, floating, equity,
                withdrawable, afterSplit, rules.drawdownBuffer(), rules.dailyRemaining(),
                rules.totalRemaining(), profitTargetRemaining, exposure.floatingPnlAvailable(),
                "CURRENT_REALISED_BALANCE"
        );
    }

    private TargetSummary buildTarget(AccountGrowthProfile profile,
                                      MonthlyGrowthPlan plan,
                                      BigDecimal realisedMonthPnl,
                                      BigDecimal floating,
                                      BigDecimal riskReference,
                                      YearMonth month,
                                      ZoneId zone) {
        BigDecimal target = nvl(plan.getTargetAmount());
        BigDecimal realisedProgress = scale(GrowthCoachMath.progressPercent(realisedMonthPnl, target));
        BigDecimal equityContribution = floating == null ? null : realisedMonthPnl.add(floating);
        BigDecimal equityProgress = target.signum() <= 0 || equityContribution == null ? null : pct(equityContribution, target);
        BigDecimal remaining = scale(GrowthCoachMath.remainingTarget(realisedMonthPnl, target));
        BigDecimal adjustedRemaining = floating == null ? null : target.subtract(realisedMonthPnl).subtract(floating).max(ZERO);
        BigDecimal plannedRiskPct = firstNonNull(plan.getPlannedRiskPerTradePct(), ZERO);
        BigDecimal riskAmount = amountFromPct(plannedRiskPct, riskReference);
        BigDecimal requiredR = scale(GrowthCoachMath.requiredR(remaining, riskAmount));
        return new TargetSummary(
                target, realisedMonthPnl, floating, realisedProgress, equityProgress,
                remaining, adjustedRemaining, requiredR, tradingDaysRemaining(month, zone, profile.getChallengeDeadline()),
                realisedMonthPnl.compareTo(target) >= 0
        );
    }

    private RiskPlan buildRiskPlan(AccountGrowthProfile profile,
                                   MonthlyGrowthPlan plan,
                                   CapitalRules rules,
                                   OpenExposure exposure,
                                   List<Trade> history,
                                   Confidence confidence) {
        BigDecimal reference = rules.riskReferenceCapital();
        if (reference == null || reference.signum() <= 0 || (!exposure.openRiskKnown() && exposure.openTradeCount() > 0)) {
            return new RiskPlan("UNKNOWN", null, null, null, null, null, null, null,
                    List.of("growthCoach.risk.reasons.missingData"),
                    List.of("growthCoach.risk.stopConditions.completeRiskData"));
        }
        BigDecimal basePct = firstNonNull(plan.getPlannedRiskPerTradePct(), profile.getDefaultRiskPerTradePct(), ZERO);
        BigDecimal hardPct = minNonNull(plan.getHardMaxRiskPerTradePct(), profile.getPreferredMaxRiskPerTradePct());
        BigDecimal baseAmount = amountFromPct(basePct, reference);
        BigDecimal hardAmount = amountFromPct(hardPct, reference);
        int maxPerDay = firstNonNull(plan.getPlannedMaxTradesPerDay(), 3);
        int tradesToday = countTradesToday(history, resolveZone(profile.getAccount(), profile.getUser()));
        int remainingTradesToday = Math.max(1, maxPerDay - tradesToday);
        BigDecimal capDaily = rules.dailyRemaining() == null ? null
                : rules.dailyRemaining().divide(BigDecimal.valueOf(remainingTradesToday), 4, RoundingMode.HALF_UP);
        int streak = Math.max(1, historicalMaxLosingStreak(history) + losingStreakSafetyBuffer);
        BigDecimal capDrawdown = rules.totalRemaining() == null ? null
                : rules.totalRemaining().divide(BigDecimal.valueOf(streak), 4, RoundingMode.HALF_UP);
        BigDecimal concurrentLimit = amountFromPct(profile.getMaxConcurrentRiskPct(), reference);
        BigDecimal capOpen = concurrentLimit == null ? null
                : concurrentLimit.subtract(nvl(exposure.totalOpenRisk())).max(ZERO);
        BigDecimal maximum = minNonNull(hardAmount, capDaily, capDrawdown, capOpen);
        BigDecimal recommended = minNonNull(baseAmount, maximum);
        List<String> reasons = new ArrayList<>();
        List<String> stops = new ArrayList<>();
        String state;
        if (maximum != null && maximum.signum() <= 0) {
            state = "BLOCKED";
            recommended = ZERO;
            stops.add("growthCoach.risk.stopConditions.noCapacity");
        } else if (recommended == null) {
            state = "UNKNOWN";
        } else if (recommended.compareTo(baseAmount) < 0 || "LOW".equals(confidence.level())) {
            state = "REDUCED";
            reasons.add("growthCoach.risk.reasons.ruleCap");
        } else if (basePct.compareTo(new BigDecimal("0.5")) < 0) {
            state = "CONSERVATIVE";
        } else {
            state = "STANDARD";
        }
        if (rules.dailyRemaining() != null && rules.dailyRemaining().signum() <= 0) {
            state = "BLOCKED";
            stops.add("growthCoach.risk.stopConditions.dailyLimit");
        }
        if (rules.totalRemaining() != null && rules.totalRemaining().signum() <= 0) {
            state = "BLOCKED";
            stops.add("growthCoach.risk.stopConditions.drawdownLimit");
        }
        if (profile.getContractLimit() != null) {
            BigDecimal openContracts = exposure.trades().stream()
                    .map(OpenTrade::quantity).filter(Objects::nonNull).reduce(ZERO, BigDecimal::add);
            if (openContracts.compareTo(BigDecimal.valueOf(profile.getContractLimit())) >= 0) {
                state = "BLOCKED";
                recommended = ZERO;
                reasons.add("growthCoach.risk.reasons.contractLimit");
                stops.add("growthCoach.risk.stopConditions.contractLimit");
            }
        }
        if (historicalMaxLosingStreak(history) >= 3) {
            reasons.add("growthCoach.risk.reasons.losingStreakBuffer");
        }
        return new RiskPlan(
                state,
                scale(recommended),
                recommended == null ? null : pct(recommended, reference),
                scale(maximum),
                maximum == null ? null : pct(maximum, reference),
                scale(capDaily),
                scale(capDrawdown),
                scale(capOpen),
                reasons,
                stops
        );
    }

    private Feasibility buildFeasibility(TargetSummary target,
                                         RiskPlan risk,
                                         HistoricalSample sample,
                                         Confidence confidence,
                                         MonthlyGrowthPlan plan) {
        List<String> reasons = new ArrayList<>();
        Map<String, Object> params = new LinkedHashMap<>();
        String classification;
        if ("INSUFFICIENT".equals(confidence.level()) || sample.outcomes().size() < 10) {
            classification = "NOT_ENOUGH_DATA";
            reasons.add("growthCoach.feasibility.reasons.sample");
        } else if (target.targetReached()) {
            classification = "CONSERVATIVE";
            reasons.add("growthCoach.feasibility.reasons.reached");
        } else if ("BLOCKED".equals(risk.state())) {
            classification = "UNSAFE";
            reasons.add("growthCoach.feasibility.reasons.ruleBlocked");
        } else if (sample.expectancyR() == null || sample.expectancyR().signum() <= 0) {
            classification = "UNLIKELY";
            reasons.add("growthCoach.feasibility.reasons.nonPositiveExpectancy");
        } else if (risk.maximumPermittedRiskAmount() == null || target.requiredR() == null) {
            classification = "NOT_ENOUGH_DATA";
            reasons.add("growthCoach.feasibility.reasons.missingRisk");
        } else {
            BigDecimal normalTradesRemaining = sample.averageTradesPerActiveDay()
                    .multiply(BigDecimal.valueOf(target.tradingDaysRemaining()));
            BigDecimal expectedR = sample.expectancyR().multiply(normalTradesRemaining);
            BigDecimal requiredR = target.requiredR();
            params.put("requiredR", requiredR);
            params.put("expectedR", expectedR);
            params.put("daysRemaining", target.tradingDaysRemaining());
            if (target.tradingDaysRemaining() <= 0 && !target.targetReached()) {
                classification = "UNLIKELY";
                reasons.add("growthCoach.feasibility.reasons.noTime");
            } else if (requiredR.compareTo(expectedR.multiply(new BigDecimal("2.0"))) > 0) {
                classification = "UNSAFE";
                reasons.add("growthCoach.feasibility.reasons.exceedsSafePace");
            } else if (requiredR.compareTo(expectedR.multiply(new BigDecimal("1.35"))) > 0) {
                classification = "UNLIKELY";
                reasons.add("growthCoach.feasibility.reasons.aboveNormalRange");
            } else if (requiredR.compareTo(expectedR) > 0) {
                classification = "AMBITIOUS";
                reasons.add("growthCoach.feasibility.reasons.aboveAverage");
            } else if (requiredR.compareTo(expectedR.multiply(new BigDecimal("0.6"))) <= 0) {
                classification = "CONSERVATIVE";
                reasons.add("growthCoach.feasibility.reasons.belowNormal");
            } else {
                classification = "REALISTIC";
                reasons.add("growthCoach.feasibility.reasons.normalRange");
            }
        }
        return new Feasibility(classification, reasons, params);
    }

    private Projection buildProjection(Account account,
                                       YearMonth month,
                                       TargetSummary target,
                                       RiskPlan risk,
                                       HistoricalSample sample,
                                       Confidence confidence,
                                       CapitalRules rules,
                                       MonthlyGrowthPlan plan,
                                       ZoneId zone) {
        BigDecimal expectancyR = sample.expectancyR();
        BigDecimal riskAmount = risk.recommendedRiskAmount();
        BigDecimal expectancyMoney = expectancyR == null || riskAmount == null ? null : expectancyR.multiply(riskAmount);
        if (sample.outcomes().size() < projectionMinSample
                || "INSUFFICIENT".equals(confidence.level())
                || "UNKNOWN".equals(risk.state())
                || "BLOCKED".equals(risk.state())
                || expectancyR == null
                || expectancyR.signum() <= 0
                || riskAmount == null
                || riskAmount.signum() <= 0) {
            String reason = expectancyR != null && expectancyR.signum() <= 0
                    ? "growthCoach.projection.unavailable.negativeExpectancy"
                    : "growthCoach.projection.unavailable.data";
            return new Projection(false, sample.dataset(), sample.outcomes().size(), null,
                    expectancyR, expectancyMoney, null, null, null, null, null, null,
                    null, null, null, null, null, reason);
        }

        BigDecimal expectedTrades = GrowthCoachMath.expectedTrades(target.remainingTargetAmount(), expectancyMoney);
        BigDecimal averageDaily = sample.averageTradesPerActiveDay().max(new BigDecimal("0.1"));
        BigDecimal expectedDays = GrowthCoachMath.expectedTradingDays(expectedTrades, averageDaily);
        int maxFutureTrades = Math.max(0, (int) Math.ceil(averageDaily.doubleValue() * target.tradingDaysRemaining()));
        Random random = new Random(Objects.hash(account.getId(), month.toString()));
        int reached = 0;
        int profitableBelow = 0;
        int negative = 0;
        int drawdownFirst = 0;
        List<Integer> tradesToTarget = new ArrayList<>();
        BigDecimal buffer = rules.totalRemaining();
        for (int simulation = 0; simulation < simulationCount; simulation++) {
            BigDecimal pnl = ZERO;
            boolean hitTarget = target.remainingTargetAmount().signum() <= 0;
            boolean breached = false;
            for (int tradeIndex = 1; tradeIndex <= maxFutureTrades; tradeIndex++) {
                BigDecimal outcomeR = sample.outcomes().get(random.nextInt(sample.outcomes().size()));
                pnl = pnl.add(outcomeR.multiply(riskAmount));
                if (buffer != null && pnl.compareTo(buffer.negate()) <= 0) {
                    breached = true;
                    drawdownFirst++;
                    break;
                }
                if (pnl.compareTo(target.remainingTargetAmount()) >= 0) {
                    hitTarget = true;
                    tradesToTarget.add(tradeIndex);
                    reached++;
                    break;
                }
            }
            if (!hitTarget && !breached) {
                if (target.realisedCurrentMonthPnl().add(pnl).signum() > 0) profitableBelow++;
                else negative++;
            }
        }
        BigDecimal targetProbability = probability(reached, simulationCount);
        BigDecimal drawdownProbability = probability(drawdownFirst, simulationCount);
        BigDecimal ruleProbability = drawdownProbability;
        return new Projection(
                true,
                sample.dataset(),
                sample.outcomes().size(),
                simulationCount,
                expectancyR,
                scale(expectancyMoney),
                scale(expectedTrades.multiply(new BigDecimal("0.65"))),
                scale(expectedTrades),
                scale(expectedTrades.multiply(new BigDecimal("1.50"))),
                scale(expectedDays.multiply(new BigDecimal("0.65"))),
                scale(expectedDays),
                scale(expectedDays.multiply(new BigDecimal("1.50"))),
                targetProbability,
                probability(profitableBelow, simulationCount),
                probability(negative, simulationCount),
                drawdownProbability,
                ruleProbability,
                null
        );
    }

    private Confidence buildConfidence(List<Trade> trades,
                                       List<Trade> validClosed,
                                       OpenExposure exposure,
                                       MonthlyGrowthPlan plan) {
        int score = Math.min(50, validClosed.size());
        long riskValid = validClosed.stream().filter(t -> outcomeR(t) != null).count();
        if (!validClosed.isEmpty()) score += (int) Math.round(25.0 * riskValid / validClosed.size());
        int inconsistent = (int) trades.stream().filter(this::isPnlInconsistent).count();
        score -= Math.min(25, inconsistent * 5);
        if (!exposure.openRiskKnown() && exposure.openTradeCount() > 0) score -= 25;
        if (plan.getSnapshotSource() == SnapshotSource.RECONSTRUCTED) score -= 10;
        score = Math.max(0, Math.min(100, score));
        String level = score >= 80 ? "HIGH" : score >= 55 ? "MEDIUM" : score >= 25 ? "LOW" : "INSUFFICIENT";
        List<String> reasons = new ArrayList<>();
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("tradeCount", validClosed.size());
        params.put("riskCoveragePct", validClosed.isEmpty() ? 0 : Math.round(100.0 * riskValid / validClosed.size()));
        params.put("inconsistentCount", inconsistent);
        if (validClosed.size() < 20) reasons.add("growthCoach.confidence.reasons.lowSample");
        if (riskValid < validClosed.size()) reasons.add("growthCoach.confidence.reasons.missingRisk");
        if (inconsistent > 0) reasons.add("growthCoach.confidence.reasons.inconsistentPnl");
        if (!exposure.openRiskKnown() && exposure.openTradeCount() > 0) reasons.add("growthCoach.confidence.reasons.openRiskUnknown");
        if (plan.getSnapshotSource() == SnapshotSource.RECONSTRUCTED) reasons.add("growthCoach.confidence.reasons.reconstructedSnapshot");
        return new Confidence(level, score, reasons, params);
    }

    private DataQuality buildDataQuality(List<Trade> trades,
                                         List<Trade> validClosed,
                                         OpenExposure exposure,
                                         MonthlyGrowthPlan plan) {
        List<UUID> affected = trades.stream()
                .filter(t -> (t.getStatus() == TradeStatus.CLOSED && (t.getClosedAt() == null || t.getPnlNet() == null))
                        || isPnlInconsistent(t)
                        || (t.getStatus() == TradeStatus.OPEN
                        && (t.getStopLossPrice() == null || t.getQuantity() == null || t.getEntryPrice() == null)))
                .map(Trade::getId).filter(Objects::nonNull).distinct().limit(200).toList();
        return new DataQuality(
                validClosed.size(),
                (int) trades.stream().filter(t -> t.getStatus() == TradeStatus.CLOSED && t.getClosedAt() == null).count(),
                (int) trades.stream().filter(t -> t.getStatus() == TradeStatus.CLOSED && t.getPnlNet() == null).count(),
                (int) trades.stream().filter(this::isPnlInconsistent).count(),
                (int) validClosed.stream().filter(t -> outcomeR(t) == null).count(),
                exposure.tradesWithoutStop(),
                exposure.tradesWithoutQuantity(),
                (int) trades.stream().filter(t -> trimToNull(t.getStrategyTag()) == null).count(),
                (int) trades.stream().filter(t -> trimToNull(t.getSetup()) == null).count(),
                plan.getSnapshotSource() == SnapshotSource.RECONSTRUCTED,
                affected
        );
    }

    private PerformanceDrivers buildPerformanceDrivers(List<Trade> trades, AnalyticsResponse analytics) {
        Driver strongestStrategy = driver(trades, Trade::getStrategyTag, true);
        Driver weakestStrategy = driver(trades, Trade::getStrategyTag, false);
        Driver strongestSession = driver(trades,
                t -> t.getSession() == null ? null : t.getSession().name(), true);
        Driver weakestSession = driver(trades,
                t -> t.getSession() == null ? null : t.getSession().name(), false);
        Driver strongestSymbol = driver(trades, Trade::getSymbol, true);
        Driver weakestSymbol = driver(trades, Trade::getSymbol, false);
        Driver strongestRr = driver(trades, this::rrBucket, true);
        BigDecimal costPct = costPct(analytics);
        BigDecimal costPerTrade = analytics.getCosts() == null ? null : analytics.getCosts().getAvgCosts();
        return new PerformanceDrivers(strongestStrategy, weakestStrategy, strongestSession, weakestSession,
                strongestSymbol, weakestSymbol, strongestRr, costPct, costPerTrade);
    }

    private Driver driver(List<Trade> trades, Function<Trade, String> classifier, boolean strongest) {
        Comparator<Driver> comparator = Comparator.comparing(Driver::expectancy, Comparator.nullsFirst(BigDecimal::compareTo));
        return trades.stream()
                .filter(t -> trimToNull(classifier.apply(t)) != null)
                .collect(Collectors.groupingBy(t -> trimToNull(classifier.apply(t))))
                .entrySet().stream()
                .map(entry -> {
                    List<Trade> sample = entry.getValue();
                    BigDecimal expectancy = average(sample.stream().map(Trade::getPnlNet).filter(Objects::nonNull).toList());
                    BigDecimal expectancyR = average(sample.stream().map(this::outcomeR).filter(Objects::nonNull).toList());
                    String confidence = sample.size() >= 20 ? "HIGH" : sample.size() >= 10 ? "MEDIUM" : "LOW";
                    return new Driver(entry.getKey(), sample.size(), expectancy, expectancyR, confidence);
                })
                .filter(item -> item.sampleSize() >= 3)
                .reduce((left, right) -> strongest
                        ? (comparator.compare(left, right) >= 0 ? left : right)
                        : (comparator.compare(left, right) <= 0 ? left : right))
                .orElse(null);
    }

    private List<Scenario> buildScenarios(RiskPlan risk, Projection projection, CapitalRules rules) {
        if (risk.recommendedRiskAmount() == null || rules.riskReferenceCapital() == null) return List.of();
        List<Scenario> result = new ArrayList<>();
        result.add(scenario("CONSERVATIVE", risk, projection, rules, new BigDecimal("0.65"), false));
        result.add(scenario("STANDARD", risk, projection, rules, BigDecimal.ONE, true));
        BigDecimal aggressiveAmount = risk.recommendedRiskAmount().multiply(new BigDecimal("1.25"));
        boolean allowed = risk.maximumPermittedRiskAmount() != null
                && aggressiveAmount.compareTo(risk.maximumPermittedRiskAmount()) <= 0
                && !"BLOCKED".equals(risk.state());
        if (allowed) result.add(scenario("AGGRESSIVE", risk, projection, rules, new BigDecimal("1.25"), false));
        return result;
    }

    private Scenario scenario(String key,
                              RiskPlan risk,
                              Projection projection,
                              CapitalRules rules,
                              BigDecimal factor,
                              boolean recommended) {
        BigDecimal amount = risk.recommendedRiskAmount().multiply(factor);
        BigDecimal riskPct = pct(amount, rules.riskReferenceCapital());
        BigDecimal estimatedDays = projection.expectedTradingDaysBase() == null ? null
                : projection.expectedTradingDaysBase().divide(factor, 2, RoundingMode.HALF_UP);
        BigDecimal targetProbability = projection.probabilityTargetBeforeMonthEnd();
        BigDecimal drawdownProbability = projection.probabilityDrawdownFirst();
        if (targetProbability != null) targetProbability = targetProbability.multiply(factor).min(HUNDRED);
        if (drawdownProbability != null) drawdownProbability = drawdownProbability.multiply(factor.multiply(factor)).min(HUNDRED);
        return new Scenario(key, riskPct, scale(amount), estimatedDays, targetProbability, drawdownProbability,
                recommended, true, "AGGRESSIVE".equals(key) ? "growthCoach.scenarios.aggressiveWarning" : null);
    }

    private List<ProgressPoint> buildProgressSeries(MonthlyGrowthPlan plan,
                                                    List<Trade> monthClosed,
                                                    BigDecimal drawdownBoundary,
                                                    ZoneId zone) {
        if (plan.getMonthStartBalance() == null) return List.of();
        YearMonth month = YearMonth.parse(plan.getMonthKey());
        LocalDate start = month.atDay(1);
        LocalDate end = month.atEndOfMonth();
        Map<LocalDate, BigDecimal> dailyPnl = monthClosed.stream().collect(Collectors.groupingBy(
                trade -> trade.getClosedAt().atZoneSameInstant(zone).toLocalDate(),
                Collectors.reducing(ZERO, trade -> nvl(trade.getPnlNet()), BigDecimal::add)));
        BigDecimal running = plan.getMonthStartBalance();
        List<ProgressPoint> points = new ArrayList<>();
        int days = month.lengthOfMonth();
        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            running = running.add(dailyPnl.getOrDefault(date, ZERO));
            BigDecimal fraction = BigDecimal.valueOf(date.getDayOfMonth())
                    .divide(BigDecimal.valueOf(days), 8, RoundingMode.HALF_UP);
            BigDecimal targetBalance = plan.getMonthStartBalance().add(nvl(plan.getTargetAmount()));
            BigDecimal plannedBalance = plan.getMonthStartBalance().add(nvl(plan.getTargetAmount()).multiply(fraction));
            points.add(new ProgressPoint(date, scale(running), scale(targetBalance), scale(plannedBalance), scale(drawdownBoundary)));
        }
        return points;
    }

    private HistoricalSample selectProjectionSample(List<Trade> validClosed) {
        List<Trade> withOutcome = validClosed.stream()
                .filter(t -> outcomeR(t) != null)
                .sorted(Comparator.comparing(Trade::getClosedAt))
                .toList();
        List<Trade> selected;
        String dataset;
        if (withOutcome.size() >= 50) {
            selected = withOutcome.subList(withOutcome.size() - 50, withOutcome.size());
            dataset = "TRAILING_50";
        } else if (withOutcome.size() >= 20) {
            selected = withOutcome.subList(withOutcome.size() - 20, withOutcome.size());
            dataset = "TRAILING_20";
        } else {
            selected = withOutcome;
            dataset = "ALL_VALID";
        }
        List<BigDecimal> outcomes = selected.stream().map(this::outcomeR).toList();
        BigDecimal expectancyR = average(outcomes);
        BigDecimal expectancyMoney = average(selected.stream().map(Trade::getPnlNet).filter(Objects::nonNull).toList());
        long activeDays = selected.stream().map(t -> t.getClosedAt().toLocalDate()).distinct().count();
        BigDecimal averagePerDay = activeDays == 0 ? ZERO
                : BigDecimal.valueOf(selected.size()).divide(BigDecimal.valueOf(activeDays), 4, RoundingMode.HALF_UP);
        return new HistoricalSample(dataset, outcomes, expectancyR, expectancyMoney, averagePerDay);
    }

    private MonthlyPlan toPlan(MonthlyGrowthPlan plan) {
        return new MonthlyPlan(plan.getId(), plan.getMonthKey(), plan.getTimezone(), plan.getMonthStartBalance(),
                plan.getMonthStartEquity(), plan.getTargetType().name(), plan.getTargetBasis(), plan.getTargetPct(),
                plan.getTargetAmount(), plan.getTargetR(), plan.getPlannedRiskPerTradePct(),
                plan.getHardMaxRiskPerTradePct(), plan.getPlannedMaxTradesPerDay(),
                plan.getPlannedMaxTradesPerWeek(), plan.getPlannedMinimumRr(), plan.getSnapshotSource().name(),
                plan.getSnapshotLockedAt(), plan.getSnapshotAdjustmentAmount(), plan.getSnapshotAdjustmentNote(),
                plan.getTargetChangedAt());
    }

    private GrowthProfile toProfile(AccountGrowthProfile profile) {
        return new GrowthProfile(
                profile.getId(), profile.getAccountType().name(), profile.getInitialCapital(),
                profile.getCapitalSource().name(), profile.getDefaultRiskPerTradePct(),
                profile.getPreferredMaxRiskPerTradePct(), profile.getMaxConcurrentRiskPct(),
                profile.getMaxDailyRiskPct(), profile.getMaxDailyLossAmount(), profile.getMaxTotalDrawdownPct(),
                profile.getMaxTotalDrawdownAmount(), profile.getDrawdownType().name(), profile.getMonthlyTargetPct(),
                profile.isCompoundsMonthly(), profile.getProfitTargetPct(), profile.getProfitTargetAmount(),
                profile.getMinimumTradingDays(), profile.getChallengeDeadline(), profile.getConsistencyRuleType(),
                profile.getConsistencyRuleValue(), profile.isTrailingDrawdownEnabled(),
                profile.getTrailingDrawdownType(), profile.getTrailingDrawdownAmount(),
                profile.getTrailingDrawdownHighWaterMark(), profile.getContractLimit(),
                profile.getScalingRestrictions(), profile.getProfitSplitPct(), profile.getPayoutThreshold(),
                profile.getPayoutFrequency(), profile.getPayoutEligibilityRules(), profile.getResetDetails(),
                profile.getUpdatedAt()
        );
    }

    private LedgerEvent toLedgerEvent(AccountLedgerEvent event) {
        return new LedgerEvent(event.getId(), event.getEventType().name(), event.getAmount(), event.getCurrency(),
                event.getEventTime(), event.getDescription(), event.getExternalReference());
    }

    private void applyLedgerRequest(AccountLedgerEvent event, User user, Account account, LedgerEventRequest request) {
        if (request.amount() == null || request.amount().signum() == 0) {
            throw new IllegalArgumentException("Ledger amount must not be zero");
        }
        String currency = normalizeCurrency(request.currency());
        if (!Objects.equals(currency, normalizeCurrency(account.getAccountCurrency()))) {
            throw new IllegalArgumentException("Ledger event currency must match the account currency");
        }
        BigDecimal normalized = request.eventType().permitsSignedAmount()
                ? request.amount() : request.amount().abs();
        if (request.eventType().isDebit()) normalized = normalized.negate();
        event.setUser(user);
        event.setAccount(account);
        event.setEventType(request.eventType());
        event.setAmount(scale(normalized));
        event.setCurrency(currency);
        event.setEventTime(request.eventTime());
        event.setDescription(trimToNull(request.description()));
        event.setExternalReference(trimToNull(request.externalReference()));
    }

    private BigDecimal resolveTargetAmount(MonthlyGrowthPlan plan,
                                           AccountGrowthProfile profile,
                                           BigDecimal requestedAmount) {
        BigDecimal base = switch (plan.getTargetBasis()) {
            case "INITIAL_CAPITAL" -> profile.getInitialCapital();
            case "CURRENT_EQUITY" -> plan.getMonthStartEquity();
            default -> plan.getMonthStartBalance();
        };
        return scale(switch (plan.getTargetType()) {
            case PERCENTAGE -> amountFromPct(plan.getTargetPct(), base);
            case FIXED_AMOUNT -> requestedAmount;
            case R_MULTIPLE -> {
                BigDecimal riskAmount = amountFromPct(plan.getPlannedRiskPerTradePct(), base);
                yield riskAmount == null || plan.getTargetR() == null ? null : riskAmount.multiply(plan.getTargetR());
            }
            case PROP_TARGET -> firstNonNull(profile.getProfitTargetAmount(),
                    amountFromPct(profile.getProfitTargetPct(), profile.getInitialCapital()));
            case CAPITAL_MILESTONE -> requestedAmount == null || base == null ? null : requestedAmount.subtract(base).max(ZERO);
        });
    }

    private BigDecimal resolveInitialCapital(AccountGrowthProfile profile, List<AccountLedgerEvent> ledgerEvents) {
        if (profile.getInitialCapital() != null) return profile.getInitialCapital();
        return ledgerEvents.stream()
                .filter(event -> event.getEventType() == LedgerEventType.INITIAL_CAPITAL)
                .map(AccountLedgerEvent::getAmount)
                .filter(Objects::nonNull)
                .findFirst().map(BigDecimal::abs).orElse(null);
    }

    private BigDecimal ledgerNet(List<AccountLedgerEvent> events) {
        return scale(events.stream()
                .filter(event -> event.getEventType() != LedgerEventType.INITIAL_CAPITAL)
                .map(AccountLedgerEvent::getAmount)
                .filter(Objects::nonNull)
                .reduce(ZERO, BigDecimal::add));
    }

    private BigDecimal resolveProfitTarget(AccountGrowthProfile profile,
                                           BigDecimal initial,
                                           BigDecimal realisedBalance) {
        BigDecimal target = firstNonNull(profile.getProfitTargetAmount(),
                amountFromPct(profile.getProfitTargetPct(), initial));
        if (target == null || initial == null || realisedBalance == null) return null;
        return target.subtract(realisedBalance.subtract(initial)).max(ZERO);
    }

    private List<Trade> loadTrades(UUID userId, UUID accountId) {
        return tradeRepository.findByUser_IdAndAccount_IdOrderByClosedAtAsc(userId, accountId);
    }

    private List<Trade> validClosed(List<Trade> trades) {
        return trades.stream()
                .filter(t -> t.getStatus() == TradeStatus.CLOSED && t.getClosedAt() != null && t.getPnlNet() != null)
                .sorted(Comparator.comparing(Trade::getClosedAt))
                .toList();
    }

    private Account requireOwnedAccount(UUID accountId, UUID userId) {
        return accountRepository.findByIdAndUserId(accountId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Trading account was not found"));
    }

    private YearMonth parseMonth(String value) {
        if (value == null || value.isBlank()) return YearMonth.now(DEFAULT_ZONE);
        try {
            return YearMonth.parse(value);
        } catch (DateTimeException ex) {
            throw new IllegalArgumentException("month must use YYYY-MM");
        }
    }

    private ZoneId resolveZone(Account account, User user) {
        for (String candidate : List.of(
                account.getBrokerTimezone() == null ? "" : account.getBrokerTimezone(),
                user.getTimezone() == null ? "" : user.getTimezone(),
                DEFAULT_ZONE.getId())) {
            try {
                if (!candidate.isBlank()) return ZoneId.of(candidate);
            } catch (DateTimeException ignored) {
                log.warn("Invalid growth coach timezone ignored [accountId={}, timezone={}]", account.getId(), candidate);
            }
        }
        return DEFAULT_ZONE;
    }

    private int tradingDaysRemaining(YearMonth month, ZoneId zone, LocalDate challengeDeadline) {
        LocalDate today = LocalDate.now(zone);
        if (month.isBefore(YearMonth.from(today))) return 0;
        LocalDate start = month.isAfter(YearMonth.from(today)) ? month.atDay(1) : today;
        LocalDate end = challengeDeadline == null ? month.atEndOfMonth() : minDate(month.atEndOfMonth(), challengeDeadline);
        int count = 0;
        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            if (date.getDayOfWeek() != DayOfWeek.SATURDAY && date.getDayOfWeek() != DayOfWeek.SUNDAY) count++;
        }
        return count;
    }

    private LocalDate minDate(LocalDate left, LocalDate right) {
        return left.isBefore(right) ? left : right;
    }

    private BigDecimal expectedCalendarProgress(YearMonth month, ZoneId zone) {
        LocalDate today = LocalDate.now(zone);
        if (month.isBefore(YearMonth.from(today))) return HUNDRED;
        if (month.isAfter(YearMonth.from(today))) return ZERO;
        int total = 0;
        int elapsed = 0;
        for (LocalDate date = month.atDay(1); !date.isAfter(month.atEndOfMonth()); date = date.plusDays(1)) {
            if (date.getDayOfWeek() == DayOfWeek.SATURDAY || date.getDayOfWeek() == DayOfWeek.SUNDAY) continue;
            total++;
            if (!date.isAfter(today)) elapsed++;
        }
        return total == 0 ? ZERO : pct(BigDecimal.valueOf(elapsed), BigDecimal.valueOf(total));
    }

    private BigDecimal calculateOpenRisk(Trade trade,
                                         BigDecimal entry,
                                         BigDecimal stop,
                                         BigDecimal quantity,
                                         BigDecimal multiplier) {
        if (entry == null || stop == null || quantity == null || trade.getDirection() == null) return null;
        if (trade.getDirection() == Direction.LONG && stop.compareTo(entry) >= 0) return null;
        if (trade.getDirection() == Direction.SHORT && stop.compareTo(entry) <= 0) return null;
        return GrowthCoachMath.openRisk(trade.getDirection(), entry, stop, quantity, multiplier);
    }

    private BigDecimal calculateReward(Trade trade,
                                       BigDecimal entry,
                                       BigDecimal target,
                                       BigDecimal quantity,
                                       BigDecimal multiplier) {
        if (entry == null || target == null || quantity == null || trade.getDirection() == null) return null;
        if (trade.getDirection() == Direction.LONG && target.compareTo(entry) <= 0) return null;
        if (trade.getDirection() == Direction.SHORT && target.compareTo(entry) >= 0) return null;
        return target.subtract(entry).abs().multiply(quantity).multiply(multiplier).abs();
    }

    private BigDecimal calculateFloating(Trade trade,
                                         BigDecimal entry,
                                         BigDecimal current,
                                         BigDecimal quantity,
                                         BigDecimal multiplier) {
        if (entry == null || current == null || quantity == null || trade.getDirection() == null) return null;
        BigDecimal move = current.subtract(entry).multiply(quantity).multiply(multiplier);
        return trade.getDirection() == Direction.SHORT ? move.negate() : move;
    }

    private BigDecimal outcomeR(Trade trade) {
        if (trade.getRMultiple() != null) return trade.getRMultiple();
        if (trade.getRiskAmount() == null || trade.getRiskAmount().signum() <= 0 || trade.getPnlNet() == null) return null;
        return trade.getPnlNet().divide(trade.getRiskAmount(), 6, RoundingMode.HALF_UP);
    }

    private BigDecimal costInR(Trade trade) {
        if (trade.getRiskAmount() == null || trade.getRiskAmount().signum() <= 0) return null;
        BigDecimal costs = nvl(trade.getFees()).add(nvl(trade.getCommission())).add(nvl(trade.getSlippage())).abs();
        return costs.divide(trade.getRiskAmount(), 6, RoundingMode.HALF_UP);
    }

    private String rrBucket(Trade trade) {
        BigDecimal risk = calculateOpenRisk(trade, positive(trade.getEntryPrice()), trade.getInitialStopLossPrice(),
                positive(trade.getQuantity()), positive(trade.getContractMultiplier()) == null ? BigDecimal.ONE : trade.getContractMultiplier());
        BigDecimal reward = calculateReward(trade, positive(trade.getEntryPrice()), trade.getInitialTakeProfitPrice(),
                positive(trade.getQuantity()), positive(trade.getContractMultiplier()) == null ? BigDecimal.ONE : trade.getContractMultiplier());
        if (risk == null || risk.signum() == 0 || reward == null) return null;
        BigDecimal rr = reward.divide(risk, 4, RoundingMode.HALF_UP);
        if (rr.compareTo(BigDecimal.ONE) < 0) return "BELOW_1";
        if (rr.compareTo(new BigDecimal("1.5")) < 0) return "1_TO_1_49";
        if (rr.compareTo(new BigDecimal("2.0")) < 0) return "1_5_TO_1_99";
        if (rr.compareTo(new BigDecimal("3.0")) < 0) return "2_TO_2_99";
        return "3_PLUS";
    }

    private boolean isPnlInconsistent(Trade trade) {
        return trade.getPnlReconciliationDifference() != null
                && trade.getPnlReconciliationDifference().abs().compareTo(new BigDecimal("0.01")) > 0;
    }

    private int currentLosingStreak(List<Trade> trades) {
        int count = 0;
        List<Trade> sorted = trades.stream().sorted(Comparator.comparing(Trade::getClosedAt).reversed()).toList();
        for (Trade trade : sorted) {
            if (trade.getPnlNet() != null && trade.getPnlNet().signum() < 0) count++;
            else break;
        }
        return count;
    }

    private int historicalMaxLosingStreak(List<Trade> trades) {
        int max = 0;
        int current = 0;
        for (Trade trade : validClosed(trades)) {
            if (trade.getPnlNet().signum() < 0) {
                current++;
                max = Math.max(max, current);
            } else {
                current = 0;
            }
        }
        return max;
    }

    private int countTradesToday(List<Trade> trades, ZoneId zone) {
        LocalDate today = LocalDate.now(zone);
        return (int) trades.stream()
                .filter(t -> t.getOpenedAt() != null && t.getOpenedAt().atZoneSameInstant(zone).toLocalDate().equals(today))
                .count();
    }

    private BigDecimal costPct(AnalyticsResponse analytics) {
        if (analytics == null || analytics.getCosts() == null || analytics.getKpi() == null
                || analytics.getKpi().getGrossProfit() == null || analytics.getKpi().getGrossProfit().signum() <= 0) {
            return null;
        }
        return pct(analytics.getCosts().getTotalCosts(), analytics.getKpi().getGrossProfit());
    }

    private void validateProfile(GrowthProfileRequest request) {
        if (request.preferredMaxRiskPerTradePct().compareTo(request.defaultRiskPerTradePct()) < 0) {
            throw new IllegalArgumentException("Preferred maximum risk must be at least the default risk");
        }
        if (request.maxConcurrentRiskPct().compareTo(request.preferredMaxRiskPerTradePct()) < 0) {
            throw new IllegalArgumentException("Concurrent risk must be at least the preferred per-trade maximum");
        }
        if (request.trailingDrawdownEnabled() && request.trailingDrawdownAmount() == null) {
            throw new IllegalArgumentException("Trailing drawdown amount is required when trailing drawdown is enabled");
        }
    }

    private void validatePlan(MonthlyGrowthPlanRequest request) {
        if (request.hardMaxRiskPerTradePct() != null && request.plannedRiskPerTradePct() != null
                && request.hardMaxRiskPerTradePct().compareTo(request.plannedRiskPerTradePct()) < 0) {
            throw new IllegalArgumentException("Hard maximum risk must be at least the planned risk");
        }
        if (request.targetType() == GrowthTargetType.PERCENTAGE && request.targetPct() == null) {
            throw new IllegalArgumentException("Target percentage is required");
        }
        if ((request.targetType() == GrowthTargetType.FIXED_AMOUNT
                || request.targetType() == GrowthTargetType.CAPITAL_MILESTONE) && request.targetAmount() == null) {
            throw new IllegalArgumentException("Target amount is required");
        }
        if (request.targetType() == GrowthTargetType.R_MULTIPLE && request.targetR() == null) {
            throw new IllegalArgumentException("Target R is required");
        }
    }

    private BigDecimal sum(List<Trade> trades, Function<Trade, BigDecimal> getter) {
        return scale(trades.stream().map(getter).filter(Objects::nonNull).reduce(ZERO, BigDecimal::add));
    }

    private BigDecimal average(List<BigDecimal> values) {
        if (values == null || values.isEmpty()) return ZERO;
        return scale(values.stream().reduce(ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(values.size()), 8, RoundingMode.HALF_UP));
    }

    private BigDecimal add(BigDecimal... values) {
        if (Arrays.stream(values).anyMatch(Objects::isNull)) return null;
        return scale(Arrays.stream(values).reduce(ZERO, BigDecimal::add));
    }

    private BigDecimal amountFromPct(BigDecimal percent, BigDecimal amount) {
        if (percent == null || amount == null) return null;
        return scale(GrowthCoachMath.amountFromPercent(amount, percent));
    }

    private BigDecimal pct(BigDecimal numerator, BigDecimal denominator) {
        if (numerator == null || denominator == null || denominator.signum() == 0) return null;
        return scale(numerator.multiply(HUNDRED).divide(denominator, 8, RoundingMode.HALF_UP));
    }

    private BigDecimal probability(int count, int total) {
        return pct(BigDecimal.valueOf(count), BigDecimal.valueOf(total));
    }

    private BigDecimal minNonNull(BigDecimal... values) {
        return Arrays.stream(values).filter(Objects::nonNull).min(BigDecimal::compareTo).orElse(null);
    }

    @SafeVarargs
    private final <T> T firstNonNull(T... values) {
        return Arrays.stream(values).filter(Objects::nonNull).findFirst().orElse(null);
    }

    private BigDecimal nvl(BigDecimal value) {
        return value == null ? ZERO : value;
    }

    private BigDecimal positive(BigDecimal value) {
        return value != null && value.signum() > 0 ? value : null;
    }

    private BigDecimal scale(BigDecimal value) {
        return value == null ? null : value.setScale(4, RoundingMode.HALF_UP);
    }

    private boolean different(BigDecimal left, BigDecimal right) {
        if (left == null || right == null) return left != right;
        return left.compareTo(right) != 0;
    }

    private String normalizeCurrency(String value) {
        return value == null || value.isBlank() ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeSymbol(String value) {
        return value == null ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private record HistoricalSample(
            String dataset,
            List<BigDecimal> outcomes,
            BigDecimal expectancyR,
            BigDecimal expectancyMoney,
            BigDecimal averageTradesPerActiveDay
    ) {
    }

    private record CapitalRules(
            BigDecimal riskReferenceCapital,
            BigDecimal dailyLimit,
            BigDecimal dailyRemaining,
            BigDecimal totalLimit,
            BigDecimal totalRemaining,
            BigDecimal drawdownBuffer,
            BigDecimal totalDrawdownBoundary,
            BigDecimal todayRealisedPnl
    ) {
    }
}
