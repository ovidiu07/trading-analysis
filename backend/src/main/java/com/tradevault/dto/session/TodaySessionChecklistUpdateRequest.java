package com.tradevault.dto.session;

import lombok.Data;

import java.util.UUID;
import java.util.List;

@Data
public class TodaySessionChecklistUpdateRequest {
    private UUID templateId;
    private List<SessionChecklistItemDto> items;
}
