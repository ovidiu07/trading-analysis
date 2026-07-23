package com.tradevault.dto.account;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateTradingAccountRequest(
        @NotBlank @Size(max = 120) String name,
        @Size(max = 120) String broker,
        @NotBlank
        @Pattern(regexp = "[A-Za-z]{3}", message = "must be a three-letter currency code")
        String currency
) {
}
