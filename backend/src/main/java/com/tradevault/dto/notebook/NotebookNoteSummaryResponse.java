package com.tradevault.dto.notebook;

import com.tradevault.domain.enums.NotebookNoteType;
import lombok.Builder;
import lombok.Value;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class NotebookNoteSummaryResponse {
    UUID id;
    String title;
    NotebookNoteType type;
    LocalDate journalDate;
    OffsetDateTime createdAt;
}
