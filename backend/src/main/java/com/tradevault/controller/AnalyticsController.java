package com.tradevault.controller;

import com.tradevault.analytics.AnalyticsService;
import com.tradevault.analytics.TradeCoachService;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.analytics.AnalyticsBreakdownResponse;
import com.tradevault.dto.analytics.AnalyticsResponse;
import com.tradevault.dto.analytics.AnalyticsTimeseriesResponse;
import com.tradevault.dto.analytics.CoachResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {
    private final AnalyticsService analyticsService;
    private final TradeCoachService tradeCoachService;
    private static final ZoneId DISPLAY_ZONE = ZoneId.of("Europe/Bucharest");

    @GetMapping("/summary")
    public AnalyticsResponse summary(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
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
        OffsetDateTime fromDate = toStartOfDay(from);
        OffsetDateTime toDate = toEndOfDay(to);
        return analyticsService.summarize(fromDate, toDate, symbol, direction, status, strategy, setup, catalyst, market, dateMode, excludeOutliers, holdingBucket);
    }

    @GetMapping("/timeseries")
    public AnalyticsTimeseriesResponse timeseries(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
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
        OffsetDateTime fromDate = toStartOfDay(from);
        OffsetDateTime toDate = toEndOfDay(to);
        return analyticsService.timeseries(fromDate, toDate, symbol, direction, status, strategy, setup, catalyst, market, dateMode, bucket, window);
    }

    @GetMapping("/breakdown")
    public AnalyticsBreakdownResponse breakdown(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                                @RequestParam(required = false) String symbol,
                                                @RequestParam(required = false) Direction direction,
                                                @RequestParam(required = false) TradeStatus status,
                                                @RequestParam(required = false) String strategy,
                                                @RequestParam(required = false) String setup,
                                                @RequestParam(required = false) String catalyst,
                                                @RequestParam(required = false) String market,
                                                @RequestParam(required = false) String dateMode,
                                                @RequestParam(required = false) String groupBy) {
        OffsetDateTime fromDate = toStartOfDay(from);
        OffsetDateTime toDate = toEndOfDay(to);
        return analyticsService.breakdown(fromDate, toDate, symbol, direction, status, strategy, setup, catalyst, market, dateMode, groupBy);
    }

    @GetMapping("/coach")
    public CoachResponse coach(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                               @RequestParam(required = false) String symbol,
                               @RequestParam(required = false) Direction direction,
                               @RequestParam(required = false) TradeStatus status,
                               @RequestParam(required = false) String strategy,
                               @RequestParam(required = false) String setup,
                               @RequestParam(required = false) String catalyst,
                               @RequestParam(required = false) String market,
                               @RequestParam(required = false) String dateMode,
                               @RequestParam(required = false, defaultValue = "false") boolean excludeOutliers) {
        OffsetDateTime fromDate = toStartOfDay(from);
        OffsetDateTime toDate = toEndOfDay(to);
        return tradeCoachService.coach(fromDate, toDate, symbol, direction, status, strategy, setup, catalyst, market, dateMode, excludeOutliers);
    }

    private OffsetDateTime toStartOfDay(LocalDate date) {
        if (date == null) {
            return null;
        }
        ZonedDateTime zoned = date.atStartOfDay(DISPLAY_ZONE);
        return zoned.toOffsetDateTime();
    }

    private OffsetDateTime toEndOfDay(LocalDate date) {
        if (date == null) {
            return null;
        }
        ZonedDateTime zoned = date.plusDays(1).atStartOfDay(DISPLAY_ZONE).minusNanos(1);
        return zoned.toOffsetDateTime();
    }
}
