package com.tradevault.dto.backtesting;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class BacktestingResearchInboxResponse {
    Integer total;
    Integer needsWorkspace;
    Integer needsClassification;
    Integer ambiguousMatch;
    Integer syncErrors;
    Integer excluded;
    List<BacktestingEvidenceResponse> items;
}
