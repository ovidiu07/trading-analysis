package com.tradevault.dto.session;

import com.tradevault.domain.enums.Direction;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class SessionAutoJournalArmRequest {
    private UUID tradeDraftId;
    private String symbol;
    private Direction side;
    private BigDecimal entry;
    private BigDecimal sl;
    private BigDecimal tp;
    private BigDecimal tolerancePips;
    private Integer timeoutMin;
}
