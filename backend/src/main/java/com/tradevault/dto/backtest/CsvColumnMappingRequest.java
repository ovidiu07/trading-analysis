package com.tradevault.dto.backtest;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CsvColumnMappingRequest {
    @NotBlank
    private String timeColumn;

    @NotBlank
    private String openColumn;

    @NotBlank
    private String highColumn;

    @NotBlank
    private String lowColumn;

    @NotBlank
    private String closeColumn;

    private String volumeColumn;

    private String timezone;
}
