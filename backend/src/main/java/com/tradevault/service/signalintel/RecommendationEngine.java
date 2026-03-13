package com.tradevault.service.signalintel;

import com.tradevault.domain.entity.SignalEvent;
import com.tradevault.domain.entity.SignalPerformanceAggregate;
import com.tradevault.domain.entity.User;

import java.util.List;

public interface RecommendationEngine {
    List<GeneratedSignalRecommendation> generate(User user,
                                                 List<SignalEvent> events,
                                                 List<SignalPerformanceAggregate> aggregates);
}
