package com.tradevault.dto.trade;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class TradeCsvImportSummary {
    private String detectedFormat;
    private int totalRows;
    private int parsedRows;
    private int rowsSkipped;
    private int tradeGroups;
    private int isinGroups;
    private int tradesCreated;
    private int tradesUpdated;
    private int groupsSkipped;
    private List<TradeCsvImportGroupResult> groupResults;
}
