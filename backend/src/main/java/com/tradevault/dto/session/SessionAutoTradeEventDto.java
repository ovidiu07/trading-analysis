package com.tradevault.dto.session;

import com.tradevault.domain.enums.AutoTradeEventType;
import com.tradevault.domain.enums.QuoteSide;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class SessionAutoTradeEventDto {
    UUID id;
    UUID sessionId;
    UUID tradeId;
    AutoTradeEventType type;
    QuoteSide side;
    BigDecimal price;
    String note;
    OffsetDateTime tsUtc;
}
