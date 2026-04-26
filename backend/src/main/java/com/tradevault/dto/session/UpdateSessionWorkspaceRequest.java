package com.tradevault.dto.session;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpdateSessionWorkspaceRequest {
    private String sessionName;
    private String objective;
    private String bias;
    private String biasReason;
    private String narrative;
    private BigDecimal dailyMaxLoss;
    private BigDecimal profitTarget;
    private BigDecimal riskPerTrade;
    private Integer maxTrades;
    private Integer maxConsecutiveLosses;
    private Boolean stopAfterTargetReached;
    private Boolean stopAfterMaxLossReached;
    private Boolean lockSession;
}
