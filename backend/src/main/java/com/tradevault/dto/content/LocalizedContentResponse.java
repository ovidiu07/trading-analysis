package com.tradevault.dto.content;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LocalizedContentResponse {
    String title;
    String summary;
    String body;
}
