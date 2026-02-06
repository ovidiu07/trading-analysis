package com.tradevault.dto.content;

import com.tradevault.domain.enums.ContentPostType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

@Data
public class ContentPostRequest {
    @NotNull
    private ContentPostType type;
    @NotBlank
    private String title;
    private String slug;
    private String summary;
    @NotBlank
    private String body;
    private List<String> tags;
    private List<String> symbols;
    private OffsetDateTime visibleFrom;
    private OffsetDateTime visibleUntil;
    private LocalDate weekStart;
    private LocalDate weekEnd;
}
