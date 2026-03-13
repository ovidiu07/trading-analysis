package com.tradevault.service.signalintel;

import com.tradevault.config.SignalIntelProperties;
import com.tradevault.domain.entity.SignalEvent;
import com.tradevault.domain.entity.SignalPerformanceAggregate;
import com.tradevault.domain.entity.SignalProfileRecommendation;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.SignalOutcomeStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class RuleBasedRecommendationEngine implements RecommendationEngine {
    private final ProfileSelectionService profileSelectionService;
    private final SignalIntelProperties properties;

    public RuleBasedRecommendationEngine(ProfileSelectionService profileSelectionService,
                                         SignalIntelProperties properties) {
        this.profileSelectionService = profileSelectionService;
        this.properties = properties;
    }

    @Override
    public List<GeneratedSignalRecommendation> generate(User user,
                                                        List<SignalEvent> events,
                                                        List<SignalPerformanceAggregate> aggregates) {
        Map<ScopeKey, List<SignalPerformanceAggregate>> aggregatesByScope = new LinkedHashMap<>();
        for (SignalPerformanceAggregate aggregate : aggregates) {
            ScopeKey scopeKey = new ScopeKey(aggregate.getSymbol(), aggregate.getTimeframe(), aggregate.getRegime().name());
            aggregatesByScope.computeIfAbsent(scopeKey, ignored -> new ArrayList<>()).add(aggregate);
        }

        List<GeneratedSignalRecommendation> recommendations = new ArrayList<>();
        for (Map.Entry<ScopeKey, List<SignalPerformanceAggregate>> entry : aggregatesByScope.entrySet()) {
            ScopeKey scope = entry.getKey();
            List<ProfileStats> profileStats = collapseProfiles(scope, events, entry.getValue());
            if (profileStats.isEmpty()) {
                continue;
            }
            ProfileStats bestObserved = profileStats.stream()
                    .filter(stats -> stats.sampleSize >= properties.getRecommendationMinSamples())
                    .max(Comparator.comparing(ProfileStats::score))
                    .orElse(null);

            int totalScopeSamples = profileStats.stream().mapToInt(stats -> stats.sampleSize).sum();
            if (bestObserved == null && totalScopeSamples < properties.getRecommendationMinSamples()) {
                continue;
            }

            ProfileStats chosen = bestObserved != null ? bestObserved : fallbackProfile(scope, profileStats);
            SignalProfileDefinition definition = profileSelectionService.findById(chosen.profileId)
                    .orElse(profileSelectionService.defaultProfileFor(scope.timeframe, com.tradevault.domain.enums.SignalRegime.valueOf(scope.regime)));

            BigDecimal recommendationScore = chosen.score.setScale(4, RoundingMode.HALF_UP);
            SignalProfileRecommendation recommendation = SignalProfileRecommendation.builder()
                    .user(user)
                    .symbolScope(scope.symbol)
                    .timeframe(scope.timeframe)
                    .regimeScope(scope.regime)
                    .profileId(definition.profileId())
                    .profileJson(definition.profileJson())
                    .minSamples(properties.getRecommendationMinSamples())
                    .sampleSize(chosen.sampleSize)
                    .recommendationScore(recommendationScore)
                    .winRate(chosen.winRate.setScale(4, RoundingMode.HALF_UP))
                    .expectancyR(chosen.expectancyR.setScale(4, RoundingMode.HALF_UP))
                    .active(true)
                    .generatedAt(OffsetDateTime.now())
                    .build();

            recommendations.add(new GeneratedSignalRecommendation(
                    recommendation,
                    buildReasons(chosen, bestObserved == null)
            ));
        }

        recommendations.sort(Comparator.comparing((GeneratedSignalRecommendation item) ->
                item.recommendation().getRecommendationScore()).reversed());
        return recommendations;
    }

    private List<ProfileStats> collapseProfiles(ScopeKey scope,
                                                List<SignalEvent> events,
                                                List<SignalPerformanceAggregate> aggregates) {
        Map<String, List<SignalPerformanceAggregate>> byProfile = new LinkedHashMap<>();
        for (SignalPerformanceAggregate aggregate : aggregates) {
            byProfile.computeIfAbsent(aggregate.getParameterProfileId(), ignored -> new ArrayList<>()).add(aggregate);
        }

        List<ProfileStats> collapsed = new ArrayList<>();
        for (Map.Entry<String, List<SignalPerformanceAggregate>> entry : byProfile.entrySet()) {
            List<SignalPerformanceAggregate> rows = entry.getValue();
            int sampleSize = rows.stream().mapToInt(SignalPerformanceAggregate::getSampleSize).sum();
            if (sampleSize == 0) {
                continue;
            }
            BigDecimal weightedWinRate = weightedAverage(sampleSize, rows, SignalPerformanceAggregate::getWinRate);
            BigDecimal weightedExpectancy = weightedAverage(sampleSize, rows, SignalPerformanceAggregate::getExpectancyR);
            BigDecimal weightedConfidence = weightedAverage(sampleSize, rows, SignalPerformanceAggregate::getAvgConfidenceScore);
            BigDecimal maxDrawdown = rows.stream()
                    .map(SignalPerformanceAggregate::getMaxDrawdownR)
                    .max(Comparator.naturalOrder())
                    .orElse(BigDecimal.ZERO);
            BigDecimal recencyExpectancy = recencyWeightedExpectancy(scope, entry.getKey(), events);
            BigDecimal score = computeScore(sampleSize, weightedWinRate, weightedExpectancy, recencyExpectancy, maxDrawdown);
            collapsed.add(new ProfileStats(
                    entry.getKey(),
                    sampleSize,
                    weightedWinRate,
                    weightedExpectancy,
                    weightedConfidence,
                    recencyExpectancy,
                    maxDrawdown,
                    score
            ));
        }
        collapsed.sort(Comparator.comparing(ProfileStats::score).reversed());
        return collapsed;
    }

    private ProfileStats fallbackProfile(ScopeKey scope, List<ProfileStats> profileStats) {
        ProfileStats current = profileStats.stream()
                .max(Comparator.comparingInt(ProfileStats::sampleSize))
                .orElseThrow();
        SignalProfileDefinition defaultProfile = profileSelectionService.defaultProfileFor(
                scope.timeframe,
                com.tradevault.domain.enums.SignalRegime.valueOf(scope.regime)
        );
        if (!current.profileId.equals(defaultProfile.profileId())) {
            return new ProfileStats(
                    defaultProfile.profileId(),
                    current.sampleSize,
                    current.winRate,
                    current.expectancyR,
                    current.avgConfidence,
                    current.recencyExpectancy,
                    current.maxDrawdown,
                    current.score.multiply(BigDecimal.valueOf(0.85d))
            );
        }
        return current;
    }

    private BigDecimal weightedAverage(int totalSampleSize,
                                       List<SignalPerformanceAggregate> rows,
                                       java.util.function.Function<SignalPerformanceAggregate, BigDecimal> extractor) {
        BigDecimal numerator = BigDecimal.ZERO;
        for (SignalPerformanceAggregate row : rows) {
            numerator = numerator.add(extractor.apply(row).multiply(BigDecimal.valueOf(row.getSampleSize())));
        }
        return numerator.divide(BigDecimal.valueOf(totalSampleSize), 6, RoundingMode.HALF_UP);
    }

    private BigDecimal recencyWeightedExpectancy(ScopeKey scope, String profileId, List<SignalEvent> events) {
        List<SignalEvent> matching = events.stream()
                .filter(event -> event.getOutcome() != null)
                .filter(event -> event.getOutcome().getPnlR() != null)
                .filter(event -> event.getOutcome().getOutcomeStatus() != SignalOutcomeStatus.OPEN)
                .filter(event -> profileId.equalsIgnoreCase(event.getParameterProfileId()))
                .filter(event -> scope.symbol.equalsIgnoreCase(event.getSymbol()))
                .filter(event -> scope.timeframe.equalsIgnoreCase(event.getTimeframe()))
                .filter(event -> scope.regime.equalsIgnoreCase(event.getRegime().name()))
                .sorted(Comparator.comparing((SignalEvent event) -> event.getOutcome().getCloseTimestamp()).reversed())
                .limit(20)
                .toList();
        if (matching.isEmpty()) {
            return BigDecimal.ZERO;
        }
        double weightedSum = 0.0d;
        double totalWeight = 0.0d;
        for (int index = 0; index < matching.size(); index++) {
            double weight = Math.exp(-index / 8.0d);
            weightedSum += matching.get(index).getOutcome().getPnlR().doubleValue() * weight;
            totalWeight += weight;
        }
        return BigDecimal.valueOf(weightedSum / totalWeight).setScale(6, RoundingMode.HALF_UP);
    }

    private BigDecimal computeScore(int sampleSize,
                                    BigDecimal winRate,
                                    BigDecimal expectancyR,
                                    BigDecimal recencyExpectancy,
                                    BigDecimal maxDrawdownR) {
        double sampleConfidence = clamp(sampleSize / 40.0d, 0.25d, 1.0d);
        double expectancyNormalized = clamp((expectancyR.doubleValue() + 1.0d) / 2.0d, 0.0d, 1.0d);
        double recencyNormalized = clamp((recencyExpectancy.doubleValue() + 1.0d) / 2.0d, 0.0d, 1.0d);
        double winRateNormalized = clamp(winRate.doubleValue() / 100.0d, 0.0d, 1.0d);
        double stability = clamp(1.0d - (maxDrawdownR.doubleValue() / Math.max(sampleSize, 1)), 0.35d, 1.0d);
        double raw = sampleConfidence * stability * (
                expectancyNormalized * 0.45d +
                recencyNormalized * 0.25d +
                winRateNormalized * 0.30d
        );
        return BigDecimal.valueOf(raw * 100.0d);
    }

    private List<String> buildReasons(ProfileStats chosen, boolean fallback) {
        List<String> reasons = new ArrayList<>();
        reasons.add("%d closed signals contributed to this recommendation.".formatted(chosen.sampleSize));
        reasons.add("Expectancy is %.2fR with a %.1f%% win rate.".formatted(
                chosen.expectancyR.doubleValue(),
                chosen.winRate.doubleValue()
        ));
        if (chosen.recencyExpectancy.compareTo(chosen.expectancyR) >= 0) {
            reasons.add("Recent closed signals are holding or improving versus the full sample.");
        } else {
            reasons.add("Recent closed signals are softer, so the score stays conservative.");
        }
        if (fallback) {
            reasons.add("Profile alternatives are not yet statistically separated, so the engine stays near the default pack.");
        }
        return reasons;
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private record ScopeKey(String symbol, String timeframe, String regime) {
    }

    private record ProfileStats(
            String profileId,
            int sampleSize,
            BigDecimal winRate,
            BigDecimal expectancyR,
            BigDecimal avgConfidence,
            BigDecimal recencyExpectancy,
            BigDecimal maxDrawdown,
            BigDecimal score
    ) {
    }
}
