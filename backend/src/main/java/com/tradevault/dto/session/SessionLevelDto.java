package com.tradevault.dto.session;

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
    SessionLevelCategory category;
    String notes;
    OffsetDateTime sweptAt;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
