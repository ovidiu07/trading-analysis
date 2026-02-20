package com.tradevault.dto.session;

import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeGrade;
import com.tradevault.domain.enums.TradeSession;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class StartSessionTradeRequest {
    @NotBlank
    private String symbol;

    private Market market;

    @NotNull
    private Direction direction;

    @NotNull
    @DecimalMin("0.0001")
    private BigDecimal quantity;

    @NotNull
    @DecimalMin("0.0000001")
    private BigDecimal entryPrice;

    @DecimalMin("0.0000001")
    private BigDecimal takeProfitPrice;

    @DecimalMin("0.0000001")
    private BigDecimal stopLossPrice;

    private String tradeCurrency;

    @DecimalMin("0.0000001")
    private BigDecimal fxRateTradeToProfile;

    private String fxRateSource;

    @NotNull
    private TradeSession session;

    private String feeling;

    @NotNull
    private TradeGrade setupGrade;

    private UUID strategyId;

    private String strategyTag;

    private UUID linkedPlanId;

    private String initialNotes;

    private String notes;
}
