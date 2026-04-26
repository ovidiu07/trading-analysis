package com.tradevault.service;

import com.tradevault.domain.entity.Plan;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.PlanScope;
import com.tradevault.domain.enums.PlanSource;
import com.tradevault.dto.plan.ActivePlanSuggestionResponse;
import com.tradevault.dto.plan.MyPlanRequest;
import com.tradevault.dto.plan.PlanResponse;
import com.tradevault.dto.plan.PlanSummaryResponse;
import com.tradevault.repository.PlanRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PlanService {

    private final PlanRepository planRepository;
    private final CurrentUserService currentUserService;
    private final TimezoneService timezoneService;

    public PlanResponse getMentorDailyPlan(LocalDate date, String timezone) {
        User user = currentUserService.getCurrentUser();
        ZoneId zone = timezoneService.resolveZone(timezone, user);
        TimeWindow window = resolveWindow(date, zone);

        return planRepository.findFeaturedActiveByWindow(PlanSource.MENTOR, PlanScope.DAILY, window.start(), window.end())
                .stream()
                .findFirst()
                .map(this::toResponse)
                .orElse(null);
    }

    public PlanResponse getMyDailyPlan(LocalDate date, String timezone) {
        User user = currentUserService.getCurrentUser();
        ZoneId zone = timezoneService.resolveZone(timezone, user);
        TimeWindow window = resolveWindow(date, zone);

        return planRepository.findUserActiveByWindow(PlanSource.USER, PlanScope.DAILY, user.getId(), window.start(), window.end())
                .stream()
                .findFirst()
                .map(this::toResponse)
                .orElse(null);
    }

    @Transactional
    public PlanResponse createMyDailyPlan(MyPlanRequest request) {
        User user = currentUserService.getCurrentUser();
        ZoneId zone = timezoneService.resolveZone(null, user);
        OffsetDateTime resolvedTo = resolveActiveTo(request.getActiveFrom(), request.getActiveTo(), zone);
        validateInterval(request.getActiveFrom(), resolvedTo);

        OffsetDateTime now = OffsetDateTime.now();
        Plan created = planRepository.save(Plan.builder()
                .scope(PlanScope.DAILY)
                .source(PlanSource.USER)
                .authorUserId(user.getId())
                .authorDisplayName(deriveAuthorDisplayName(user))
                .title(request.getTitle().trim())
                .content(request.getContent().trim())
                .checklistJson(blankToNull(request.getChecklistJson()))
                .activeFrom(request.getActiveFrom())
                .activeTo(resolvedTo)
                .featured(false)
                .createdAt(now)
                .updatedAt(now)
                .build());

        return toResponse(created);
    }

    @Transactional
    public PlanResponse updateMyPlan(UUID planId, MyPlanRequest request) {
        User user = currentUserService.getCurrentUser();
        Plan plan = planRepository.findByIdAndSourceAndAuthorUserIdAndRemovedAtIsNull(planId, PlanSource.USER, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Plan not found"));

        ZoneId zone = timezoneService.resolveZone(null, user);
        OffsetDateTime resolvedTo = resolveActiveTo(request.getActiveFrom(), request.getActiveTo(), zone);
        validateInterval(request.getActiveFrom(), resolvedTo);

        plan.setTitle(request.getTitle().trim());
        plan.setContent(request.getContent().trim());
        plan.setChecklistJson(blankToNull(request.getChecklistJson()));
        plan.setActiveFrom(request.getActiveFrom());
        plan.setActiveTo(resolvedTo);
        plan.setUpdatedAt(OffsetDateTime.now());

        return toResponse(planRepository.save(plan));
    }

    @Transactional
    public void deleteMyPlan(UUID planId) {
        User user = currentUserService.getCurrentUser();
        Plan plan = planRepository.findByIdAndSourceAndAuthorUserId(planId, PlanSource.USER, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Plan not found"));
        if (plan.getRemovedAt() == null) {
            OffsetDateTime now = OffsetDateTime.now();
            plan.setRemovedAt(now);
            plan.setRemovedByUserId(user.getId());
            plan.setUpdatedAt(now);
            planRepository.save(plan);
        }
    }

    public List<PlanResponse> listMyPlans(PlanScope scope, OffsetDateTime from, OffsetDateTime to) {
        User user = currentUserService.getCurrentUser();
        return planRepository.searchMyPlans(user.getId(), PlanSource.USER, scope, from, to)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public ActivePlanSuggestionResponse getActivePlanSuggestionsForTrade(OffsetDateTime openedAt) {
        User user = currentUserService.getCurrentUser();

        Plan mentor = planRepository.findFeaturedActiveAtMoment(PlanSource.MENTOR, PlanScope.DAILY, openedAt)
                .stream()
                .findFirst()
                .orElse(null);

        Plan mine = planRepository.findUserActiveAtMoment(PlanSource.USER, PlanScope.DAILY, user.getId(), openedAt)
                .stream()
                .findFirst()
                .orElse(null);

        List<Plan> plans = new ArrayList<>();
        if (mentor != null) {
            plans.add(mentor);
        }
        if (mine != null && (mentor == null || !mine.getId().equals(mentor.getId()))) {
            plans.add(mine);
        }

        Set<UUID> suggestedPlanIds = new LinkedHashSet<>();
        plans.forEach(plan -> suggestedPlanIds.add(plan.getId()));

        return ActivePlanSuggestionResponse.builder()
                .plans(plans.stream().map(this::toSummary).toList())
                .suggestedPlanIds(List.copyOf(suggestedPlanIds))
                .build();
    }

    private PlanResponse toResponse(Plan plan) {
        return PlanResponse.builder()
                .id(plan.getId())
                .scope(plan.getScope())
                .source(plan.getSource())
                .authorUserId(plan.getAuthorUserId())
                .authorDisplayName(plan.getAuthorDisplayName())
                .title(plan.getTitle())
                .content(plan.getContent())
                .checklistJson(plan.getChecklistJson())
                .activeFrom(plan.getActiveFrom())
                .activeTo(plan.getActiveTo())
                .featured(plan.isFeatured())
                .createdAt(plan.getCreatedAt())
                .updatedAt(plan.getUpdatedAt())
                .build();
    }

    private PlanSummaryResponse toSummary(Plan plan) {
        return PlanSummaryResponse.builder()
                .id(plan.getId())
                .title(plan.getTitle())
                .scope(plan.getScope())
                .source(plan.getSource())
                .authorDisplayName(plan.getAuthorDisplayName())
                .featured(plan.isFeatured())
                .activeFrom(plan.getActiveFrom())
                .activeTo(plan.getActiveTo())
                .build();
    }

    private TimeWindow resolveWindow(LocalDate date, ZoneId zone) {
        LocalDate resolvedDate = date != null ? date : LocalDate.now(zone);
        OffsetDateTime start = resolvedDate.atStartOfDay(zone).toOffsetDateTime();
        OffsetDateTime end = resolvedDate.plusDays(1).atStartOfDay(zone).minusNanos(1).toOffsetDateTime();
        return new TimeWindow(start, end);
    }

    private OffsetDateTime resolveActiveTo(OffsetDateTime activeFrom, OffsetDateTime activeTo, ZoneId zone) {
        if (activeFrom == null) {
            throw new IllegalArgumentException("activeFrom is required");
        }
        if (activeTo != null) {
            return activeTo;
        }
        LocalDate localDay = activeFrom.atZoneSameInstant(zone).toLocalDate();
        return localDay.plusDays(1).atStartOfDay(zone).minusNanos(1).toOffsetDateTime();
    }

    private void validateInterval(OffsetDateTime activeFrom, OffsetDateTime activeTo) {
        if (activeFrom == null || activeTo == null || activeFrom.isAfter(activeTo)) {
            throw new IllegalArgumentException("activeFrom must be before or equal to activeTo");
        }
    }

    private String deriveAuthorDisplayName(User user) {
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            return "";
        }
        String email = user.getEmail().trim();
        int atIndex = email.indexOf('@');
        return atIndex > 0 ? email.substring(0, atIndex) : email;
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private record TimeWindow(OffsetDateTime start, OffsetDateTime end) {
    }
}
