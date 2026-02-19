package com.tradevault.dto.strategy;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class StrategyListResponse {
    List<StrategyResponse> myStrategies;
    List<StrategyResponse> mentorStrategies;
}
