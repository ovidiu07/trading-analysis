package com.tradevault.dto.trade;

import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeStatus;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

@Data
@Builder
public class TradeResponse {
    private UUID id;
    private String symbol;
    private Market market;
    private Direction direction;
    private TradeStatus status;
    private OffsetDateTime openedAt;
    private OffsetDateTime closedAt;
    private BigDecimal quantity;
    private BigDecimal entryPrice;
    private BigDecimal exitPrice;
    private BigDecimal pnlNet;
    private BigDecimal pnlGross;
    private BigDecimal pnlPercent;
    private BigDecimal rMultiple;
    private String timeframe;
    private String strategyTag;
    private String catalystTag;
    private String notes;
    private Set<String> tags;
}
