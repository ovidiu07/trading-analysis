package com.tradevault.service.signalintel;

import com.tradevault.domain.entity.SignalEvent;
import com.tradevault.domain.entity.SignalPerformanceAggregate;
import com.tradevault.domain.entity.SignalOutcome;
import com.tradevault.repository.SignalEventRepository;
import com.tradevault.repository.SignalPerformanceAggregateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class SignalAggregateService {
    private final SignalEventRepository signalEventRepository;
    private final SignalPerformanceAggregateRepository signalPerformanceAggregateRepository;

    public SignalAggregateService(SignalEventRepository signalEventRepository,
                                  SignalPerformanceAggregateRepository signalPerformanceAggregateRepository) {
        this.signalEventRepository = signalEventRepository;
        this.signalPerformanceAggregateRepository = signalPerformanceAggregateRepository;
    }

    @Transactional
    public void rebuildUserAggregates(UUID userId) {
        List<SignalEvent> events = signalEventRepository.findByUser_IdOrderBySignalTimestampAsc(userId).stream()
                .filter(event -> event.getOutcome() != null)
                .filter(event -> event.getOutcome().getPnlR() != null)
                .toList();

        Map<AggregateKey, List<SignalEvent>> grouped = new LinkedHashMap<>();
        for (SignalEvent event : events) {
            AggregateKey key = new AggregateKey(
                    event.getSymbol(),
                    event.getTimeframe(),
                    event.getParameterProfileId(),
                    event.getSetupType().name(),
                    event.getRegime().name(),
                    event.getDirection().name()
            );
            grouped.computeIfAbsent(key, ignored -> new ArrayList<>()).add(event);
        }

        signalPerformanceAggregateRepository.deleteByUser_Id(userId);
        if (grouped.isEmpty()) {
            return;
        }

        List<SignalPerformanceAggregate> aggregates = new ArrayList<>();
        for (Map.Entry<AggregateKey, List<SignalEvent>> entry : grouped.entrySet()) {
            List<SignalEvent> samples = entry.getValue();
            BigDecimal pnlSum = BigDecimal.ZERO;
            BigDecimal confidenceSum = BigDecimal.ZERO;
            int wins = 0;
            BigDecimal equity = BigDecimal.ZERO;
            BigDecimal peak = BigDecimal.ZERO;
            BigDecimal maxDrawdown = BigDecimal.ZERO;

            for (SignalEvent sample : samples) {
                SignalOutcome outcome = sample.getOutcome();
                pnlSum = pnlSum.add(outcome.getPnlR());
                confidenceSum = confidenceSum.add(BigDecimal.valueOf(sample.getConfidenceScore()));
                if (outcome.getOutcomeStatus() == com.tradevault.domain.enums.SignalOutcomeStatus.WIN) {
                    wins += 1;
                }
                equity = equity.add(outcome.getPnlR());
                if (equity.compareTo(peak) > 0) {
                    peak = equity;
                }
                BigDecimal drawdown = peak.subtract(equity);
                if (drawdown.compareTo(maxDrawdown) > 0) {
                    maxDrawdown = drawdown;
                }
            }

            AggregateKey key = entry.getKey();
            BigDecimal sampleSize = BigDecimal.valueOf(samples.size());
            aggregates.add(SignalPerformanceAggregate.builder()
                    .user(samples.get(0).getUser())
                    .symbol(key.symbol())
                    .timeframe(key.timeframe())
                    .parameterProfileId(key.parameterProfileId())
                    .setupType(samples.get(0).getSetupType())
                    .regime(samples.get(0).getRegime())
                    .direction(samples.get(0).getDirection())
                    .sampleSize(samples.size())
                    .winRate(percent(wins, samples.size()))
                    .avgPnlR(pnlSum.divide(sampleSize, 6, RoundingMode.HALF_UP))
                    .expectancyR(pnlSum.divide(sampleSize, 6, RoundingMode.HALF_UP))
                    .maxDrawdownR(maxDrawdown.setScale(6, RoundingMode.HALF_UP))
                    .avgConfidenceScore(confidenceSum.divide(sampleSize, 6, RoundingMode.HALF_UP))
                    .build());
        }

        signalPerformanceAggregateRepository.saveAll(aggregates);
    }

    private BigDecimal percent(int wins, int sampleSize) {
        if (sampleSize == 0) {
            return BigDecimal.ZERO;
        }
        return BigDecimal.valueOf(wins)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(sampleSize), 6, RoundingMode.HALF_UP);
    }

    private record AggregateKey(
            String symbol,
            String timeframe,
            String parameterProfileId,
            String setupType,
            String regime,
            String direction
    ) {
    }
}
