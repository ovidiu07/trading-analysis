package com.tradevault.dto.plan;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.OffsetDateTime;

@Data
public class MyPlanRequest {
    @NotBlank
    private String title;

    @NotBlank
    private String content;

    private String checklistJson;

    @NotNull
    private OffsetDateTime activeFrom;

    private OffsetDateTime activeTo;
}
