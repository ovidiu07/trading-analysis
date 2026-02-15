package com.tradevault.controller;

import com.tradevault.dto.plan.PlanResponse;
import com.tradevault.dto.today.CoachFocusResponse;
import com.tradevault.service.PlanService;
import com.tradevault.service.today.TodayService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/today")
@RequiredArgsConstructor
public class TodayController {
    private final TodayService todayService;
    private final PlanService planService;

    @GetMapping("/coach-focus")
    public CoachFocusResponse coachFocus() {
        return todayService.getCoachFocus();
    }

    @GetMapping("/mentor-plan")
    public PlanResponse mentorPlan(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                   @RequestParam(required = false) String tz) {
        return planService.getMentorDailyPlan(date, tz);
    }

    @GetMapping("/my-plan")
    public PlanResponse myPlan(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                               @RequestParam(required = false) String tz) {
        return planService.getMyDailyPlan(date, tz);
    }
}
