package com.tradevault.dto.session;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Value
@Builder
public class LiveQuoteResponse {
    String symbol;
    BigDecimal bid;
    BigDecimal ask;
    BigDecimal mid;
    BigDecimal spread;
    OffsetDateTime tsUtc;
    boolean available;
    String reason;
}
