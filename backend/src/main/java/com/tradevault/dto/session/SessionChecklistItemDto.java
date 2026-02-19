package com.tradevault.dto.session;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class SessionChecklistItemDto {
    String id;
    String text;
    boolean completed;
}
