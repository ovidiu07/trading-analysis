package com.tradevault.dto.content;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LocalizedContentTypeRequest {
    @NotBlank
    private String displayName;

    private String description;
}
