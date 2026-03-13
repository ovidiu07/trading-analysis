package com.tradevault.service.signalintel;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.SignalEvent;
import com.tradevault.domain.entity.SignalOutcome;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.enums.SignalOutcomeStatus;
import com.tradevault.dto.signalintel.TradingViewSignalCloseRequest;
import com.tradevault.repository.SignalOutcomeRepository;
import com.tradevault.repository.TradeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
public class DefaultOutcomeLabelingService implements OutcomeLabelingService {
    private static final long MATCH_WINDOW_MINUTES = 180L;

    private final SignalOutcomeRepository signalOutcomeRepository;
    private final TradeRepository tradeRepository;
    private final ObjectMapper objectMapper;

    public DefaultOutcomeLabelingService(SignalOutcomeRepository signalOutcomeRepository,
                                         TradeRepository tradeRepository,
                                         ObjectMapper objectMapper) {
        this.signalOutcomeRepository = signalOutcomeRepository;
        this.tradeRepository = tradeRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public SignalOutcome upsertOutcome(SignalEvent signalEvent, TradingViewSignalCloseRequest request) {
        OffsetDateTime closeTimestamp = OffsetDateTime.ofInstant(
                java.time.Instant.ofEpochMilli(request.getTimestamp()),
                ZoneOffset.UTC
        );
        SignalOutcome outcome = signalOutcomeRepository.findBySignalEvent_Id(signalEvent.getId())
                .orElseGet(() -> SignalOutcome.builder().signalEvent(signalEvent).build());
        outcome.setOutcomeStatus(parseOutcomeStatus(request.getResult()));
        outcome.setCloseTimestamp(closeTimestamp);
        outcome.setPnlR(request.getPnlR());
        outcome.setPnlAmount(request.getPnlAmount());
        outcome.setHoldBars(request.getHoldBars());
        outcome.setHoldMinutes(resolveHoldMinutes(signalEvent, closeTimestamp, request.getHoldMinutes()));
        outcome.setExitReason(normalize(request.getExitReason()));
        outcome.setSlippage(request.getSlippage());
        outcome.setLinkedTrade(resolveTradeLink(signalEvent, closeTimestamp));
        outcome.setRawPayloadJson(objectMapper.valueToTree(request));
        return signalOutcomeRepository.save(outcome);
    }

    private Integer resolveHoldMinutes(SignalEvent signalEvent, OffsetDateTime closeTimestamp, Integer explicitHoldMinutes) {
        if (explicitHoldMinutes != null) {
            return explicitHoldMinutes;
        }
        if (signalEvent.getSignalTimestamp() == null || closeTimestamp == null) {
            return null;
        }
        long minutes = Math.max(0, Duration.between(signalEvent.getSignalTimestamp(), closeTimestamp).toMinutes());
        return (int) minutes;
    }

    private Trade resolveTradeLink(SignalEvent signalEvent, OffsetDateTime closeTimestamp) {
        if (signalEvent.getUser() == null) {
            return null;
        }
        OffsetDateTime from = signalEvent.getSignalTimestamp().minusMinutes(30);
        OffsetDateTime to = closeTimestamp.plusMinutes(15);
        List<Trade> candidates = tradeRepository.findByUserIdAndSymbolAndDirectionAndOpenedAtBetweenOrderByOpenedAtAsc(
                signalEvent.getUser().getId(),
                signalEvent.getSymbol(),
                signalEvent.getDirection(),
                from,
                to
        );
        if (candidates.size() != 1) {
            return chooseSafeBestCandidate(signalEvent, candidates).orElse(null);
        }
        return candidates.get(0);
    }

    private Optional<Trade> chooseSafeBestCandidate(SignalEvent signalEvent, List<Trade> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return Optional.empty();
        }
        List<Trade> sorted = candidates.stream()
                .sorted(Comparator.comparingLong(trade ->
                        Math.abs(Duration.between(signalEvent.getSignalTimestamp(), trade.getOpenedAt()).toMinutes())))
                .toList();
        if (sorted.size() > 1) {
            long firstDiff = Math.abs(Duration.between(signalEvent.getSignalTimestamp(), sorted.get(0).getOpenedAt()).toMinutes());
            long secondDiff = Math.abs(Duration.between(signalEvent.getSignalTimestamp(), sorted.get(1).getOpenedAt()).toMinutes());
            if (firstDiff > MATCH_WINDOW_MINUTES || Math.abs(secondDiff - firstDiff) <= 15L) {
                return Optional.empty();
            }
        }
        Trade candidate = sorted.get(0);
        long bestDiff = Math.abs(Duration.between(signalEvent.getSignalTimestamp(), candidate.getOpenedAt()).toMinutes());
        if (bestDiff > MATCH_WINDOW_MINUTES) {
            return Optional.empty();
        }
        return Optional.of(candidate);
    }

    private SignalOutcomeStatus parseOutcomeStatus(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Close event result is required");
        }
        try {
            return SignalOutcomeStatus.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unsupported signal outcome result: " + value);
        }
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
