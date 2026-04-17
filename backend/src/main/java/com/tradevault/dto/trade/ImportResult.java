package com.tradevault.dto.trade;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ImportResult {
    private String detectedFormat;
    private int totalRows;
    private int tradeGroups;
    private int imported;
    private int updated;
    private int failed;
    private List<TradeCsvImportGroupResult> groupResults;
}
