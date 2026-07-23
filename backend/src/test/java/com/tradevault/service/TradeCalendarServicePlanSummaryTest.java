package com.tradevault.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.Asset;
import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.Plan;
import com.tradevault.domain.entity.PlanAsset;
import com.tradevault.domain.entity.TodaySession;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.AssetScope;
import com.tradevault.domain.enums.PlanScope;
import com.tradevault.domain.enums.PlanSource;
import com.tradevault.domain.enums.TodaySessionStatus;
import com.tradevault.dto.asset.AssetResponse;
import com.tradevault.repository.PlanAssetRepository;
import com.tradevault.repository.PlanRepository;
import com.tradevault.repository.SessionSetupRepository;
import com.tradevault.repository.TodaySessionRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.repository.AccountRepository;
import com.tradevault.service.account.AccountScopeService;
import com.tradevault.service.account.AuthorizedAccountScope;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;

class TradeCalendarServicePlanSummaryTest {
    private TradeRepository tradeRepository;
    private AccountRepository accountRepository;
    private TodaySessionRepository todaySessionRepository;
    private PlanRepository planRepository;
    private PlanAssetRepository planAssetRepository;
    private SessionSetupRepository sessionSetupRepository;
    private CurrentUserService currentUserService;
    private TimezoneService timezoneService;
    private AssetService assetService;
    private AccountScopeService accountScopeService;
    private TradeCalendarService tradeCalendarService;

    private User user;
    private ZoneId zone;

    @BeforeEach
    void setup() {
        tradeRepository = mock(TradeRepository.class);
        accountRepository = mock(AccountRepository.class);
        todaySessionRepository = mock(TodaySessionRepository.class);
        planRepository = mock(PlanRepository.class);
        planAssetRepository = mock(PlanAssetRepository.class);
        sessionSetupRepository = mock(SessionSetupRepository.class);
        currentUserService = mock(CurrentUserService.class);
        timezoneService = mock(TimezoneService.class);
        assetService = mock(AssetService.class);
        accountScopeService = mock(AccountScopeService.class);
        zone = ZoneId.of("Europe/Bucharest");

        tradeCalendarService = new TradeCalendarService(
                tradeRepository,
                accountRepository,
                todaySessionRepository,
                planRepository,
                planAssetRepository,
                sessionSetupRepository,
                currentUserService,
                timezoneService,
                assetService,
                new ObjectMapper().findAndRegisterModules(),
                accountScopeService
        );

        user = User.builder()
                .id(UUID.randomUUID())
                .email("calendar@example.com")
                .timezone(zone.getId())
                .build();
        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(timezoneService.resolveZone(null, user)).thenReturn(zone);
        when(accountScopeService.resolve(any(), any())).thenReturn(new AuthorizedAccountScope(
                user.getId(), AuthorizedAccountScope.Mode.ALL, java.util.Set.of(), List.of()
        ));
    }

    @Test
    void returnsDailyWeeklyAndMonthlyPlanSummariesWithImageMetadata() {
        LocalDate today = LocalDate.now(zone);
        LocalDate from = today.withDayOfMonth(1);
        LocalDate to = today.with(TemporalAdjusters.lastDayOfMonth());

        TodaySession session = TodaySession.builder()
                .id(UUID.randomUUID())
                .user(user)
                .sessionDate(today)
                .profitTarget(BigDecimal.ZERO)
                .lossLimit(BigDecimal.ZERO)
                .maxTrades(1)
                .status(TodaySessionStatus.ACTIVE)
                .lockInBias("LONG")
                .lockInObjective("A+ only")
                .build();
        Plan weekly = buildPlan(PlanScope.WEEKLY, "Weekly prep", "{\"title\":\"Weekly prep\",\"bias\":\"Long EUR\",\"objectives\":\"Wait for London\"}");
        Plan monthly = buildPlan(PlanScope.MONTHLY, "April context", "{\"title\":\"April context\",\"bias\":\"Risk-on\",\"objectives\":\"Protect drawdown\"}");
        PlanAsset todayImage = imageRow(session, null);
        PlanAsset weeklyImage = imageRow(null, weekly);

        when(todaySessionRepository.findByUser_IdAndSessionDateBetweenOrderBySessionDateAsc(user.getId(), from, to))
                .thenReturn(List.of(session));
        when(planRepository.findUserActiveByWindow(eq(PlanSource.USER), eq(PlanScope.WEEKLY), eq(user.getId()), any(), any()))
                .thenReturn(List.of(weekly));
        when(planRepository.findUserActiveByWindow(eq(PlanSource.USER), eq(PlanScope.MONTHLY), eq(user.getId()), any(), any()))
                .thenReturn(List.of(monthly));
        when(planAssetRepository.findByTodaySession_IdInOrderBySortOrderAscCreatedAtAsc(List.of(session.getId())))
                .thenReturn(List.of(todayImage));
        when(planAssetRepository.findByPlan_IdOrderBySortOrderAscCreatedAtAsc(weekly.getId()))
                .thenReturn(List.of(weeklyImage));
        when(planAssetRepository.findByPlan_IdOrderBySortOrderAscCreatedAtAsc(monthly.getId()))
                .thenReturn(List.of());
        when(sessionSetupRepository.countByTodaySession_IdAndUser_Id(session.getId(), user.getId())).thenReturn(2L);
        when(assetService.toAssetResponse(any(Asset.class))).thenAnswer(invocation -> {
            Asset asset = invocation.getArgument(0, Asset.class);
            return AssetResponse.builder()
                    .id(asset.getId())
                    .scope(AssetScope.PLAN)
                    .originalFileName(asset.getOriginalFileName())
                    .contentType(asset.getContentType())
                    .sizeBytes(asset.getSizeBytes())
                    .viewUrl("/api/assets/%s/view".formatted(asset.getId()))
                    .thumbnailUrl("/api/assets/%s/view".formatted(asset.getId()))
                    .metadata(java.util.Map.of())
                    .build();
        });

        var response = tradeCalendarService.fetchPlanSummaries(from, to, null);

        assertThat(response.getActiveWeeklyPlan().getTitle()).isEqualTo("Weekly prep");
        assertThat(response.getActiveWeeklyPlan().getImageCount()).isEqualTo(1);
        assertThat(response.getActiveMonthlyPlan().getTitle()).isEqualTo("April context");
        assertThat(response.getActiveMonthlyPlan().getImageCount()).isZero();
        assertThat(response.getDailyPlans()).singleElement().satisfies(plan -> {
            assertThat(plan.getTitle()).isEqualTo("Today Plan");
            assertThat(plan.getSetupCount()).isEqualTo(2);
            assertThat(plan.getImageCount()).isEqualTo(1);
            assertThat(plan.getThumbnailUrl()).contains("/api/assets/");
        });
    }

    @Test
    void accountOptionsAreUserScopedAndUseOnlyInternalAccountIds() {
        UUID managedId = UUID.randomUUID();
        when(accountRepository.findByUserIdOrderByNameAsc(user.getId())).thenReturn(List.of(
                Account.builder().id(managedId).user(user).name("Funded 50K").build()
        ));
        when(tradeRepository.findDistinctBrokerAccountIdsByUserId(user.getId())).thenReturn(List.of(
                " Account A ", "account a", "Account B"
        ));

        var options = tradeCalendarService.fetchAccountOptions();

        assertThat(options).extracting("value", "label", "source").containsExactly(
                org.assertj.core.groups.Tuple.tuple(managedId.toString(), "Funded 50K", "managed")
        );
        verify(accountRepository).findByUserIdOrderByNameAsc(user.getId());
        verify(tradeRepository, never()).findDistinctBrokerAccountIdsByUserId(user.getId());
    }

    @Test
    void selectedInternalAccountFilterIsAppliedBeforeDailyAggregation() {
        UUID accountId = UUID.randomUUID();
        when(accountScopeService.resolve(accountId.toString(), null)).thenReturn(new AuthorizedAccountScope(
                user.getId(), AuthorizedAccountScope.Mode.SELECTED, java.util.Set.of(accountId), List.of()
        ));
        when(tradeRepository.aggregateDailyPnlByClosedDate(
                user.getId(), LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31), zone.getId(), null, accountId, false
        )).thenReturn(List.of());

        tradeCalendarService.fetchDailyPnl(
                LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31), null,
                com.tradevault.domain.enums.PnlBasis.CLOSE, accountId.toString(), null
        );

        verify(tradeRepository).aggregateDailyPnlByClosedDate(
                user.getId(), LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31), zone.getId(), null, accountId, false
        );
    }

    @Test
    void removedTodayPlanIsHiddenFromCalendarPlansButDoesNotAffectCalendarResponse() {
        LocalDate today = LocalDate.now(zone);
        LocalDate from = today.withDayOfMonth(1);
        LocalDate to = today.with(TemporalAdjusters.lastDayOfMonth());

        TodaySession removedSession = TodaySession.builder()
                .id(UUID.randomUUID())
                .user(user)
                .sessionDate(today)
                .profitTarget(BigDecimal.ZERO)
                .lossLimit(BigDecimal.ZERO)
                .maxTrades(1)
                .status(TodaySessionStatus.ACTIVE)
                .lockInBias("LONG")
                .lockInObjective("A+ only")
                .planRemovedAt(OffsetDateTime.now(zone))
                .planRemovedByUserId(user.getId())
                .build();

        when(todaySessionRepository.findByUser_IdAndSessionDateBetweenOrderBySessionDateAsc(user.getId(), from, to))
                .thenReturn(List.of(removedSession));
        when(planRepository.findUserActiveByWindow(any(), any(), eq(user.getId()), any(), any()))
                .thenReturn(List.of());

        var response = tradeCalendarService.fetchPlanSummaries(from, to, null);

        assertThat(response.getDailyPlans()).isEmpty();
        assertThat(response.getActiveWeeklyPlan()).isNull();
        assertThat(response.getActiveMonthlyPlan()).isNull();
    }

    private Plan buildPlan(PlanScope scope, String title, String content) {
        return Plan.builder()
                .id(UUID.randomUUID())
                .scope(scope)
                .source(PlanSource.USER)
                .authorUserId(user.getId())
                .title(title)
                .content(content)
                .activeFrom(OffsetDateTime.now(zone).minusDays(1))
                .activeTo(OffsetDateTime.now(zone).plusDays(7))
                .createdAt(OffsetDateTime.now(zone))
                .updatedAt(OffsetDateTime.now(zone))
                .build();
    }

    private PlanAsset imageRow(TodaySession session, Plan plan) {
        Asset asset = Asset.builder()
                .id(UUID.randomUUID())
                .scope(AssetScope.PLAN)
                .originalFileName("plan.png")
                .contentType("image/png")
                .sizeBytes(10L)
                .s3Key("plan-images/key.png")
                .build();
        return PlanAsset.builder()
                .id(UUID.randomUUID())
                .todaySession(session)
                .plan(plan)
                .user(user)
                .planScope(session == null ? plan.getScope() : PlanScope.DAILY)
                .asset(asset)
                .sortOrder(0)
                .build();
    }
}
