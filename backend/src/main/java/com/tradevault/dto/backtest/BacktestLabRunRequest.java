package com.tradevault.dto.backtest;

import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
public class BacktestLabRunRequest {
    private UUID strategyConfigId;
    private OffsetDateTime fromUtc;
    private OffsetDateTime toUtc;
    private String sessionFilter;
    private Boolean autoGenerateReport;
}
