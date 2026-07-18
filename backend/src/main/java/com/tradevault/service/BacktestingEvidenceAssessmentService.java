package com.tradevault.service;

import com.tradevault.config.BacktestingEvidenceProperties;
import com.tradevault.domain.enums.BacktestingEvidenceConfidence;
import com.tradevault.domain.enums.BacktestingEvidenceStatus;
import com.tradevault.dto.backtesting.BacktestingMetricResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class BacktestingEvidenceAssessmentService {
    private final BacktestingEvidenceProperties properties;

    public BacktestingEvidenceStatus status(BacktestingMetricResponse metrics,
                                            int inboxCount,
                                            BigDecimal liveExpectancyGap) {
        int trades = metrics == null || metrics.getTrades() == null ? 0 : metrics.getTrades();
        BigDecimal expectancy = metrics == null || metrics.getExpectancy() == null
                ? BigDecimal.ZERO : metrics.getExpectancy();
        boolean materialDivergence = liveExpectancyGap != null
                && liveExpectancyGap.abs().compareTo(BigDecimal.valueOf(properties.getMaterialExpectancyGapR())) >= 0;
        if (inboxCount > 0 || expectancy.compareTo(BigDecimal.ZERO) < 0 || materialDivergence) {
            return BacktestingEvidenceStatus.NEEDS_REVIEW;
        }
        if (trades < properties.getExploratoryMinimum()) return BacktestingEvidenceStatus.INSUFFICIENT_DATA;
        if (trades < properties.getEarlySignalMinimum()) return BacktestingEvidenceStatus.EXPLORATORY;
        if (trades < properties.getDevelopingEdgeMinimum()) return BacktestingEvidenceStatus.EARLY_SIGNAL;
        if (trades < properties.getValidatedMinimum()) return BacktestingEvidenceStatus.DEVELOPING_EDGE;
        return BacktestingEvidenceStatus.VALIDATED_EVIDENCE;
    }

    public BacktestingEvidenceConfidence confidence(BacktestingMetricResponse metrics,
                                                    int sourceTypes,
                                                    int incompleteClassifications,
                                                    BigDecimal liveExpectancyGap) {
        int trades = metrics == null || metrics.getTrades() == null ? 0 : metrics.getTrades();
        int score = trades >= properties.getValidatedMinimum() ? 3
                : trades >= properties.getDevelopingEdgeMinimum() ? 2
                : trades >= properties.getEarlySignalMinimum() ? 1 : 0;
        if (sourceTypes >= 2) score++;
        if (trades > 0 && incompleteClassifications * 4 > trades) score--;
        if (liveExpectancyGap != null
                && liveExpectancyGap.abs().compareTo(BigDecimal.valueOf(properties.getMaterialExpectancyGapR())) >= 0) score--;
        if (metrics != null && metrics.getExpectancy() != null && metrics.getExpectancy().compareTo(BigDecimal.ZERO) < 0) score--;
        if (score >= 4) return BacktestingEvidenceConfidence.HIGH;
        if (score >= 2) return BacktestingEvidenceConfidence.MODERATE;
        if (score >= 1) return BacktestingEvidenceConfidence.LOW;
        return BacktestingEvidenceConfidence.VERY_LOW;
    }

    public int recentLiveWindow() {
        return properties.getRecentLiveWindow();
    }

    public BigDecimal materialExpectancyGap() {
        return BigDecimal.valueOf(properties.getMaterialExpectancyGapR());
    }
}
