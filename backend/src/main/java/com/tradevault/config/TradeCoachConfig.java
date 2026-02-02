package com.tradevault.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "tradecoach")
@Getter
@Setter
public class TradeCoachConfig {
    private int minTradesForFinding = 10;
    private double breakEvenBand = 1.0;
    private double costDragPct = 0.05;
    private double costDragAvg = 2.0;
    private int overtradingClusterMinutes = 10;
    private double holdingBucketDelta = 30.0;
    private double holdingBucketDeltaR = 0.2;
    private double criticalExpectancy = -50.0;
    private double dataQualityPenaltyRatio = 0.2;
}
