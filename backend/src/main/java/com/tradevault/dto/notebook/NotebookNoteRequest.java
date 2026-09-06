package com.tradevault.dto.notebook;

import com.tradevault.domain.enums.NotebookNoteType;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
public class NotebookNoteRequest {
    private java.time.OffsetDateTime expectedUpdatedAt;
    private NotebookNoteType type;
    private UUID folderId;
    private String title;
    private String body;
    private String bodyJson;
    private String reviewJson;
    private Boolean clearReview;
    private LocalDate dateKey;
    private Boolean clearDateKey;
    private UUID relatedTradeId;
    private UUID relatedSessionId;
    private UUID relatedSetupId;
    private UUID relatedPlanId;
    private Boolean clearRelatedTrade;
    private Boolean clearRelatedSession;
    private Boolean clearRelatedSetup;
    private Boolean clearRelatedPlan;
    private Boolean clearFolder;
    @JsonProperty("isPinned")
    private Boolean isPinned;
    private List<UUID> tagIds;
}
