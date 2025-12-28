package com.tradevault.dto.trade;

import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

@Data
public class TradeRequest {
    @NotBlank
    private String symbol;
    @NotNull
    private Market market;
    @NotNull
    private Direction direction;
    @NotNull
    private TradeStatus status;
    @NotNull
    private OffsetDateTime openedAt;
    private OffsetDateTime closedAt;
    @NotNull
    private BigDecimal quantity;
    @NotNull
    private BigDecimal entryPrice;
    private BigDecimal exitPrice;
    private BigDecimal stopLossPrice;
    private BigDecimal takeProfitPrice;
    private BigDecimal fees = BigDecimal.ZERO;
    private BigDecimal commission = BigDecimal.ZERO;
    private BigDecimal slippage = BigDecimal.ZERO;
    private BigDecimal pnlGross;
    private BigDecimal pnlNet;
    private BigDecimal pnlPercent;
    private BigDecimal riskAmount;
    private BigDecimal riskPercent;
    private BigDecimal rMultiple;
    private BigDecimal capitalUsed;
    private String timeframe;
    private String setup;
    private String strategyTag;
    private String catalystTag;
    private String notes;
    private UUID accountId;
    private Set<UUID> tagIds;
}
