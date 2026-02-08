package com.tradevault.dto.content;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LocalizedContentTypeResponse {
    String displayName;
    String description;
}
