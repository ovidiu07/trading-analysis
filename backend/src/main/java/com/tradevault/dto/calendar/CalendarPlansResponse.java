package com.tradevault.dto.calendar;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class CalendarPlansResponse {
    CalendarPlanSummaryResponse activeMonthlyPlan;
    CalendarPlanSummaryResponse activeWeeklyPlan;
    List<CalendarPlanSummaryResponse> dailyPlans;
}
