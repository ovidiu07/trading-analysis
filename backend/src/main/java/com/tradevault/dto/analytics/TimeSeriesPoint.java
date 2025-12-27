package com.tradevault.dto.analytics;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@AllArgsConstructor
public class TimeSeriesPoint {
    private LocalDate date;
    private BigDecimal value;
}
