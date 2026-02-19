package com.tradevault.dto.session;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class ChecklistTemplateResponse {
    UUID id;
    String name;
    List<String> items;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
