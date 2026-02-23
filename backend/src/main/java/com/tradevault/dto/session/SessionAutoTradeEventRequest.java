package com.tradevault.dto.session;

import com.tradevault.domain.enums.AutoTradeEventType;
import com.tradevault.domain.enums.QuoteSide;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class SessionAutoTradeEventRequest {
    private AutoTradeEventType type;
    private QuoteSide side;
    private BigDecimal price;
    private UUID tradeId;
    private String note;
}
