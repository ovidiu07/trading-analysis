package com.tradevault.dto.backtesting;

import com.tradevault.domain.enums.BacktestingClassificationStatus;
import lombok.Data;

import java.util.Map;
import java.util.UUID;

@Data
public class BacktestingEvidenceUpdateRequest {
    private UUID workspaceId;
    private BacktestingClassificationStatus classificationStatus;
    private Boolean includedInAnalytics;
    private String excludedReason;
    private Map<String, Object> researchClassification;
}
