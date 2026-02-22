package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class CsvUploadResponse {
    UUID fileId;
    String fileName;
    List<String> headers;
    boolean mappingRequired;
    CsvColumnMappingRequest suggestedMapping;
    String detectedSymbol;
    String detectedTimeframe;
    String detectedTimeFormat;
    OffsetDateTime dataFrom;
    OffsetDateTime dataTo;
    List<String> warnings;
}
