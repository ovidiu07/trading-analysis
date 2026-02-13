package com.tradevault.dto.checklist;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class ChecklistTemplateItemUpdateRequest {
    private UUID id;

    @NotBlank
    @Size(max = 160)
    private String text;

    private Integer sortOrder;
    private Boolean enabled;
}
