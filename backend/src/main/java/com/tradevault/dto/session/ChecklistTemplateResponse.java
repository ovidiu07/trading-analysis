package com.tradevault.dto.session;

import com.tradevault.domain.enums.ChecklistTemplateType;
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
    ChecklistTemplateType type;
    boolean isDefault;
    List<ChecklistTemplateItemDto> items;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
