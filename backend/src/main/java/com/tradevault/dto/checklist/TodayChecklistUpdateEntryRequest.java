package com.tradevault.dto.checklist;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class TodayChecklistUpdateEntryRequest {
    @NotNull
    private UUID checklistItemId;

    @NotNull
    private Boolean completed;
}
