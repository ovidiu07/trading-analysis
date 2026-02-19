package com.tradevault.dto.session;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class ChecklistTemplateRequest {
    @NotBlank
    private String name;

    private List<String> items;
}
