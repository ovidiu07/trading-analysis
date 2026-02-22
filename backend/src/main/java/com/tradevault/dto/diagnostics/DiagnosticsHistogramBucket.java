package com.tradevault.dto.diagnostics;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DiagnosticsHistogramBucket {
    String bucket;
    int count;
}
