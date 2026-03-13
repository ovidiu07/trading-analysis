package com.tradevault.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
@ConfigurationProperties(prefix = "signalintel")
@Getter
@Setter
public class SignalIntelProperties {
    private String webhookBaseUrl = "http://localhost:8080";
    private int recommendationMinSamples = 12;
    private int recommendationFreshnessHours = 6;
    private BigDecimal weakExpectancyThreshold = BigDecimal.valueOf(-0.10d);
}
