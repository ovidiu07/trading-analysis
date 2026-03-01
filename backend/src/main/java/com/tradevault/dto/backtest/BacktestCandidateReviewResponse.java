package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class BacktestCandidateReviewResponse {
    UUID candidateId;
    String candidateState;
    String decision;
    String note;
    OffsetDateTime reviewedAtUtc;
}
