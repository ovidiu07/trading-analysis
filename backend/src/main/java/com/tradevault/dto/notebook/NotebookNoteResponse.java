package com.tradevault.dto.notebook;

import com.tradevault.domain.enums.NotebookNoteType;
import lombok.Builder;
import lombok.Value;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class NotebookNoteResponse {
    UUID id;
    NotebookNoteType type;
    UUID folderId;
    String title;
    String body;
    String bodyJson;
    LocalDate dateKey;
    UUID relatedTradeId;
    boolean isDeleted;
    OffsetDateTime deletedAt;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
    List<UUID> tagIds;
}
