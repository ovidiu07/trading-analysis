package com.tradevault.dto.diagnostics;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.List;

@Value
@Builder
public class LiveDiagnosticsSummaryResponse {
    DiagnosticsCoreMetrics coreMetrics;
    List<DiagnosticsBreakdownRow> breakdownBySession;
    List<DiagnosticsBreakdownRow> breakdownBySymbol;
    List<DiagnosticsBreakdownRow> breakdownByDayOfWeek;
    List<DiagnosticsStrategyHeadline> strategyPerformance;
    List<DiagnosticsFailureModeRow> failureModes;
    List<DiagnosticsSuggestion> suggestions;
    OffsetDateTime generatedAt;
}
