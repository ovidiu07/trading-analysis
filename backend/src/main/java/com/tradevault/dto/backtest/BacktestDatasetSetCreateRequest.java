package com.tradevault.dto.backtest;

import lombok.Data;

@Data
public class BacktestDatasetSetCreateRequest {
    private String instrument;
    private String timezoneBasis;
}
