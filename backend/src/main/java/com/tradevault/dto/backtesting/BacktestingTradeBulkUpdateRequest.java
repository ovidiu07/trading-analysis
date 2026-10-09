package com.tradevault.dto.backtesting;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Data
public class BacktestingTradeBulkUpdateRequest {
    @NotEmpty @Size(max = 500)
    private List<@NotNull UUID> tradeIds;
    private Set<String> fields = Set.of();
    @Valid @NotNull
    private Changes changes = new Changes();
    private boolean deriveRFromPlannedRR;
    private boolean recalculateSession;

    @Data
    public static class Changes {
        @DecimalMin(value = "0", inclusive = false) @Digits(integer = 6, fraction = 4)
        private BigDecimal plannedRR;
        @DecimalMin("0") @DecimalMax("100") @Digits(integer = 6, fraction = 4)
        private BigDecimal riskPercent;
        @Digits(integer = 8, fraction = 4)
        private BigDecimal pnlR;
        @Size(max = 180) private String setupName;
        private UUID strategyId;
        @Size(max = 16) private String strategySource;
        @Size(max = 255) private String strategyNameSnapshot;
        @Size(max = 40) private String contextTimeframe;
        @Size(max = 40) private String executionTimeframe;
        @Size(max = 40) private String entryTimeframe;
        @Size(max = 50) private List<@Size(max = 100) String> tags;
        @Size(max = 20000) private String notes;
        @Size(max = 64) private String sourceTimezone;
    }
}
