package com.tradevault.dto.trade;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TradeCsvImportGroupResult {
    private String key;
    private String isin;
    private String symbol;
    private String accountId;
    private Integer rowCount;
    private String status;
    private String reason;
}
