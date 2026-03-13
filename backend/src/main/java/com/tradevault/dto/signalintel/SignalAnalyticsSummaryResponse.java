package com.tradevault.dto.signalintel;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.List;

@Value
@Builder
public class SignalAnalyticsSummaryResponse {
    Overview overview;
    List<RecentWindow> recentWindows;
    List<TrendPoint> confidenceTrend;
    List<WeakCondition> weakConditions;
    SignalRecommendationResponse topRecommendation;

    @Value
    @Builder
    public static class Overview {
        int totalSignals;
        int closedSignals;
        int openSignals;
        BigDecimal winRate;
        BigDecimal expectancyR;
        BigDecimal avgPnlR;
        BigDecimal avgConfidenceScore;
        BigDecimal avgHoldBars;
        BigDecimal avgHoldMinutes;
    }

    @Value
    @Builder
    public static class RecentWindow {
        int windowSize;
        int sampleSize;
        BigDecimal winRate;
        BigDecimal expectancyR;
        BigDecimal avgConfidenceScore;
    }

    @Value
    @Builder
    public static class TrendPoint {
        String label;
        BigDecimal avgConfidenceScore;
        BigDecimal expectancyR;
        int sampleSize;
    }

    @Value
    @Builder
    public static class WeakCondition {
        String symbol;
        String timeframe;
        String setupType;
        String regime;
        String direction;
        int sampleSize;
        BigDecimal winRate;
        BigDecimal expectancyR;
        String action;
    }
}
