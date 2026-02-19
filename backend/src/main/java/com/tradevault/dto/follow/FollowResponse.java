package com.tradevault.dto.follow;

import com.tradevault.domain.enums.FollowType;
import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class FollowResponse {
    UUID id;
    FollowType followType;
    String value;
    OffsetDateTime createdAt;
}
