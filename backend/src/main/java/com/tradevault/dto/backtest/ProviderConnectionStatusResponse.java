package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;

@Value
@Builder
public class ProviderConnectionStatusResponse {
    String provider;
    boolean connected;
    String accountId;
    OffsetDateTime lastTestedAt;
}
