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
    private List<java.util.UUID> tradeIds;
    private List<java.util.UUID> accountIds;
    private String ruleVersion;
    private String currency;
    private String dateBasis;
    private String timezone;
    private java.time.OffsetDateTime from;
    private java.time.OffsetDateTime to;
    private java.time.OffsetDateTime generatedAt;
    private int eligibleCount;
    private int missingCount;
}
