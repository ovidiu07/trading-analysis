package com.tradevault.dto.diagnostics;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class DiagnosticsReportsResponse {
    List<DiagnosticsReportRow> reports;
}
