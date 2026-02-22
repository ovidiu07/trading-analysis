package com.tradevault.dto.diagnostics;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class DiagnosticsTriggerImpactRow {
    String triggerKey;
    BigDecimal checkedExpectancy;
    BigDecimal uncheckedExpectancy;
    BigDecimal deltaExpectancy;
    int checkedCount;
    int uncheckedCount;
}
