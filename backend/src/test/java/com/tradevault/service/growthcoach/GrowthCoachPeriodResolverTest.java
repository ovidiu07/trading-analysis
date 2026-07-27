package com.tradevault.service.growthcoach;

import com.tradevault.dto.growthcoach.GrowthCoachResponse.PeriodContext;
import org.junit.jupiter.api.Test;

import java.time.*;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GrowthCoachPeriodResolverTest {
    private static final ZoneId BUCHAREST = ZoneId.of("Europe/Bucharest");
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-07-27T09:00:00Z"), ZoneOffset.UTC);

    @Test
    void resolvesDayUsingBucharestBoundariesInsteadOfUtcDates() {
        PeriodContext period = GrowthCoachPeriodResolver.resolve(
                "DAY", LocalDate.parse("2026-07-27"), BUCHAREST, CLOCK);

        assertEquals("2026-07-27", period.periodKey());
        assertEquals(OffsetDateTime.parse("2026-07-27T00:00:00+03:00"), period.startsAt());
        assertEquals(OffsetDateTime.parse("2026-07-28T00:00:00+03:00"), period.endsAtExclusive());
    }

    @Test
    void resolvesWeekFromMondayThroughTheFollowingMonday() {
        PeriodContext period = GrowthCoachPeriodResolver.resolve(
                "WEEK", LocalDate.parse("2026-07-30"), BUCHAREST, CLOCK);

        assertEquals("2026-07-27", period.periodKey());
        assertEquals(DayOfWeek.MONDAY, period.startsAt().atZoneSameInstant(BUCHAREST).getDayOfWeek());
        assertEquals(Duration.ofDays(7), Duration.between(period.startsAt(), period.endsAtExclusive()));
    }

    @Test
    void preservesLocalMidnightAcrossSpringDaylightSavingTransition() {
        PeriodContext period = GrowthCoachPeriodResolver.resolve(
                "DAY", LocalDate.parse("2026-03-29"), BUCHAREST, CLOCK);

        assertEquals(OffsetDateTime.parse("2026-03-29T00:00:00+02:00"), period.startsAt());
        assertEquals(OffsetDateTime.parse("2026-03-30T00:00:00+03:00"), period.endsAtExclusive());
        assertEquals(Duration.ofHours(23), Duration.between(period.startsAt(), period.endsAtExclusive()));
    }

    @Test
    void preservesLocalMidnightAcrossAutumnDaylightSavingTransition() {
        PeriodContext period = GrowthCoachPeriodResolver.resolve(
                "DAY", LocalDate.parse("2026-10-25"), BUCHAREST, CLOCK);

        assertEquals(OffsetDateTime.parse("2026-10-25T00:00:00+03:00"), period.startsAt());
        assertEquals(OffsetDateTime.parse("2026-10-26T00:00:00+02:00"), period.endsAtExclusive());
        assertEquals(Duration.ofHours(25), Duration.between(period.startsAt(), period.endsAtExclusive()));
    }
}
