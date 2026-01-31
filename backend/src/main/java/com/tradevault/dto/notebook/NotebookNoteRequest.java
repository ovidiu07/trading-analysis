package com.tradevault.dto.notebook;

import com.tradevault.domain.enums.NotebookNoteType;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
public class NotebookNoteRequest {
    private NotebookNoteType type;
    private UUID folderId;
    private String title;
    private String body;
    private String bodyJson;
    private LocalDate dateKey;
    private UUID relatedTradeId;
    private List<UUID> tagIds;
}
