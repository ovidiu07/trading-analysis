package com.tradevault.dto.backtesting;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class BacktestingListResponse {
    BacktestingSummaryResponse summary;
    List<BacktestingWorkspaceResponse> workspaces;
}
