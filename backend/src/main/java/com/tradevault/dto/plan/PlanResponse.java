package com.tradevault.dto.plan;

import com.tradevault.domain.enums.PlanScope;
import com.tradevault.domain.enums.PlanSource;
import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class PlanResponse {
    UUID id;
    PlanScope scope;
    PlanSource source;
    UUID authorUserId;
    String authorDisplayName;
    String title;
    String content;
    String checklistJson;
    OffsetDateTime activeFrom;
    OffsetDateTime activeTo;
    boolean featured;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
