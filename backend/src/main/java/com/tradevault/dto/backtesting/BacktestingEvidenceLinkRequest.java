package com.tradevault.dto.backtesting;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class BacktestingEvidenceLinkRequest {
    @NotNull
    private UUID workspaceId;
}
