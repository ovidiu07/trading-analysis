package com.tradevault.dto.backtesting;

import com.tradevault.domain.enums.BacktestingScreenshotResult;
import lombok.Data;

import java.util.List;

@Data
public class BacktestingScreenshotRequest {
    private String caption;
    private BacktestingScreenshotResult tradeResult;
    private String session;
    private String timeframe;
    private List<String> tags;
    private Integer sortOrder;
}
