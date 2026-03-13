package com.tradevault.dto.signalintel;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;

@Value
@Builder
public class TradingViewWebhookSecretResetResponse {
    String secret;
    String secretHint;
    OffsetDateTime generatedAt;
    String openSignalWebhookUrl;
    String closeSignalWebhookUrl;
}
