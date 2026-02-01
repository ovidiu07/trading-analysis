package com.tradevault.dto.trade;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TradeCsvImportGroupResult {
    private String isin;
    private String status;
    private String reason;
}
