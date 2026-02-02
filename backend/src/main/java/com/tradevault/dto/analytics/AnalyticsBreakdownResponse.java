package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class AnalyticsBreakdownResponse {
    private List<BreakdownRow> rows;
}
