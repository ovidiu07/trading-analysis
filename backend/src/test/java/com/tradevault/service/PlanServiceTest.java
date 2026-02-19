package com.tradevault.service;

import com.tradevault.domain.entity.Plan;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.PlanScope;
import com.tradevault.domain.enums.PlanSource;
import com.tradevault.dto.plan.ActivePlanSuggestionResponse;
import com.tradevault.dto.plan.PlanResponse;
import com.tradevault.repository.PlanRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PlanServiceTest {

    private PlanRepository planRepository;
    private CurrentUserService currentUserService;
    private TimezoneService timezoneService;
    private PlanService planService;
    private User user;

    @BeforeEach
    void setup() {
        planRepository = Mockito.mock(PlanRepository.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        timezoneService = Mockito.mock(TimezoneService.class);
        planService = new PlanService(planRepository, currentUserService, timezoneService);

        user = User.builder()
                .id(UUID.randomUUID())
                .email("trader@example.com")
                .timezone("Europe/Bucharest")
                .build();

        when(currentUserService.getCurrentUser()).thenReturn(user);
    }

    @Test
    void getMyDailyPlanResolvesBucharestDayBoundaries() {
        when(timezoneService.resolveZone(eq("Europe/Bucharest"), eq(user))).thenReturn(ZoneId.of("Europe/Bucharest"));
        when(planRepository.findUserActiveByWindow(eq(PlanSource.USER), eq(PlanScope.DAILY), eq(user.getId()), Mockito.any(), Mockito.any()))
                .thenReturn(List.of());

        planService.getMyDailyPlan(LocalDate.parse("2026-02-06"), "Europe/Bucharest");

        ArgumentCaptor<OffsetDateTime> startCaptor = ArgumentCaptor.forClass(OffsetDateTime.class);
        ArgumentCaptor<OffsetDateTime> endCaptor = ArgumentCaptor.forClass(OffsetDateTime.class);

        verify(planRepository).findUserActiveByWindow(
                eq(PlanSource.USER),
                eq(PlanScope.DAILY),
                eq(user.getId()),
                startCaptor.capture(),
                endCaptor.capture()
        );

        assertEquals(OffsetDateTime.parse("2026-02-06T00:00:00+02:00"), startCaptor.getValue());
        assertEquals(OffsetDateTime.parse("2026-02-06T23:59:59.999999999+02:00"), endCaptor.getValue());
    }

    @Test
    void listMyPlansAlwaysUsesUserSourceFilter() {
        when(planRepository.searchMyPlans(user.getId(), PlanSource.USER, PlanScope.DAILY, null, null))
                .thenReturn(List.of());

        planService.listMyPlans(PlanScope.DAILY, null, null);

        verify(planRepository).searchMyPlans(user.getId(), PlanSource.USER, PlanScope.DAILY, null, null);
    }

    @Test
    void activePlanSuggestionsIncludeMentorAndUserInOrder() {
        Plan mentorPlan = Plan.builder()
                .id(UUID.randomUUID())
                .scope(PlanScope.DAILY)
                .source(PlanSource.MENTOR)
                .title("Mentor focus")
                .activeFrom(OffsetDateTime.parse("2026-02-06T07:00:00+02:00"))
                .activeTo(OffsetDateTime.parse("2026-02-06T23:00:00+02:00"))
                .featured(true)
                .build();

        Plan myPlan = Plan.builder()
                .id(UUID.randomUUID())
                .scope(PlanScope.DAILY)
                .source(PlanSource.USER)
                .authorUserId(user.getId())
                .title("My plan")
                .activeFrom(OffsetDateTime.parse("2026-02-06T06:00:00+02:00"))
                .activeTo(OffsetDateTime.parse("2026-02-06T23:59:00+02:00"))
                .build();

        OffsetDateTime openedAt = OffsetDateTime.parse("2026-02-06T10:00:00+02:00");

        when(planRepository.findFeaturedActiveAtMoment(PlanSource.MENTOR, PlanScope.DAILY, openedAt))
                .thenReturn(List.of(mentorPlan));
        when(planRepository.findUserActiveAtMoment(PlanSource.USER, PlanScope.DAILY, user.getId(), openedAt))
                .thenReturn(List.of(myPlan));

        ActivePlanSuggestionResponse response = planService.getActivePlanSuggestionsForTrade(openedAt);

        assertNotNull(response);
        assertEquals(2, response.getPlans().size());
        assertEquals(mentorPlan.getId(), response.getPlans().get(0).getId());
        assertEquals(myPlan.getId(), response.getPlans().get(1).getId());
        assertEquals(List.of(mentorPlan.getId(), myPlan.getId()), response.getSuggestedPlanIds());
    }

    @Test
    void getMentorDailyPlanReturnsFirstActivePlan() {
        when(timezoneService.resolveZone(eq("Europe/Bucharest"), eq(user))).thenReturn(ZoneId.of("Europe/Bucharest"));

        Plan mentorPlan = Plan.builder()
                .id(UUID.randomUUID())
                .scope(PlanScope.DAILY)
                .source(PlanSource.MENTOR)
                .title("Mentor plan")
                .content("Follow levels")
                .activeFrom(OffsetDateTime.parse("2026-02-06T00:00:00+02:00"))
                .activeTo(OffsetDateTime.parse("2026-02-06T23:59:59+02:00"))
                .featured(true)
                .build();

        when(planRepository.findFeaturedActiveByWindow(eq(PlanSource.MENTOR), eq(PlanScope.DAILY), Mockito.any(), Mockito.any()))
                .thenReturn(List.of(mentorPlan));

        PlanResponse response = planService.getMentorDailyPlan(LocalDate.parse("2026-02-06"), "Europe/Bucharest");
        assertNotNull(response);
        assertEquals(mentorPlan.getId(), response.getId());
        assertEquals("Mentor plan", response.getTitle());
    }

    @Test
    void getMyDailyPlanResolvesLosAngelesDayBoundaries() {
        when(timezoneService.resolveZone(eq("America/Los_Angeles"), eq(user))).thenReturn(ZoneId.of("America/Los_Angeles"));
        when(planRepository.findUserActiveByWindow(eq(PlanSource.USER), eq(PlanScope.DAILY), eq(user.getId()), Mockito.any(), Mockito.any()))
                .thenReturn(List.of());

        planService.getMyDailyPlan(LocalDate.parse("2026-01-01"), "America/Los_Angeles");

        ArgumentCaptor<OffsetDateTime> startCaptor = ArgumentCaptor.forClass(OffsetDateTime.class);
        ArgumentCaptor<OffsetDateTime> endCaptor = ArgumentCaptor.forClass(OffsetDateTime.class);

        verify(planRepository).findUserActiveByWindow(
                eq(PlanSource.USER),
                eq(PlanScope.DAILY),
                eq(user.getId()),
                startCaptor.capture(),
                endCaptor.capture()
        );

        assertEquals(OffsetDateTime.parse("2026-01-01T00:00:00-08:00"), startCaptor.getValue());
        assertEquals(OffsetDateTime.parse("2026-01-01T23:59:59.999999999-08:00"), endCaptor.getValue());
    }
}
