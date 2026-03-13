package com.tradevault.service.signalintel;

import com.tradevault.config.SignalIntelProperties;
import com.tradevault.domain.entity.SignalEvent;
import com.tradevault.domain.entity.SignalPerformanceAggregate;
import com.tradevault.domain.entity.SignalProfileRecommendation;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.SignalOutcomeStatus;
import com.tradevault.dto.signalintel.SignalAnalyticsSummaryResponse;
import com.tradevault.dto.signalintel.SignalBreakdownResponse;
import com.tradevault.dto.signalintel.SignalRecommendationListResponse;
import com.tradevault.dto.signalintel.SignalRecommendationResponse;
import com.tradevault.dto.signalintel.SignalSymbolTimeframeResponse;
import com.tradevault.repository.SignalEventRepository;
import com.tradevault.repository.SignalPerformanceAggregateRepository;
import com.tradevault.repository.SignalProfileRecommendationRepository;
import com.tradevault.service.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class SignalAnalyticsQueryService implements SignalAnalyticsService {
    private final CurrentUserService currentUserService;
    private final SignalEventRepository signalEventRepository;
    private final SignalPerformanceAggregateRepository signalPerformanceAggregateRepository;
    private final SignalProfileRecommendationRepository signalProfileRecommendationRepository;
    private final SignalAggregateService signalAggregateService;
    private final RecommendationEngine recommendationEngine;
    private final SignalIntelProperties properties;

    public SignalAnalyticsQueryService(CurrentUserService currentUserService,
                                       SignalEventRepository signalEventRepository,
                                       SignalPerformanceAggregateRepository signalPerformanceAggregateRepository,
                                       SignalProfileRecommendationRepository signalProfileRecommendationRepository,
                                       SignalAggregateService signalAggregateService,
                                       RecommendationEngine recommendationEngine,
                                       SignalIntelProperties properties) {
        this.currentUserService = currentUserService;
        this.signalEventRepository = signalEventRepository;
        this.signalPerformanceAggregateRepository = signalPerformanceAggregateRepository;
        this.signalProfileRecommendationRepository = signalProfileRecommendationRepository;
        this.signalAggregateService = signalAggregateService;
        this.recommendationEngine = recommendationEngine;
        this.properties = properties;
    }

    @Override
    @Transactional
    public SignalAnalyticsSummaryResponse summary(OffsetDateTime from,
                                                 OffsetDateTime to,
                                                 String symbol,
                                                 String timeframe) {
        User user = currentUserService.getCurrentUser();
        List<SignalEvent> events = filteredEvents(user, from, to, symbol, timeframe);
        List<SignalEvent> closedEvents = closedEvents(events);
        List<SignalRecommendationResponse> recommendations = recommendationResponses(user, events, symbol, timeframe, null);

        return SignalAnalyticsSummaryResponse.builder()
                .overview(buildOverview(events, closedEvents))
                .recentWindows(buildRecentWindows(closedEvents))
                .confidenceTrend(buildTrend(events))
                .weakConditions(buildWeakConditions(closedEvents))
                .topRecommendation(recommendations.isEmpty() ? null : recommendations.get(0))
                .build();
    }

    @Override
    @Transactional
    public SignalRecommendationListResponse recommendations(String symbol, String timeframe, String regime) {
        User user = currentUserService.getCurrentUser();
        List<SignalEvent> events = filteredEvents(user, null, null, symbol, timeframe);
        return SignalRecommendationListResponse.builder()
                .recommendations(recommendationResponses(user, events, symbol, timeframe, regime))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public SignalBreakdownResponse bySetup(OffsetDateTime from, OffsetDateTime to, String symbol, String timeframe) {
        User user = currentUserService.getCurrentUser();
        List<SignalEvent> closedEvents = closedEvents(filteredEvents(user, from, to, symbol, timeframe));
        return SignalBreakdownResponse.builder()
                .rows(groupRows(closedEvents, event -> event.getSetupType().name()))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public SignalBreakdownResponse byRegime(OffsetDateTime from, OffsetDateTime to, String symbol, String timeframe) {
        User user = currentUserService.getCurrentUser();
        List<SignalEvent> closedEvents = closedEvents(filteredEvents(user, from, to, symbol, timeframe));
        return SignalBreakdownResponse.builder()
                .rows(groupRows(closedEvents, event -> event.getRegime().name()))
                .build();
    }

    @Override
    @Transactional
    public SignalSymbolTimeframeResponse bySymbolTimeframe(OffsetDateTime from, OffsetDateTime to) {
        User user = currentUserService.getCurrentUser();
        List<SignalEvent> closedEvents = closedEvents(filteredEvents(user, from, to, null, null));
        List<SignalRecommendationResponse> recommendations = recommendationResponses(user, closedEvents, null, null, null);
        Map<String, SignalRecommendationResponse> recommendationMap = recommendations.stream()
                .collect(Collectors.toMap(
                        item -> item.getSymbolScope() + "|" + item.getTimeframe(),
                        item -> item,
                        (left, right) -> left.getRecommendationScore().compareTo(right.getRecommendationScore()) >= 0 ? left : right,
                        LinkedHashMap::new
                ));

        Map<String, List<SignalEvent>> grouped = closedEvents.stream()
                .collect(Collectors.groupingBy(
                        event -> event.getSymbol() + "|" + event.getTimeframe(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        List<SignalSymbolTimeframeResponse.Row> rows = new ArrayList<>();
        for (Map.Entry<String, List<SignalEvent>> entry : grouped.entrySet()) {
            List<SignalEvent> samples = entry.getValue();
            SignalRecommendationResponse recommendation = recommendationMap.get(entry.getKey());
            rows.add(SignalSymbolTimeframeResponse.Row.builder()
                    .symbol(samples.get(0).getSymbol())
                    .timeframe(samples.get(0).getTimeframe())
                    .sampleSize(samples.size())
                    .winRate(percent(winCount(samples), samples.size()))
                    .expectancyR(avgPnl(samples))
                    .avgConfidenceScore(avgConfidence(samples))
                    .recommendedProfileId(recommendation == null ? null : recommendation.getProfileId())
                    .recommendationScore(recommendation == null ? null : recommendation.getRecommendationScore())
                    .build());
        }
        rows.sort(Comparator.comparing(SignalSymbolTimeframeResponse.Row::getExpectancyR).reversed());
        return SignalSymbolTimeframeResponse.builder().rows(rows).build();
    }

    private List<SignalEvent> filteredEvents(User user,
                                             OffsetDateTime from,
                                             OffsetDateTime to,
                                             String symbol,
                                             String timeframe) {
        List<SignalEvent> events = signalEventRepository.findByUser_IdOrderBySignalTimestampAsc(user.getId());
        return events.stream()
                .filter(event -> from == null || !event.getSignalTimestamp().isBefore(from))
                .filter(event -> to == null || !event.getSignalTimestamp().isAfter(to))
                .filter(event -> symbol == null || symbol.isBlank() || event.getSymbol().equalsIgnoreCase(symbol))
                .filter(event -> timeframe == null || timeframe.isBlank() || event.getTimeframe().equalsIgnoreCase(timeframe))
                .toList();
    }

    private List<SignalEvent> closedEvents(List<SignalEvent> events) {
        return events.stream()
                .filter(event -> event.getOutcome() != null)
                .filter(event -> event.getOutcome().getPnlR() != null)
                .filter(event -> event.getOutcome().getOutcomeStatus() != SignalOutcomeStatus.OPEN)
                .toList();
    }

    private SignalAnalyticsSummaryResponse.Overview buildOverview(List<SignalEvent> events, List<SignalEvent> closedEvents) {
        int totalSignals = events.size();
        int closedSignals = closedEvents.size();
        int openSignals = Math.max(0, totalSignals - closedSignals);
        BigDecimal avgHoldBars = averageInteger(closedEvents.stream()
                .map(event -> event.getOutcome().getHoldBars())
                .filter(Objects::nonNull)
                .toList());
        BigDecimal avgHoldMinutes = averageInteger(closedEvents.stream()
                .map(event -> event.getOutcome().getHoldMinutes())
                .filter(Objects::nonNull)
                .toList());
        return SignalAnalyticsSummaryResponse.Overview.builder()
                .totalSignals(totalSignals)
                .closedSignals(closedSignals)
                .openSignals(openSignals)
                .winRate(percent(winCount(closedEvents), closedSignals))
                .expectancyR(avgPnl(closedEvents))
                .avgPnlR(avgPnl(closedEvents))
                .avgConfidenceScore(avgConfidence(events))
                .avgHoldBars(avgHoldBars)
                .avgHoldMinutes(avgHoldMinutes)
                .build();
    }

    private List<SignalAnalyticsSummaryResponse.RecentWindow> buildRecentWindows(List<SignalEvent> closedEvents) {
        List<SignalEvent> ordered = closedEvents.stream()
                .sorted(Comparator.comparing((SignalEvent event) -> event.getOutcome().getCloseTimestamp()).reversed())
                .toList();
        List<SignalAnalyticsSummaryResponse.RecentWindow> windows = new ArrayList<>();
        for (int window : List.of(20, 50, 100)) {
            List<SignalEvent> slice = ordered.stream().limit(window).toList();
            windows.add(SignalAnalyticsSummaryResponse.RecentWindow.builder()
                    .windowSize(window)
                    .sampleSize(slice.size())
                    .winRate(percent(winCount(slice), slice.size()))
                    .expectancyR(avgPnl(slice))
                    .avgConfidenceScore(avgConfidence(slice))
                    .build());
        }
        return windows;
    }

    private List<SignalAnalyticsSummaryResponse.TrendPoint> buildTrend(List<SignalEvent> events) {
        Map<String, List<SignalEvent>> grouped = new LinkedHashMap<>();
        for (SignalEvent event : events) {
            String label = event.getSignalTimestamp().toLocalDate().toString();
            grouped.computeIfAbsent(label, ignored -> new ArrayList<>()).add(event);
        }
        return grouped.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .skip(Math.max(0, grouped.size() - 14L))
                .map(entry -> SignalAnalyticsSummaryResponse.TrendPoint.builder()
                        .label(entry.getKey())
                        .avgConfidenceScore(avgConfidence(entry.getValue()))
                        .expectancyR(avgPnl(closedEvents(entry.getValue())))
                        .sampleSize(entry.getValue().size())
                        .build())
                .toList();
    }

    private List<SignalAnalyticsSummaryResponse.WeakCondition> buildWeakConditions(List<SignalEvent> closedEvents) {
        Map<String, List<SignalEvent>> grouped = closedEvents.stream()
                .collect(Collectors.groupingBy(
                        event -> String.join("|",
                                event.getSymbol(),
                                event.getTimeframe(),
                                event.getSetupType().name(),
                                event.getRegime().name(),
                                event.getDirection().name()
                        ),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        return grouped.values().stream()
                .map(samples -> {
                    BigDecimal expectancy = avgPnl(samples);
                    int sampleSize = samples.size();
                    String action = expectancy.compareTo(properties.getWeakExpectancyThreshold()) < 0
                            && sampleSize >= properties.getRecommendationMinSamples()
                            ? "PAUSE"
                            : "REDUCE_CONFIDENCE";
                    SignalEvent head = samples.get(0);
                    return SignalAnalyticsSummaryResponse.WeakCondition.builder()
                            .symbol(head.getSymbol())
                            .timeframe(head.getTimeframe())
                            .setupType(head.getSetupType().name())
                            .regime(head.getRegime().name())
                            .direction(head.getDirection().name())
                            .sampleSize(sampleSize)
                            .winRate(percent(winCount(samples), sampleSize))
                            .expectancyR(expectancy)
                            .action(action)
                            .build();
                })
                .filter(row -> row.getExpectancyR().compareTo(properties.getWeakExpectancyThreshold()) < 0)
                .sorted(Comparator.comparing(SignalAnalyticsSummaryResponse.WeakCondition::getExpectancyR))
                .limit(6)
                .toList();
    }

    private List<SignalBreakdownResponse.Row> groupRows(List<SignalEvent> closedEvents,
                                                        java.util.function.Function<SignalEvent, String> keyExtractor) {
        Map<String, List<SignalEvent>> grouped = closedEvents.stream()
                .collect(Collectors.groupingBy(keyExtractor, LinkedHashMap::new, Collectors.toList()));

        return grouped.entrySet().stream()
                .map(entry -> SignalBreakdownResponse.Row.builder()
                        .key(entry.getKey())
                        .sampleSize(entry.getValue().size())
                        .winRate(percent(winCount(entry.getValue()), entry.getValue().size()))
                        .expectancyR(avgPnl(entry.getValue()))
                        .avgPnlR(avgPnl(entry.getValue()))
                        .avgConfidenceScore(avgConfidence(entry.getValue()))
                        .reducedConfidenceSuggested(
                                entry.getValue().size() >= properties.getRecommendationMinSamples() / 2
                                        && avgPnl(entry.getValue()).compareTo(properties.getWeakExpectancyThreshold()) < 0
                        )
                        .build())
                .sorted(Comparator.comparing(SignalBreakdownResponse.Row::getExpectancyR).reversed())
                .toList();
    }

    private List<SignalRecommendationResponse> recommendationResponses(User user,
                                                                       List<SignalEvent> events,
                                                                       String symbol,
                                                                       String timeframe,
                                                                       String regime) {
        signalAggregateService.rebuildUserAggregates(user.getId());
        List<SignalPerformanceAggregate> aggregates = signalPerformanceAggregateRepository.findByUser_IdOrderByUpdatedAtDesc(user.getId());
        List<GeneratedSignalRecommendation> generated = recommendationEngine.generate(user, events, aggregates);
        signalProfileRecommendationRepository.deleteByUser_Id(user.getId());
        signalProfileRecommendationRepository.saveAll(generated.stream()
                .map(GeneratedSignalRecommendation::recommendation)
                .toList());

        return generated.stream()
                .map(item -> toRecommendationResponse(item.recommendation(), item.reasons()))
                .filter(item -> symbol == null || symbol.isBlank() || item.getSymbolScope().equalsIgnoreCase(symbol))
                .filter(item -> timeframe == null || timeframe.isBlank() || item.getTimeframe().equalsIgnoreCase(timeframe))
                .filter(item -> regime == null || regime.isBlank() || item.getRegimeScope().equalsIgnoreCase(regime))
                .toList();
    }

    private SignalRecommendationResponse toRecommendationResponse(SignalProfileRecommendation recommendation, List<String> reasons) {
        return SignalRecommendationResponse.builder()
                .symbolScope(recommendation.getSymbolScope())
                .timeframe(recommendation.getTimeframe())
                .regimeScope(recommendation.getRegimeScope())
                .profileId(recommendation.getProfileId())
                .profileJson(recommendation.getProfileJson())
                .minSamples(recommendation.getMinSamples())
                .sampleSize(recommendation.getSampleSize())
                .recommendationScore(recommendation.getRecommendationScore())
                .winRate(recommendation.getWinRate())
                .expectancyR(recommendation.getExpectancyR())
                .reasons(reasons)
                .generatedAt(recommendation.getGeneratedAt())
                .build();
    }

    private int winCount(List<SignalEvent> events) {
        return (int) events.stream()
                .filter(event -> event.getOutcome() != null)
                .filter(event -> event.getOutcome().getOutcomeStatus() == SignalOutcomeStatus.WIN)
                .count();
    }

    private BigDecimal percent(int wins, int sampleSize) {
        if (sampleSize == 0) {
            return BigDecimal.ZERO;
        }
        return BigDecimal.valueOf(wins)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(sampleSize), 4, RoundingMode.HALF_UP);
    }

    private BigDecimal avgPnl(List<SignalEvent> events) {
        List<BigDecimal> pnls = events.stream()
                .map(SignalEvent::getOutcome)
                .filter(Objects::nonNull)
                .map(outcome -> outcome.getPnlR())
                .filter(Objects::nonNull)
                .toList();
        if (pnls.isEmpty()) {
            return BigDecimal.ZERO;
        }
        BigDecimal sum = pnls.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(pnls.size()), 4, RoundingMode.HALF_UP);
    }

    private BigDecimal avgConfidence(List<SignalEvent> events) {
        if (events.isEmpty()) {
            return BigDecimal.ZERO;
        }
        BigDecimal sum = events.stream()
                .map(SignalEvent::getConfidenceScore)
                .filter(Objects::nonNull)
                .map(BigDecimal::valueOf)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(events.size()), 4, RoundingMode.HALF_UP);
    }

    private BigDecimal averageInteger(List<Integer> values) {
        if (values.isEmpty()) {
            return BigDecimal.ZERO;
        }
        BigDecimal sum = values.stream()
                .map(BigDecimal::valueOf)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(values.size()), 4, RoundingMode.HALF_UP);
    }
}
