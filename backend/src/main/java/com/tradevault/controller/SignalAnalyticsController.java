package com.tradevault.controller;

import com.tradevault.dto.signalintel.SignalAnalyticsSummaryResponse;
import com.tradevault.dto.signalintel.SignalBreakdownResponse;
import com.tradevault.dto.signalintel.SignalRecommendationListResponse;
import com.tradevault.dto.signalintel.SignalSymbolTimeframeResponse;
import com.tradevault.service.signalintel.SignalAnalyticsService;
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
@RequestMapping("/api/analytics/signals")
@RequiredArgsConstructor
public class SignalAnalyticsController {
    private static final ZoneId DISPLAY_ZONE = ZoneId.of("Europe/Bucharest");

    private final SignalAnalyticsService signalAnalyticsService;

    @GetMapping("/summary")
    public SignalAnalyticsSummaryResponse summary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String timeframe
    ) {
        return signalAnalyticsService.summary(toStartOfDay(from), toEndOfDay(to), symbol, timeframe);
    }

    @GetMapping("/recommendations")
    public SignalRecommendationListResponse recommendations(@RequestParam(required = false) String symbol,
                                                            @RequestParam(required = false) String timeframe,
                                                            @RequestParam(required = false) String regime) {
        return signalAnalyticsService.recommendations(symbol, timeframe, regime);
    }

    @GetMapping("/by-setup")
    public SignalBreakdownResponse bySetup(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String timeframe
    ) {
        return signalAnalyticsService.bySetup(toStartOfDay(from), toEndOfDay(to), symbol, timeframe);
    }

    @GetMapping("/by-regime")
    public SignalBreakdownResponse byRegime(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String timeframe
    ) {
        return signalAnalyticsService.byRegime(toStartOfDay(from), toEndOfDay(to), symbol, timeframe);
    }

    @GetMapping("/by-symbol-timeframe")
    public SignalSymbolTimeframeResponse bySymbolTimeframe(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return signalAnalyticsService.bySymbolTimeframe(toStartOfDay(from), toEndOfDay(to));
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
