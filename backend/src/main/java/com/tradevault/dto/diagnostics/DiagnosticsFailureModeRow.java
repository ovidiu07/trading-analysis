package com.tradevault.dto.diagnostics;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class DiagnosticsFailureModeRow {
    String label;
    int count;
    BigDecimal avgR;
}
