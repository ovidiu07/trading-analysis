package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class TimeEdgeSummary {
    private Long averageHoldingSeconds;
    private Long medianHoldingSeconds;
    private List<BucketStats> holdingBuckets;
    private List<BucketStats> dayOfWeek;
    private List<BucketStats> hourOfDay;
}
