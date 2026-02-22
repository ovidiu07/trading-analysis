package com.tradevault.dto.backtest;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
public class BacktestRunRequest {
    @NotBlank
    private String symbol;

    @NotBlank
    private String timeframe;

    private OffsetDateTime from;

    private OffsetDateTime to;

    private String sessionWindow;

    private BigDecimal spread;

    private BigDecimal slippage;

    private String provider;

    private String dataSource;

    private String sourceId;

    private UUID datasetId;

    private boolean refresh;
}
