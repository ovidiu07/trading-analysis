package com.tradevault.dto.notebook;

import com.tradevault.domain.enums.NotebookNoteType;
import com.fasterxml.jackson.annotation.JsonProperty;
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
    String reviewJson;
    LocalDate dateKey;
    UUID relatedTradeId;
    @JsonProperty("hasAttachments")
    boolean hasAttachments;
    @JsonProperty("isDeleted")
    boolean isDeleted;
    OffsetDateTime deletedAt;
    @JsonProperty("isPinned")
    boolean isPinned;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
    List<UUID> tagIds;
}
