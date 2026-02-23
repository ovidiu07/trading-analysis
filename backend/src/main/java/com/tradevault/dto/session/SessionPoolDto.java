package com.tradevault.dto.session;

import com.tradevault.domain.enums.LevelStatus;
import com.tradevault.domain.enums.LevelTimeframe;
import com.tradevault.domain.enums.LevelType;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class SessionPoolDto {
    UUID id;
    String symbol;
    String poolName;
    LevelType type;
    LevelTimeframe timeframe;
    BigDecimal zoneLow;
    BigDecimal zoneHigh;
    Short cleanlinessScore;
    LevelStatus status;
    boolean sweepRole;
    List<UUID> levelIds;
    OffsetDateTime createdAtUtc;
    OffsetDateTime updatedAtUtc;
}
