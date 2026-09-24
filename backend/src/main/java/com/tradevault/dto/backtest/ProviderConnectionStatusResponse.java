package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.List;

@Value
@Builder
public class ProviderConnectionStatusResponse {
    String provider;
    boolean connected;
    String accountId;
    OffsetDateTime lastTestedAt;
    String environment;
    List<String> supportedInstruments;
}
