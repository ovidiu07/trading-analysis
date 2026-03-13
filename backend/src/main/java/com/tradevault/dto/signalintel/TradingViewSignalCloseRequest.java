package com.tradevault.dto.signalintel;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class TradingViewSignalCloseRequest {
    @NotBlank
    private String schemaVersion;

    @NotBlank
    private String eventType;

    @NotBlank
    private String externalTradeId;

    @NotBlank
    private String symbol;

    @NotBlank
    private String timeframe;

    @NotNull
    private Long timestamp;

    @NotBlank
    private String result;

    private BigDecimal pnlR;

    private BigDecimal pnlAmount;

    private String exitReason;

    private BigDecimal slippage;

    @Min(0)
    private Integer holdBars;

    @Min(0)
    private Integer holdMinutes;

    private String authToken;
}
