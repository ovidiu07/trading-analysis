package com.tradevault.dto.content;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Value
@Builder
public class ContentTypeResponse {
    UUID id;
    String key;
    Integer sortOrder;
    boolean active;
    String displayName;
    String description;
    String locale;
    String resolvedLocale;
    Map<String, LocalizedContentTypeResponse> translations;
    List<String> missingLocales;
}
