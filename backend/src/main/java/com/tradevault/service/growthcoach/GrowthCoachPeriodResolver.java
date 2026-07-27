package com.tradevault.service.growthcoach;

import com.tradevault.dto.growthcoach.GrowthCoachResponse.PeriodContext;

import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.Locale;

public final class GrowthCoachPeriodResolver {
    private GrowthCoachPeriodResolver() {
    }

    public static PeriodContext resolve(String requestedType, LocalDate requestedDate, ZoneId zone, Clock clock) {
        String type = requestedType == null ? "MONTH" : requestedType.trim().toUpperCase(Locale.ROOT);
        if (!type.equals("DAY") && !type.equals("WEEK") && !type.equals("MONTH")) {
            throw new IllegalArgumentException("Period must be DAY, WEEK, or MONTH");
        }
        LocalDate anchor = requestedDate == null ? LocalDate.now(clock.withZone(zone)) : requestedDate;
        LocalDate startDate;
        LocalDate endDate;
        String key;
        if (type.equals("DAY")) {
            startDate = anchor;
            endDate = anchor.plusDays(1);
            key = anchor.toString();
        } else if (type.equals("WEEK")) {
            startDate = anchor.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            endDate = startDate.plusWeeks(1);
            key = startDate.toString();
        } else {
            YearMonth month = YearMonth.from(anchor);
            startDate = month.atDay(1);
            endDate = month.plusMonths(1).atDay(1);
            key = month.toString();
        }
        return new PeriodContext(
                type,
                key,
                anchor,
                startDate.atStartOfDay(zone).toOffsetDateTime(),
                endDate.atStartOfDay(zone).toOffsetDateTime(),
                zone.getId()
        );
    }
}

