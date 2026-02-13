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
    String url;
    String downloadUrl;
    String viewUrl;
    String thumbnailUrl;
    boolean image;
    OffsetDateTime createdAt;
}
