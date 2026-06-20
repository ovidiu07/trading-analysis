package com.tradevault.dto.backtesting;

import com.tradevault.domain.enums.BacktestingTradeDirection;
import com.tradevault.domain.enums.BacktestingTradeResult;
import com.tradevault.domain.enums.BacktestingTradeScope;
import com.tradevault.domain.enums.BacktestingTradeSource;
import com.tradevault.domain.enums.BacktestingGapFillStatus;
import com.tradevault.domain.enums.BacktestingGapLiquidityRelation;
import com.tradevault.domain.enums.BacktestingGapType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@Data
public class BacktestingTradeRequest {
    @NotNull
    private LocalDate date;
    @NotNull
    private LocalTime entryTime;
    @NotBlank
    private String instrument;
    @NotNull
    private BacktestingTradeDirection direction;
    private String session;
    private String setupName;
    private UUID strategyId;
    private String strategySource;
    private String strategyNameSnapshot;
    private boolean gapPresent;
    private BacktestingGapType gapType;
    private String gapTimeframe;
    private LocalTime gapCreatedAt;
    private LocalTime gapMitigatedAt;
    private BigDecimal gapHigh;
    private BigDecimal gapLow;
    private BigDecimal gapMidpoint;
    private BigDecimal gapSizePoints;
    @DecimalMin("0")
    private BigDecimal gapSizePercent;
    @DecimalMin("0") @DecimalMax("100")
    private BigDecimal gapEntryPositionPercent;
    private BacktestingGapFillStatus gapFillStatus;
    private BacktestingGapLiquidityRelation gapRelationToLiquidity;
    private String gapConfluenceNotes;
    private BigDecimal riskPercent;
    private BigDecimal plannedRR;
    @NotNull
    private BacktestingTradeResult result;
    @NotNull
    private BigDecimal pnlR;
    private String contextTimeframe;
    private String executionTimeframe;
    private String entryTimeframe;
    private List<String> tags;
    private String notes;
    private BacktestingTradeSource source;
    private BacktestingTradeScope tradeScope;
}
