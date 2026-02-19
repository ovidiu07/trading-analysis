package com.tradevault.service.today;

import com.tradevault.dto.content.ContentPostResponse;
import com.tradevault.dto.plan.DailyPlanResponse;
import com.tradevault.service.ContentPostService;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.TimezoneService;
import com.tradevault.analytics.TradeCoachService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

class TodayServiceMentorPlanTest {

    private ContentPostService contentPostService;
    private TodayService todayService;

    @BeforeEach
    void setup() {
        contentPostService = Mockito.mock(ContentPostService.class);
        TradeCoachService tradeCoachService = Mockito.mock(TradeCoachService.class);
        CurrentUserService currentUserService = Mockito.mock(CurrentUserService.class);
        TimezoneService timezoneService = Mockito.mock(TimezoneService.class);
        todayService = new TodayService(contentPostService, tradeCoachService, currentUserService, timezoneService);
    }

    @Test
    void mentorPlanUsesVisibleWindowBoundariesAndSortsByVisibleFrom() {
        ZoneId zone = ZoneId.of(TimezoneService.DEFAULT_TIMEZONE);
        LocalDate today = LocalDate.now(zone);
        OffsetDateTime dayStart = today.atStartOfDay(zone).toOffsetDateTime();
        OffsetDateTime dayEnd = today.atTime(23, 59).atZone(zone).toOffsetDateTime();

        ContentPostResponse boundaryPlan = plan(
                UUID.randomUUID(),
                "Boundary plan",
                dayStart,
                dayEnd,
                dayStart.plusHours(2)
        );
        ContentPostResponse newerVisiblePlan = plan(
                UUID.randomUUID(),
                "Newest visible plan",
                dayStart.plusHours(4),
                dayEnd,
                dayStart.plusHours(1)
        );
        ContentPostResponse futurePlan = plan(
                UUID.randomUUID(),
                "Future plan",
                dayEnd.plusMinutes(1),
                null,
                dayEnd.plusMinutes(1)
        );

        when(contentPostService.listPublished(eq("DAILY_PLAN"), eq(null), eq(false), eq("en")))
                .thenReturn(List.of(boundaryPlan, futurePlan, newerVisiblePlan));

        DailyPlanResponse response = todayService.getTodayMentorDailyPlan("en");

        assertNotNull(response);
        assertEquals("Newest visible plan", response.getTitle());
    }

    @Test
    void mentorPlanReturnsNullWhenNoVisiblePublishedPlanExists() {
        ZoneId zone = ZoneId.of(TimezoneService.DEFAULT_TIMEZONE);
        LocalDate today = LocalDate.now(zone);
        OffsetDateTime tomorrowStart = today.plusDays(1).atStartOfDay(zone).toOffsetDateTime();

        when(contentPostService.listPublished(eq("DAILY_PLAN"), eq(null), eq(false), eq("en")))
                .thenReturn(List.of(plan(UUID.randomUUID(), "Tomorrow", tomorrowStart, null, tomorrowStart)));

        DailyPlanResponse response = todayService.getTodayMentorDailyPlan("en");

        assertNull(response);
    }

    private ContentPostResponse plan(UUID id,
                                     String title,
                                     OffsetDateTime visibleFrom,
                                     OffsetDateTime visibleUntil,
                                     OffsetDateTime updatedAt) {
        return ContentPostResponse.builder()
                .id(id)
                .title(title)
                .summary("summary")
                .visibleFrom(visibleFrom)
                .visibleUntil(visibleUntil)
                .updatedAt(updatedAt)
                .build();
    }
}
