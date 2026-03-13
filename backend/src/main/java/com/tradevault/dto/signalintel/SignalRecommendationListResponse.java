package com.tradevault.dto.signalintel;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class SignalRecommendationListResponse {
    List<SignalRecommendationResponse> recommendations;
}
