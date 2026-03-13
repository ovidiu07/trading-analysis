package com.tradevault.service.signalintel;

import com.tradevault.domain.entity.SignalProfileRecommendation;

import java.util.List;

public record GeneratedSignalRecommendation(
        SignalProfileRecommendation recommendation,
        List<String> reasons
) {
}
