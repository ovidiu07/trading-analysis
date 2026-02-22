package com.tradevault.dto.chartprofile;

import com.fasterxml.jackson.databind.JsonNode;
import com.tradevault.domain.enums.ChartProfileScope;
import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class ChartProfileResponse {
    UUID id;
    String name;
    boolean isDefault;
    ChartProfileScope scope;
    JsonNode embedConfigJson;
    JsonNode tjaPrefsJson;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
