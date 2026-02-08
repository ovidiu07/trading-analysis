package com.tradevault.dto.content;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
public class ContentTypeRequest {
    @NotBlank
    private String key;

    @NotNull
    private Boolean active;

    @NotNull
    private Integer sortOrder;

    @NotNull
    @Valid
    private Map<String, @Valid LocalizedContentTypeRequest> translations;
}
