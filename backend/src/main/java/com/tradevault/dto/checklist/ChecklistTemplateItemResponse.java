package com.tradevault.dto.checklist;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class ChecklistTemplateItemResponse {
    UUID id;
    String text;
    int sortOrder;
    boolean enabled;
}
