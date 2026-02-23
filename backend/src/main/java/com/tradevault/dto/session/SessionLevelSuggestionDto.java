package com.tradevault.dto.session;

import com.tradevault.domain.enums.LevelTimeframe;
import com.tradevault.domain.enums.LevelType;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

@Value
@Builder
public class SessionLevelSuggestionDto {
    LevelType type;
    LevelTimeframe timeframe;
    BigDecimal price;
    BigDecimal zoneLow;
    BigDecimal zoneHigh;
    String reason;
    double confidence;
    OffsetDateTime untouchedSinceUtc;
    List<String> confluences;
}
