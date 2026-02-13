package com.tradevault.dto.checklist;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDate;
import java.util.List;

@Value
@Builder
public class TodayChecklistResponse {
    LocalDate date;
    List<TodayChecklistItemResponse> items;
}
