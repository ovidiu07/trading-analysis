package com.tradevault.service.today;

import com.tradevault.dto.content.ContentPostResponse;
import com.tradevault.dto.plan.DailyPlanResponse;
import com.tradevault.dto.asset.AssetResponse;
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
import static org.junit.jupiter.api.Assertions.assertFalse;
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

    @Test
    void listDailyPlansPrioritizesVisibleNowAndIgnoresFutureOnlyItems() {
        ZoneId zone = ZoneId.of(TimezoneService.DEFAULT_TIMEZONE);
        OffsetDateTime now = OffsetDateTime.now(zone);

        ContentPostResponse visibleNow = plan(
                UUID.randomUUID(),
                "Visible now",
                now.minusHours(2),
                now.plusHours(6),
                now.minusMinutes(5)
        );

        ContentPostResponse recentExpired = plan(
                UUID.randomUUID(),
                "Recent expired",
                now.minusDays(1),
                now.minusHours(2),
                now.minusMinutes(10)
        );

        ContentPostResponse futureOnly = plan(
                UUID.randomUUID(),
                "Future plan",
                now.plusHours(1),
                now.plusHours(8),
                now
        );

        when(contentPostService.listPublished(eq("DAILY_PLAN"), eq(null), eq(false), eq("en")))
                .thenReturn(List.of(futureOnly, recentExpired, visibleNow));

        List<DailyPlanResponse> response = todayService.listDailyPlans("en", 7);

        assertEquals(2, response.size());
        assertEquals("Visible now", response.get(0).getTitle());
        assertEquals("Recent expired", response.get(1).getTitle());
        assertFalse(response.stream().anyMatch(plan -> "Future plan".equals(plan.getTitle())));
    }

    @Test
    void mentorPlanIncludesSnapshotAssetWhenConfigured() {
        ZoneId zone = ZoneId.of(TimezoneService.DEFAULT_TIMEZONE);
        OffsetDateTime now = OffsetDateTime.now(zone);
        UUID snapshotId = UUID.randomUUID();
        AssetResponse snapshot = AssetResponse.builder()
                .id(snapshotId)
                .originalFileName("snapshot.png")
                .url("/api/assets/%s/view".formatted(snapshotId))
                .viewUrl("/api/assets/%s/view".formatted(snapshotId))
                .image(true)
                .build();

        ContentPostResponse withSnapshot = ContentPostResponse.builder()
                .id(UUID.randomUUID())
                .title("Snapshot plan")
                .summary("summary")
                .visibleFrom(now.minusHours(1))
                .visibleUntil(now.plusHours(1))
                .updatedAt(now)
                .snapshotAssetId(snapshotId)
                .snapshotCaption("Bias context")
                .assets(List.of(snapshot))
                .build();

        when(contentPostService.listPublished(eq("DAILY_PLAN"), eq(null), eq(false), eq("en")))
                .thenReturn(List.of(withSnapshot));

        DailyPlanResponse response = todayService.getTodayMentorDailyPlan("en");

        assertNotNull(response);
        assertEquals(snapshotId, response.getSnapshotAssetId());
        assertEquals("Bias context", response.getSnapshotCaption());
        assertNotNull(response.getSnapshotAsset());
        assertEquals(snapshotId, response.getSnapshotAsset().getId());
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
