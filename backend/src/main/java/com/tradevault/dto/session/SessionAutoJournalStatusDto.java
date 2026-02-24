package com.tradevault.dto.session;

import com.tradevault.domain.enums.AutoJournalState;
import com.tradevault.domain.enums.Direction;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class SessionAutoJournalStatusDto {
    UUID sessionId;
    AutoJournalState state;
    String symbol;
    Direction side;
    BigDecimal entry;
    BigDecimal sl;
    BigDecimal tp;
    BigDecimal tolerancePips;
    Integer timeoutMin;
    OffsetDateTime armedAt;
    OffsetDateTime lastEventAt;
    String lastError;
    boolean quoteAvailable;
    String quoteReason;
    BigDecimal bid;
    BigDecimal ask;
    BigDecimal spread;
    OffsetDateTime quoteTsUtc;
    String quoteSource;
}
