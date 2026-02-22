package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class CsvIngestResponse {
    BacktestDatasetResponse dataset;
    List<String> warnings;
}
