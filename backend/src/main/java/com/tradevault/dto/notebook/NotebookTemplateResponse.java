package com.tradevault.dto.notebook;

import com.tradevault.domain.enums.NotebookNoteType;
import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class NotebookTemplateResponse {
    UUID id;
    String name;
    NotebookNoteType appliesToType;
    String content;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
