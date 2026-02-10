package com.tradevault.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class UserSettingsRequest {
    @NotBlank(message = "Base currency is required")
    private String baseCurrency;

    @NotBlank(message = "Timezone is required")
    private String timezone;

    @Pattern(regexp = "^(LIGHT|DARK|SYSTEM)$", message = "Theme preference must be LIGHT, DARK, or SYSTEM")
    private String themePreference;
}
