package com.tradevault.dto.diagnostics;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.UUID;

@Value
@Builder
public class DiagnosticsStrategyDetailResponse {
    UUID strategyId;
    String strategyName;
    String mode;
    DiagnosticsCoreMetrics coreMetrics;
    List<DiagnosticsBreakdownRow> breakdownBySession;
    List<DiagnosticsBreakdownRow> breakdownBySymbol;
    List<DiagnosticsBreakdownRow> breakdownByDayOfWeek;
    List<DiagnosticsHistogramBucket> rDistribution;
    List<DiagnosticsTriggerImpactRow> triggerImpact;
    List<DiagnosticsFailureModeRow> failureModes;
    List<DiagnosticsSuggestion> suggestions;
    List<DiagnosticsBacktestRunRow> backtestRuns;
}
