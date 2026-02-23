package com.tradevault.dto.session;

import com.tradevault.domain.enums.LevelCreatedBy;
import com.tradevault.domain.enums.LevelStatus;
import com.tradevault.domain.enums.LevelTimeframe;
import com.tradevault.domain.enums.LevelType;
import com.tradevault.domain.enums.SessionLevelCategory;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class SessionLevelDto {
    UUID id;
    String label;
    BigDecimal price;
    String symbol;
    LevelType type;
    LevelTimeframe timeframe;
    BigDecimal zoneLow;
    BigDecimal zoneHigh;
    String originRule;
    Short strengthScore;
    LevelStatus status;
    Integer touchedCount;
    OffsetDateTime lastTouchedAtUtc;
    LevelCreatedBy createdBy;
    String expectation;
    boolean sweepRole;
    boolean entryRole;
    boolean slRole;
    boolean tpRole;
    SessionLevelCategory category;
    String notes;
    OffsetDateTime sweptAt;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
