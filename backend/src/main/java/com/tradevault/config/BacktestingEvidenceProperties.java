package com.tradevault.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.backtesting.evidence")
public class BacktestingEvidenceProperties {
    private int exploratoryMinimum = 5;
    private int earlySignalMinimum = 10;
    private int developingEdgeMinimum = 30;
    private int validatedMinimum = 50;
    private int recentLiveWindow = 10;
    private double materialExpectancyGapR = 0.5;
}
