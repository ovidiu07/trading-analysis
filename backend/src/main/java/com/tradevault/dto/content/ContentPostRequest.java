package com.tradevault.dto.content;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
public class ContentPostRequest {
    @NotNull
    private UUID contentTypeId;

    private String slug;
    private List<String> tags;
    private List<String> symbols;
    private OffsetDateTime visibleFrom;
    private OffsetDateTime visibleUntil;
    private LocalDate weekStart;
    private LocalDate weekEnd;
    private Map<String, Object> templateFields;
    private String revisionNotes;
    private Boolean notifySubscribersAboutUpdate;

    @NotNull
    @Valid
    private Map<String, @Valid LocalizedContentRequest> translations;
}
