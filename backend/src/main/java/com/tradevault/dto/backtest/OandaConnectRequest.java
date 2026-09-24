package com.tradevault.dto.backtest;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import com.tradevault.service.backtest.OandaEnvironment;

@Data
public class OandaConnectRequest {
    @NotBlank
    private String token;

    private OandaEnvironment environment = OandaEnvironment.PRACTICE;
}
