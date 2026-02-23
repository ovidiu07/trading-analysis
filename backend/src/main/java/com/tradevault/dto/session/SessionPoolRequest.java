package com.tradevault.dto.session;

import com.tradevault.domain.enums.LevelStatus;
import com.tradevault.domain.enums.LevelTimeframe;
import com.tradevault.domain.enums.LevelType;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
public class SessionPoolRequest {
    private String symbol;
    private String poolName;
    private LevelType type;
    private LevelTimeframe timeframe;
    private BigDecimal zoneLow;
    private BigDecimal zoneHigh;
    private Short cleanlinessScore;
    private LevelStatus status;
    private Boolean sweepRole;
    private List<UUID> levelIds;
}
