package com.tradevault.dto.backtest;

import lombok.Data;

@Data
public class CsvIngestRequest {
    private CsvColumnMappingRequest mapping;

    private String symbol;

    private String timeframe;

    private String timezone;

    private String datasetName;
}
