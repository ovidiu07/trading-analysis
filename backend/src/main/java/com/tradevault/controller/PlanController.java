package com.tradevault.controller;

import com.tradevault.domain.enums.PlanScope;
import com.tradevault.dto.plan.ActivePlanSuggestionResponse;
import com.tradevault.dto.plan.DailyPlanResponse;
import com.tradevault.dto.plan.MyPlanRequest;
import com.tradevault.dto.plan.PlanResponse;
import com.tradevault.service.LocaleResolverService;
import com.tradevault.service.PlanService;
import com.tradevault.service.today.TodayService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/plans")
@RequiredArgsConstructor
public class PlanController {

    private final PlanService planService;
    private final TodayService todayService;
    private final LocaleResolverService localeResolverService;

    @PostMapping("/my/daily")
    public ResponseEntity<PlanResponse> createMyDailyPlan(@Valid @RequestBody MyPlanRequest request) {
        return ResponseEntity.ok(planService.createMyDailyPlan(request));
    }

    @PutMapping("/my/{planId}")
    public ResponseEntity<PlanResponse> updateMyPlan(@PathVariable UUID planId,
                                                     @Valid @RequestBody MyPlanRequest request) {
        return ResponseEntity.ok(planService.updateMyPlan(planId, request));
    }

    @DeleteMapping("/my/{planId}")
    public ResponseEntity<Void> deleteMyPlan(@PathVariable UUID planId) {
        planService.deleteMyPlan(planId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/my")
    public List<PlanResponse> listMyPlans(@RequestParam(required = false) PlanScope scope,
                                          @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
                                          @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to) {
        return planService.listMyPlans(scope, from, to);
    }

    @GetMapping("/active")
    public ActivePlanSuggestionResponse activePlans(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime openedAt,
                                                    @RequestParam(required = false) String tz) {
        return planService.getActivePlanSuggestionsForTrade(openedAt);
    }

    @GetMapping("/daily")
    public List<DailyPlanResponse> listDailyPlans(@RequestParam(required = false, defaultValue = "60") Integer recentDays,
                                                  @RequestParam(required = false, name = "lang") String lang,
                                                  @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage) {
        String locale = localeResolverService.resolveLocale(lang, acceptLanguage);
        return todayService.listDailyPlans(locale, recentDays == null ? 60 : recentDays);
    }
}
