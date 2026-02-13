package com.tradevault.dto.checklist;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class TodayChecklistItemResponse {
    UUID id;
    String text;
    boolean completed;
}
