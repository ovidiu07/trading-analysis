package com.tradevault.dto.diagnostics;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DiagnosticsSuggestion {
    String title;
    String description;
}
