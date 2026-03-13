package com.tradevault.dto.signalintel;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

@Value
@Builder
public class SignalRecommendationResponse {
    String symbolScope;
    String timeframe;
    String regimeScope;
    String profileId;
    JsonNode profileJson;
    int minSamples;
    int sampleSize;
    BigDecimal recommendationScore;
    BigDecimal winRate;
    BigDecimal expectancyR;
    List<String> reasons;
    OffsetDateTime generatedAt;
}
