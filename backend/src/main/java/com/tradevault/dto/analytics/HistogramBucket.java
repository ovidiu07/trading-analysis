package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class HistogramBucket {
    private String label;
    private BigDecimal min;
    private BigDecimal max;
    private int count;
}
