package com.tradevault.dto.notebook;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class NotebookAttachmentResponse {
    UUID id;
    UUID noteId;
    String fileName;
    String mimeType;
    Long sizeBytes;
    String downloadUrl;
    OffsetDateTime createdAt;
}
