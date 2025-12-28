package com.tradevault.dto.user;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UserSettingsRequest {
    @NotBlank(message = "Base currency is required")
    private String baseCurrency;

    @NotBlank(message = "Timezone is required")
    private String timezone;
}
