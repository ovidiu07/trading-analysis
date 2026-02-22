package com.tradevault.dto.diagnostics;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class DiagnosticsStrategiesResponse {
    List<DiagnosticsStrategyHeadline> strategies;
}
