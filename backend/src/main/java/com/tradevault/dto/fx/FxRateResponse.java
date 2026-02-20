package com.tradevault.dto.fx;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Value
@Builder
public class FxRateResponse {
    String baseCurrency;
    String quoteCurrency;
    BigDecimal rate;
    OffsetDateTime timestamp;
    String source;
}
