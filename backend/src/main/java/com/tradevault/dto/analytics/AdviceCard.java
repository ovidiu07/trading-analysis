package com.tradevault.dto.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdviceCard {
    private String id;
    private AdviceSeverity severity;
    private AdviceConfidence confidence;
    private String title;
    private List<String> message;
    private List<AdviceEvidence> evidence;
    private List<String> recommendedActions;
    private AdviceFilters filters;
}
