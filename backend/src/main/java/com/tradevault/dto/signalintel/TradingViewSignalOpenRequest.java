package com.tradevault.dto.signalintel;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.SignalHtfBias;
import com.tradevault.domain.enums.SignalRegime;
import com.tradevault.domain.enums.SignalSetupType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class TradingViewSignalOpenRequest {
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

    private Long barTime;

    @NotNull
    private SignalSetupType setupType;

    @NotNull
    private Direction direction;

    @NotNull
    @DecimalMin(value = "0.00000001", inclusive = true)
    private BigDecimal entry;

    @NotNull
    @DecimalMin(value = "0.00000001", inclusive = true)
    private BigDecimal stopLoss;

    @DecimalMin(value = "0.00000001", inclusive = true)
    private BigDecimal takeProfit;

    @DecimalMin(value = "0.0", inclusive = true)
    private BigDecimal rr;

    @NotNull
    @Min(0)
    @Max(100)
    private Integer confidenceScore;

    @NotNull
    private SignalRegime regime;

    @NotNull
    private SignalHtfBias htfBias;

    private String session;

    @NotBlank
    private String parameterProfileId;

    @Valid
    @NotNull
    private FeaturePayload features;

    private String authToken;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class FeaturePayload {
        private BigDecimal atr;
        private BigDecimal atrMean;
        private BigDecimal adx;
        private BigDecimal emaSlope;
        private BigDecimal bodyPct;
        private BigDecimal sweepDepthAtr;
        private BigDecimal fvgSizeAtr;
        private BigDecimal obSizeAtr;
        private String volatilityState;
        private String rangeState;
    }
}
