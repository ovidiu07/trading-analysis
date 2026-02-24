package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.UUID;

@Value
@Builder
public class BacktestDatasetSetDatasetsResponse {
    UUID datasetSetId;
    String instrument;
    String timezoneBasis;
    List<BacktestDatasetFileResponse> datasets;
    List<BacktestSessionPreviewResponse> sessionPreview;
}
