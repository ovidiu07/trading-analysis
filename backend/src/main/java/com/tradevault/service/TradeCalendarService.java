package com.tradevault.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.Plan;
import com.tradevault.domain.entity.PlanAsset;
import com.tradevault.domain.entity.TodaySession;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.PnlBasis;
import com.tradevault.domain.enums.PlanScope;
import com.tradevault.domain.enums.PlanSource;
import com.tradevault.domain.enums.TodaySessionStatus;
import com.tradevault.dto.asset.AssetResponse;
import com.tradevault.dto.calendar.CalendarAccountOptionResponse;
import com.tradevault.dto.calendar.CalendarPlanSummaryResponse;
import com.tradevault.dto.calendar.CalendarPlansResponse;
import com.tradevault.dto.trade.DailyPnlResponse;
import com.tradevault.dto.trade.MonthlyPnlSummaryResponse;
import com.tradevault.repository.AccountRepository;
import com.tradevault.repository.PlanAssetRepository;
import com.tradevault.repository.PlanRepository;
import com.tradevault.repository.SessionSetupRepository;
import com.tradevault.repository.TodaySessionRepository;
import com.tradevault.repository.TradeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TradeCalendarService {
    private static final Logger log = LoggerFactory.getLogger(TradeCalendarService.class);

    private final TradeRepository tradeRepository;
    private final AccountRepository accountRepository;
    private final TodaySessionRepository todaySessionRepository;
    private final PlanRepository planRepository;
    private final PlanAssetRepository planAssetRepository;
    private final SessionSetupRepository sessionSetupRepository;
    private final CurrentUserService currentUserService;
    private final TimezoneService timezoneService;
    private final AssetService assetService;
    private final ObjectMapper objectMapper;

    public List<DailyPnlResponse> fetchDailyPnl(LocalDate from, LocalDate to, String tz, PnlBasis basis, String accountId) {
        User user = currentUserService.getCurrentUser();
        ZoneId zone = timezoneService.resolveZone(tz, user);
        AccountFilter accountFilter = resolveAccountFilter(accountId);
        String statusExpectation = (basis == PnlBasis.CLOSE) ? "CLOSED" : "OPEN";
        /*log.info("[CALENDAR] fetchDailyPnl userId={}, from={}, to={}, tz={}, basis={}, statusExpectation={}",
                user.getId(), from, to, zone.getId(), basis, statusExpectation);*/

        List<TradeRepository.DailyPnlAggregate> aggregates = switch (basis) {
            case OPEN -> tradeRepository.aggregateDailyPnlByOpenedDate(
                    user.getId(),
                    from,
                    to,
                    zone.getId(),
                    accountFilter.brokerAccountId(),
                    accountFilter.accountRefId(),
                    accountFilter.unassigned()
            );
            case CLOSE -> tradeRepository.aggregateDailyPnlByClosedDate(
                    user.getId(),
                    from,
                    to,
                    zone.getId(),
                    accountFilter.brokerAccountId(),
                    accountFilter.accountRefId(),
                    accountFilter.unassigned()
            );
        };

        /*log.info("[CALENDAR] fetchDailyPnl result size={}", (aggregates != null ? aggregates.size() : 0));*/

        return aggregates.stream()
                .map(row -> new DailyPnlResponse(
                        row.getDate(),
                        row.getNetPnl(),
                        row.getTradeCount(),
                        row.getWins(),
                        row.getLosses()
                ))
                .toList();
    }

    public MonthlyPnlSummaryResponse fetchMonthlySummary(int year, int month, String tz, PnlBasis basis, String accountId) {
        User user = currentUserService.getCurrentUser();
        ZoneId zone = timezoneService.resolveZone(tz, user);
        AccountFilter accountFilter = resolveAccountFilter(accountId);
        LocalDate monthStart = LocalDate.of(year, month, 1);
        LocalDate monthEnd = monthStart.with(TemporalAdjusters.lastDayOfMonth());

        TradeRepository.MonthlyPnlAggregate aggregate = switch (basis) {
            case CLOSE -> tradeRepository.aggregateMonthlyPnlByClosedDate(
                    user.getId(),
                    monthStart,
                    monthEnd,
                    zone.getId(),
                    accountFilter.brokerAccountId(),
                    accountFilter.accountRefId(),
                    accountFilter.unassigned()
            );
            case OPEN -> throw new IllegalArgumentException("Monthly summary supports CLOSE basis only");
        };

        BigDecimal netPnl = aggregate != null && aggregate.getNetPnl() != null ? aggregate.getNetPnl() : BigDecimal.ZERO;
        BigDecimal grossPnl = aggregate != null && aggregate.getGrossPnl() != null ? aggregate.getGrossPnl() : BigDecimal.ZERO;
        long tradeCount = aggregate != null ? aggregate.getTradeCount() : 0;
        long tradingDays = aggregate != null ? aggregate.getTradingDays() : 0;

        return new MonthlyPnlSummaryResponse(
                year,
                month,
                zone.getId(),
                netPnl,
                grossPnl,
                tradeCount,
                tradingDays
        );
    }

    @Transactional(readOnly = true)
    public List<CalendarAccountOptionResponse> fetchAccountOptions() {
        User user = currentUserService.getCurrentUser();
        List<CalendarAccountOptionResponse> options = new ArrayList<>();

        for (Account account : accountRepository.findByUserIdOrderByNameAsc(user.getId())) {
            String label = firstNonBlank(account.getName(), account.getId().toString());
            options.add(new CalendarAccountOptionResponse(account.getId().toString(), label, "managed"));
        }

        Set<String> normalizedBrokerIds = new HashSet<>();
        for (String rawId : tradeRepository.findDistinctBrokerAccountIdsByUserId(user.getId())) {
            String displayId = normalizeOptionalText(rawId);
            if (displayId != null && normalizedBrokerIds.add(displayId.toLowerCase(Locale.ROOT))) {
                options.add(new CalendarAccountOptionResponse(displayId, displayId, "broker"));
            }
        }
        return options;
    }

    @Transactional
    public CalendarPlansResponse fetchPlanSummaries(LocalDate from, LocalDate to, String tz) {
        User user = currentUserService.getCurrentUser();
        ZoneId zone = timezoneService.resolveZone(tz, user);
        LocalDate resolvedFrom = from == null ? LocalDate.now(zone).withDayOfMonth(1) : from;
        LocalDate resolvedTo = to == null ? resolvedFrom.with(TemporalAdjusters.lastDayOfMonth()) : to;
        if (resolvedFrom.isAfter(resolvedTo)) {
            throw new IllegalArgumentException("from must be before or equal to to");
        }

        LocalDate today = LocalDate.now(zone);
        List<TodaySession> dailySessions = new java.util.ArrayList<>(
                todaySessionRepository.findByUser_IdAndSessionDateBetweenOrderBySessionDateAsc(user.getId(), resolvedFrom, resolvedTo)
        );
        boolean requestedRangeIncludesToday = !today.isBefore(resolvedFrom) && !today.isAfter(resolvedTo);
        if (requestedRangeIncludesToday && dailySessions.stream().noneMatch(session -> today.equals(session.getSessionDate()))) {
            dailySessions.add(createDefaultTodaySession(user, today));
        }

        List<TodaySession> activeDailyPlanSessions = dailySessions.stream()
                .filter(session -> session.getPlanRemovedAt() == null)
                .toList();
        Map<UUID, List<PlanAsset>> sessionImages = mapImagesByTodaySession(activeDailyPlanSessions);
        List<CalendarPlanSummaryResponse> dailyPlans = activeDailyPlanSessions.stream()
                .sorted(java.util.Comparator.comparing(TodaySession::getSessionDate))
                .map(session -> toDailySummary(session, zone, sessionImages.getOrDefault(session.getId(), List.of())))
                .toList();

        CalendarPlanSummaryResponse activeWeeklyPlan = null;
        CalendarPlanSummaryResponse activeMonthlyPlan = null;
        if (requestedRangeIncludesToday) {
            PeriodWindow weekWindow = resolvePeriodWindow(PlanScope.WEEKLY, today, zone);
            Plan weekly = planRepository.findUserActiveByWindow(PlanSource.USER, PlanScope.WEEKLY, user.getId(), weekWindow.start(), weekWindow.end())
                    .stream()
                    .findFirst()
                    .orElse(null);
            activeWeeklyPlan = weekly == null ? null : toPlanSummary(weekly, weekWindow, planAssetRepository.findByPlan_IdOrderBySortOrderAscCreatedAtAsc(weekly.getId()));

            PeriodWindow monthWindow = resolvePeriodWindow(PlanScope.MONTHLY, today, zone);
            Plan monthly = planRepository.findUserActiveByWindow(PlanSource.USER, PlanScope.MONTHLY, user.getId(), monthWindow.start(), monthWindow.end())
                    .stream()
                    .findFirst()
                    .orElse(null);
            activeMonthlyPlan = monthly == null ? null : toPlanSummary(monthly, monthWindow, planAssetRepository.findByPlan_IdOrderBySortOrderAscCreatedAtAsc(monthly.getId()));
        }

        return CalendarPlansResponse.builder()
                .activeMonthlyPlan(activeMonthlyPlan)
                .activeWeeklyPlan(activeWeeklyPlan)
                .dailyPlans(dailyPlans)
                .build();
    }

    private TodaySession createDefaultTodaySession(User user, LocalDate date) {
        TodaySession session = TodaySession.builder()
                .user(user)
                .sessionDate(date)
                .profitTarget(BigDecimal.ZERO)
                .lossLimit(BigDecimal.ZERO)
                .maxTrades(1)
                .stopAfterTargetReached(Boolean.FALSE)
                .stopAfterMaxLossReached(Boolean.TRUE)
                .status(TodaySessionStatus.ACTIVE)
                .liveModeOnly(Boolean.TRUE)
                .build();
        return todaySessionRepository.save(session);
    }

    private CalendarPlanSummaryResponse toDailySummary(TodaySession session, ZoneId zone, List<PlanAsset> images) {
        LocalDate date = session.getSessionDate();
        long setupCount = sessionSetupRepository.countByTodaySession_IdAndUser_Id(session.getId(), session.getUser().getId());
        String thumbnailUrl = firstThumbnail(images);
        long imageCount = images == null ? 0 : images.size();
        return CalendarPlanSummaryResponse.builder()
                .id(session.getId())
                .scope(PlanScope.DAILY)
                .title("Today Plan")
                .bias(session.getLockInBias())
                .objectives(session.getLockInObjective())
                .focusSymbols(List.of())
                .periodStart(date)
                .periodEnd(date)
                .activeFrom(date.atStartOfDay(zone).toOffsetDateTime())
                .activeTo(date.plusDays(1).atStartOfDay(zone).minusNanos(1).toOffsetDateTime())
                .status(session.getStatus() == null ? null : session.getStatus().name())
                .setupCount(setupCount)
                .imageCount(imageCount)
                .thumbnailUrl(thumbnailUrl)
                .hasImages(imageCount > 0)
                .build();
    }

    private CalendarPlanSummaryResponse toPlanSummary(Plan plan, PeriodWindow window, List<PlanAsset> images) {
        JsonNode content = readContent(plan);
        List<String> focusSymbols = readStringList(content, "focusSymbols");
        long imageCount = images == null ? 0 : images.size();
        return CalendarPlanSummaryResponse.builder()
                .id(plan.getId())
                .scope(plan.getScope())
                .title(firstText(content, "title", plan.getTitle()))
                .bias(firstText(content, "bias", null))
                .objectives(firstText(content, "objectives", null))
                .focusSymbols(focusSymbols)
                .periodStart(window.periodStart())
                .periodEnd(window.periodEnd())
                .activeFrom(plan.getActiveFrom())
                .activeTo(plan.getActiveTo())
                .status("ACTIVE")
                .setupCount(null)
                .imageCount(imageCount)
                .thumbnailUrl(firstThumbnail(images))
                .hasImages(imageCount > 0)
                .build();
    }

    private Map<UUID, List<PlanAsset>> mapImagesByTodaySession(List<TodaySession> sessions) {
        List<UUID> ids = sessions.stream()
                .map(TodaySession::getId)
                .filter(Objects::nonNull)
                .toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<UUID, List<PlanAsset>> result = new LinkedHashMap<>();
        for (PlanAsset row : planAssetRepository.findByTodaySession_IdInOrderBySortOrderAscCreatedAtAsc(ids)) {
            if (row.getTodaySession() == null) {
                continue;
            }
            result.computeIfAbsent(row.getTodaySession().getId(), ignored -> new java.util.ArrayList<>()).add(row);
        }
        return result;
    }

    private String firstThumbnail(List<PlanAsset> images) {
        if (images == null || images.isEmpty()) {
            return null;
        }
        for (PlanAsset image : images) {
            AssetResponse asset = assetService.toAssetResponse(image.getAsset());
            String value = firstNonBlank(asset.getThumbnailUrl(), asset.getViewUrl(), asset.getUrl());
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private JsonNode readContent(Plan plan) {
        if (plan == null || plan.getContent() == null || plan.getContent().isBlank()) {
            return objectMapper.createObjectNode();
        }
        try {
            return objectMapper.readTree(plan.getContent());
        } catch (Exception ex) {
            log.debug("Could not parse plan content for calendar summary planId={}", plan.getId(), ex);
            return objectMapper.createObjectNode();
        }
    }

    private List<String> readStringList(JsonNode content, String field) {
        if (content == null || !content.has(field) || !content.get(field).isArray()) {
            return List.of();
        }
        List<String> values = new java.util.ArrayList<>();
        content.get(field).forEach(item -> {
            if (item != null && item.isTextual() && !item.asText().isBlank()) {
                values.add(item.asText().trim());
            }
        });
        return values;
    }

    private String firstText(JsonNode content, String field, String fallback) {
        if (content != null && content.has(field) && content.get(field).isTextual() && !content.get(field).asText().isBlank()) {
            return content.get(field).asText().trim();
        }
        return fallback;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return null;
    }

    private PeriodWindow resolvePeriodWindow(PlanScope scope, LocalDate today, ZoneId zone) {
        if (scope == PlanScope.WEEKLY) {
            LocalDate start = today.with(WeekFields.ISO.dayOfWeek(), 1);
            LocalDate end = start.plusDays(6);
            return new PeriodWindow(
                    start.atStartOfDay(zone).toOffsetDateTime(),
                    end.plusDays(1).atStartOfDay(zone).minusNanos(1).toOffsetDateTime(),
                    start,
                    end
            );
        }
        LocalDate start = today.withDayOfMonth(1);
        LocalDate end = start.plusMonths(1).minusDays(1);
        return new PeriodWindow(
                start.atStartOfDay(zone).toOffsetDateTime(),
                end.plusDays(1).atStartOfDay(zone).minusNanos(1).toOffsetDateTime(),
                start,
                end
        );
    }

    private AccountFilter resolveAccountFilter(String accountId) {
        String brokerAccountId = normalizeOptionalText(accountId);
        if ("unassigned".equalsIgnoreCase(brokerAccountId)) {
            return new AccountFilter(null, null, true);
        }
        return new AccountFilter(brokerAccountId, parseUuidOrNull(brokerAccountId), false);
    }

    private UUID parseUuidOrNull(String value) {
        if (value == null) {
            return null;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private record AccountFilter(String brokerAccountId, UUID accountRefId, boolean unassigned) {}

    private record PeriodWindow(OffsetDateTime start, OffsetDateTime end, LocalDate periodStart, LocalDate periodEnd) {}
}
