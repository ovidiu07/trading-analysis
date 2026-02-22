package com.tradevault.dto.backtest;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OandaConnectRequest {
    @NotBlank
    private String token;
}
