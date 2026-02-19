package com.tradevault.dto.checklist;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class TodayChecklistUpdateRequest {
    @NotNull
    private LocalDate date;

    @NotNull
    @Size(max = 30)
    private List<@Valid TodayChecklistUpdateEntryRequest> updates;
}
