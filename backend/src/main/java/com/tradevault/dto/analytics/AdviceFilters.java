package com.tradevault.dto.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdviceFilters {
    private String symbol;
    private String market;
    private String direction;
    private String status;
    private String strategyTag;
    private String setup;
    private String catalystTag;
    private String dateMode;
    private String hourBucket;
    private String holdingBucket;
}
