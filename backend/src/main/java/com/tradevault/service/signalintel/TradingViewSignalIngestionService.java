package com.tradevault.service.signalintel;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.SignalEvent;
import com.tradevault.domain.entity.SignalOutcome;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.SignalEventType;
import com.tradevault.dto.signalintel.SignalIngestionResponse;
import com.tradevault.dto.signalintel.TradingViewSignalCloseRequest;
import com.tradevault.dto.signalintel.TradingViewSignalOpenRequest;
import com.tradevault.repository.SignalEventRepository;
import com.tradevault.repository.SignalFeatureSnapshotRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Service
@Slf4j
public class TradingViewSignalIngestionService {
    private final TradingViewWebhookAuthService webhookAuthService;
    private final SignalEventRepository signalEventRepository;
    private final SignalFeatureSnapshotRepository signalFeatureSnapshotRepository;
    private final FeatureExtractionService featureExtractionService;
    private final OutcomeLabelingService outcomeLabelingService;
    private final SignalAggregateService signalAggregateService;
    private final ObjectMapper objectMapper;

    public TradingViewSignalIngestionService(TradingViewWebhookAuthService webhookAuthService,
                                             SignalEventRepository signalEventRepository,
                                             SignalFeatureSnapshotRepository signalFeatureSnapshotRepository,
                                             FeatureExtractionService featureExtractionService,
                                             OutcomeLabelingService outcomeLabelingService,
                                             SignalAggregateService signalAggregateService,
                                             ObjectMapper objectMapper) {
        this.webhookAuthService = webhookAuthService;
        this.signalEventRepository = signalEventRepository;
        this.signalFeatureSnapshotRepository = signalFeatureSnapshotRepository;
        this.featureExtractionService = featureExtractionService;
        this.outcomeLabelingService = outcomeLabelingService;
        this.signalAggregateService = signalAggregateService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public SignalIngestionResponse ingestOpen(TradingViewSignalOpenRequest request, String queryToken) {
        validateOpenEvent(request);
        User user = webhookAuthService.resolveUser(request.getAuthToken(), queryToken);
        SignalEvent existing = signalEventRepository.findByUser_IdAndExternalTradeId(user.getId(), request.getExternalTradeId())
                .orElse(null);
        if (existing != null) {
            log.info("Ignoring duplicate TradingView open event for user={} externalTradeId={}", user.getId(), request.getExternalTradeId());
            return SignalIngestionResponse.builder()
                    .status("DUPLICATE")
                    .duplicate(true)
                    .signalEventId(existing.getId())
                    .externalTradeId(existing.getExternalTradeId())
                    .message("Signal already ingested")
                    .build();
        }

        SignalEvent signalEvent = SignalEvent.builder()
                .user(user)
                .externalTradeId(request.getExternalTradeId().trim())
                .symbol(request.getSymbol().trim())
                .timeframe(request.getTimeframe().trim())
                .eventType(SignalEventType.SIGNAL_OPEN)
                .setupType(request.getSetupType())
                .direction(request.getDirection())
                .signalTimestamp(toTimestamp(request.getTimestamp()))
                .signalBarTime(toTimestamp(request.getBarTime() == null ? request.getTimestamp() : request.getBarTime()))
                .entryPrice(request.getEntry())
                .stopLoss(request.getStopLoss())
                .takeProfit(request.getTakeProfit())
                .rr(request.getRr())
                .confidenceScore(request.getConfidenceScore())
                .regime(request.getRegime())
                .htfBias(request.getHtfBias())
                .sessionName(normalize(request.getSession()))
                .parameterProfileId(request.getParameterProfileId().trim())
                .schemaVersion(request.getSchemaVersion().trim())
                .rawPayloadJson(objectMapper.valueToTree(request))
                .build();
        SignalEvent saved = signalEventRepository.save(signalEvent);
        signalFeatureSnapshotRepository.save(featureExtractionService.createSnapshot(saved, request));
        log.info("Stored TradingView signal open event user={} signalEventId={} setup={} timeframe={}",
                user.getId(), saved.getId(), saved.getSetupType(), saved.getTimeframe());
        return SignalIngestionResponse.builder()
                .status("INGESTED")
                .duplicate(false)
                .signalEventId(saved.getId())
                .externalTradeId(saved.getExternalTradeId())
                .message("Signal open event stored")
                .build();
    }

    @Transactional
    public SignalIngestionResponse ingestClose(TradingViewSignalCloseRequest request, String queryToken) {
        validateCloseEvent(request);
        User user = webhookAuthService.resolveUser(request.getAuthToken(), queryToken);
        SignalEvent signalEvent = signalEventRepository.findByUser_IdAndExternalTradeId(user.getId(), request.getExternalTradeId())
                .orElseThrow(() -> new IllegalArgumentException("No signal event found for external trade id " + request.getExternalTradeId()));

        SignalOutcome outcome = outcomeLabelingService.upsertOutcome(signalEvent, request);
        signalAggregateService.rebuildUserAggregates(user.getId());
        log.info("Stored TradingView signal close event user={} signalEventId={} outcome={} linkedTradeId={}",
                user.getId(),
                signalEvent.getId(),
                outcome.getOutcomeStatus(),
                outcome.getLinkedTrade() == null ? null : outcome.getLinkedTrade().getId());

        return SignalIngestionResponse.builder()
                .status("INGESTED")
                .duplicate(false)
                .signalEventId(signalEvent.getId())
                .linkedTradeId(outcome.getLinkedTrade() == null ? null : outcome.getLinkedTrade().getId())
                .externalTradeId(signalEvent.getExternalTradeId())
                .message("Signal close event stored")
                .build();
    }

    private void validateOpenEvent(TradingViewSignalOpenRequest request) {
        if (!"SIGNAL_OPEN".equalsIgnoreCase(request.getEventType())) {
            throw new IllegalArgumentException("Open signal eventType must be SIGNAL_OPEN");
        }
    }

    private void validateCloseEvent(TradingViewSignalCloseRequest request) {
        if (!"SIGNAL_CLOSE".equalsIgnoreCase(request.getEventType())) {
            throw new IllegalArgumentException("Close signal eventType must be SIGNAL_CLOSE");
        }
    }

    private OffsetDateTime toTimestamp(Long timestamp) {
        return OffsetDateTime.ofInstant(java.time.Instant.ofEpochMilli(timestamp), ZoneOffset.UTC);
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
