package com.tradevault.dto.plan;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class DailyPlanResponse {
    UUID id;
    String slug;
    String title;
    String summary;
    String biasSummary;
    List<String> keyLevels;
    String primaryModel;
    String executionRules;
    String riskNote;
    String liquidityNarrative;
    String alternativeScenario;
    OffsetDateTime visibleFrom;
    OffsetDateTime visibleUntil;
    OffsetDateTime updatedAt;
}
