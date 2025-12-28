package com.tradevault.controller;

import com.tradevault.analytics.AnalyticsService;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.analytics.AnalyticsResponse;
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
                                     @RequestParam(required = false) OffsetDateTime to,
                                     @RequestParam(required = false) String symbol,
                                     @RequestParam(required = false) Direction direction,
                                     @RequestParam(required = false) TradeStatus status,
                                     @RequestParam(required = false) String strategy) {
        return analyticsService.summarize(from, to, symbol, direction, status, strategy);
    }
}
