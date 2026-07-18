package com.tradevault.dto.backtesting;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Value
@Builder
public class BacktestingEvidenceResponse {
    UUID id;
    UUID workspaceId;
    String workspaceName;
    UUID liveTradeId;
    String sourceType;
    String syncStatus;
    String classificationStatus;
    boolean includedInAnalytics;
    String excludedReason;
    Map<String, Object> researchClassification;
    LocalDate tradeDate;
    OffsetDateTime openedAt;
    OffsetDateTime closedAt;
    String instrument;
    String direction;
    String session;
    String timeframe;
    UUID strategyId;
    String strategyName;
    String setupName;
    String setupGrade;
    String result;
    BigDecimal realizedR;
    BigDecimal netPnl;
    BigDecimal riskPercent;
    Integer ruleBreakCount;
    Integer screenshotCount;
    String notes;
    OffsetDateTime lastSyncedAt;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
