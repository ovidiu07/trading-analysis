package com.tradevault.dto.checklist;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class ChecklistTemplateUpdateRequest {
    @NotNull
    @Size(max = 30)
    private List<@Valid ChecklistTemplateItemUpdateRequest> items;
}
