package com.tradevault.controller;

import com.tradevault.dto.analytics.AnalyticsResponse;
import com.tradevault.analytics.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {
    private final AnalyticsService analyticsService;

    @GetMapping("/summary")
    public AnalyticsResponse summary(@RequestParam(required = false) OffsetDateTime from,
                                     @RequestParam(required = false) OffsetDateTime to) {
        return analyticsService.summarize(from, to);
    }
}
