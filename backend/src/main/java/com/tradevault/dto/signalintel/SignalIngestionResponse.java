package com.tradevault.dto.signalintel;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class SignalIngestionResponse {
    String status;
    boolean duplicate;
    UUID signalEventId;
    UUID linkedTradeId;
    String externalTradeId;
    String message;
}
