package com.tradevault.dto.notebook;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class NotebookFolderResponse {
    UUID id;
    String name;
    UUID parentId;
    Integer sortOrder;
    String systemKey;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
