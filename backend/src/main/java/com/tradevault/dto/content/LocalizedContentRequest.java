package com.tradevault.dto.content;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LocalizedContentRequest {
    @NotBlank
    private String title;

    private String summary;

    @NotBlank
    private String body;
}
