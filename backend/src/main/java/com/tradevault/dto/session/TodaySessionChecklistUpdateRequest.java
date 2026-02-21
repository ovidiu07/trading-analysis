package com.tradevault.dto.session;

import com.tradevault.domain.enums.ChecklistTemplateType;
import lombok.Data;

import java.util.UUID;
import java.util.List;

@Data
public class TodaySessionChecklistUpdateRequest {
    private ChecklistTemplateType type;
    private UUID templateId;
    private List<SessionChecklistItemDto> items;
    private UUID activeSweepLevelId;
}
