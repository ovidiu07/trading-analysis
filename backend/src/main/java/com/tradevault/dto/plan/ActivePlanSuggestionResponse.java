package com.tradevault.dto.plan;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.UUID;

@Value
@Builder
public class ActivePlanSuggestionResponse {
    List<PlanSummaryResponse> plans;
    List<UUID> suggestedPlanIds;
}
