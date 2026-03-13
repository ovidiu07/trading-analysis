package com.tradevault.dto.signalintel;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.List;

@Value
@Builder
public class SignalSymbolTimeframeResponse {
    List<Row> rows;

    @Value
    @Builder
    public static class Row {
        String symbol;
        String timeframe;
        int sampleSize;
        BigDecimal winRate;
        BigDecimal expectancyR;
        BigDecimal avgConfidenceScore;
        String recommendedProfileId;
        BigDecimal recommendationScore;
    }
}
