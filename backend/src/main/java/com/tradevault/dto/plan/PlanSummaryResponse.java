package com.tradevault.dto.plan;

import com.tradevault.domain.enums.PlanScope;
import com.tradevault.domain.enums.PlanSource;
import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class PlanSummaryResponse {
    UUID id;
    String title;
    PlanScope scope;
    PlanSource source;
    String authorDisplayName;
    boolean featured;
    OffsetDateTime activeFrom;
    OffsetDateTime activeTo;
}
