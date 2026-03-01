package com.tradevault.dto.session;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class SessionActivePlaybookDto {
    UUID playbookId;
    String name;
    JsonNode snapshot;
}
