package com.tradevault.dto.signalintel;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class TradingViewWebhookSettingsUpdateRequest {
    @NotNull
    private Boolean enabled;
}
