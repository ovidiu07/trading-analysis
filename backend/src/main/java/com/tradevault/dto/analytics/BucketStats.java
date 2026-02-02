package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class BucketStats {
    private String bucket;
    private int trades;
    private BigDecimal netPnl;
    private double winRate;
}
