package com.tradevault.controller;

import com.tradevault.analytics.AnalyticsService;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.analytics.AnalyticsBreakdownResponse;
import com.tradevault.dto.analytics.AnalyticsResponse;
import com.tradevault.dto.analytics.AnalyticsTimeseriesResponse;
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
                                     @RequestParam(required = false) String strategy,
                                     @RequestParam(required = false) String setup,
                                     @RequestParam(required = false) String catalyst,
                                     @RequestParam(required = false) String market,
                                     @RequestParam(required = false) String dateMode,
                                     @RequestParam(required = false, defaultValue = "false") boolean excludeOutliers,
                                     @RequestParam(required = false) String holdingBucket) {
        return analyticsService.summarize(from, to, symbol, direction, status, strategy, setup, catalyst, market, dateMode, excludeOutliers, holdingBucket);
    }

    @GetMapping("/timeseries")
    public AnalyticsTimeseriesResponse timeseries(@RequestParam(required = false) OffsetDateTime from,
                                                  @RequestParam(required = false) OffsetDateTime to,
                                                  @RequestParam(required = false) String symbol,
                                                  @RequestParam(required = false) Direction direction,
                                                  @RequestParam(required = false) TradeStatus status,
                                                  @RequestParam(required = false) String strategy,
                                                  @RequestParam(required = false) String setup,
                                                  @RequestParam(required = false) String catalyst,
                                                  @RequestParam(required = false) String market,
                                                  @RequestParam(required = false) String dateMode,
                                                  @RequestParam(required = false) String bucket,
                                                  @RequestParam(required = false) Integer window) {
        return analyticsService.timeseries(from, to, symbol, direction, status, strategy, setup, catalyst, market, dateMode, bucket, window);
    }

    @GetMapping("/breakdown")
    public AnalyticsBreakdownResponse breakdown(@RequestParam(required = false) OffsetDateTime from,
                                                @RequestParam(required = false) OffsetDateTime to,
                                                @RequestParam(required = false) String symbol,
                                                @RequestParam(required = false) Direction direction,
                                                @RequestParam(required = false) TradeStatus status,
                                                @RequestParam(required = false) String strategy,
                                                @RequestParam(required = false) String setup,
                                                @RequestParam(required = false) String catalyst,
                                                @RequestParam(required = false) String market,
                                                @RequestParam(required = false) String dateMode,
                                                @RequestParam(required = false) String groupBy) {
        return analyticsService.breakdown(from, to, symbol, direction, status, strategy, setup, catalyst, market, dateMode, groupBy);
    }
}
