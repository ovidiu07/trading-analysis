package com.tradevault.dto.calendar;

import com.tradevault.domain.enums.PlanScope;
import lombok.Builder;
import lombok.Value;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class CalendarPlanSummaryResponse {
    UUID id;
    PlanScope scope;
    String title;
    String bias;
    String objectives;
    List<String> focusSymbols;
    LocalDate periodStart;
    LocalDate periodEnd;
    OffsetDateTime activeFrom;
    OffsetDateTime activeTo;
    String status;
    Long setupCount;
    Long imageCount;
    String thumbnailUrl;
    Boolean hasImages;
}
