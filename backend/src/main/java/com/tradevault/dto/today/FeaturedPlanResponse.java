package com.tradevault.dto.today;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class FeaturedPlanResponse {
    UUID id;
    String slug;
    String title;
    String type;
    String biasSummary;
    String primaryModel;
    List<String> keyLevels;
    List<String> tags;
    List<String> symbols;
    LocalDate weekStart;
    LocalDate weekEnd;
    OffsetDateTime publishedAt;
    OffsetDateTime updatedAt;
}
