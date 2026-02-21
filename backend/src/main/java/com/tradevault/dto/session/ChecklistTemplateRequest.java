package com.tradevault.dto.session;

import com.tradevault.domain.enums.ChecklistTemplateType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class ChecklistTemplateRequest {
    @NotBlank
    private String name;

    @NotNull
    private ChecklistTemplateType type;

    private boolean isDefault;

    private List<ChecklistTemplateItemDto> items;
}
