package com.tradevault.dto.backtesting;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.UUID;

@Value
@Builder
public class BacktestingWorkspaceCompatibilityResponse {
    UUID workspaceId;
    String workspaceName;
    String strategyName;
    String instrument;
    String canonicalInstrumentId;
    String session;
    String timeframe;
    String autoImportMode;
    boolean compatible;
    boolean selectable;
    List<BacktestingCompatibilityCheckResponse> checks;
}
