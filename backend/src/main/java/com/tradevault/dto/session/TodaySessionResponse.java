package com.tradevault.dto.session;

import com.tradevault.domain.enums.TodaySessionStatus;
import com.tradevault.dto.trade.TradeResponse;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class TodaySessionResponse {
    UUID id;
    LocalDate sessionDate;
    BigDecimal profitTarget;
    BigDecimal lossLimit;
    Integer maxTrades;
    TodaySessionStatus status;
    BigDecimal realizedPnl;
    long closedTradesCount;
    long remainingTrades;
    List<String> plannedTickers;
    List<SessionChecklistItemDto> checklistItems;
    UUID checklistTemplateId;
    TradeResponse activeTrade;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
