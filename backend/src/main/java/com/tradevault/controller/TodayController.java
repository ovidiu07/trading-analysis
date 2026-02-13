package com.tradevault.controller;

import com.tradevault.dto.today.CoachFocusResponse;
import com.tradevault.service.today.TodayService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/today")
@RequiredArgsConstructor
public class TodayController {
    private final TodayService todayService;

    @GetMapping("/coach-focus")
    public CoachFocusResponse coachFocus() {
        return todayService.getCoachFocus();
    }
}
