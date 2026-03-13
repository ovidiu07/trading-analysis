package com.tradevault.dto.signalintel;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.List;

@Value
@Builder
public class SignalBreakdownResponse {
    List<Row> rows;

    @Value
    @Builder
    public static class Row {
        String key;
        int sampleSize;
        BigDecimal winRate;
        BigDecimal expectancyR;
        BigDecimal avgPnlR;
        BigDecimal avgConfidenceScore;
        boolean reducedConfidenceSuggested;
    }
}
