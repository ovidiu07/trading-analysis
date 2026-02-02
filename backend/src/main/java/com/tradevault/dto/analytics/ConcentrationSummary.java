package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ConcentrationSummary {
    private Double top1PnlShare;
    private Double top3PnlShare;
    private Double top1TradeShare;
    private Double top3TradeShare;
}
