package com.tradevault.dto.signalintel;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;

@Value
@Builder
public class TradingViewWebhookSettingsResponse {
    boolean enabled;
    boolean hasSecret;
    String secretHint;
    OffsetDateTime lastRotatedAt;
    String openSignalWebhookUrl;
    String closeSignalWebhookUrl;
    String sampleOpenPayload;
    String sampleClosePayload;
}
