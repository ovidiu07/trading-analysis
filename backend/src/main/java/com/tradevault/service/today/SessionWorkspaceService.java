package com.tradevault.service.today;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.domain.entity.SessionLevel;
import com.tradevault.domain.entity.SessionNarrative;
import com.tradevault.domain.entity.SessionSetup;
import com.tradevault.domain.entity.TodaySession;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.ContextSnapshotMode;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.SessionSetupReadinessState;
import com.tradevault.domain.enums.SessionSetupStatus;
import com.tradevault.domain.enums.TodaySessionStatus;
import com.tradevault.domain.enums.TradeGrade;
import com.tradevault.domain.enums.TradeSession;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.session.SessionSetupReorderRequest;
import com.tradevault.dto.session.SessionSetupSelectionRequest;
import com.tradevault.dto.session.SessionSetupStatusRequest;
import com.tradevault.dto.session.SessionWorkspaceResponse;
import com.tradevault.dto.session.StartSessionExecutionRequest;
import com.tradevault.dto.session.UpdateSessionWorkspaceRequest;
import com.tradevault.dto.session.UpsertSessionSetupRequest;
import com.tradevault.dto.trade.TradeRequest;
import com.tradevault.repository.SessionLevelRepository;
import com.tradevault.repository.SessionNarrativeRepository;
import com.tradevault.repository.SessionSetupRepository;
import com.tradevault.repository.TodaySessionRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.service.ContextSnapshotService;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.TradeService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SessionWorkspaceService {
    private static final BigDecimal RR_THRESHOLD = new BigDecimal("1.50");
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};
    private static final TypeReference<List<UpsertSessionSetupRequest.Level>> LEVEL_LIST = new TypeReference<>() {};
    private static final Set<SessionSetupStatus> TERMINAL_SETUP_STATUSES = Set.of(
            SessionSetupStatus.INVALIDATED,
            SessionSetupStatus.SKIPPED,
            SessionSetupStatus.ARCHIVED,
            SessionSetupStatus.CLOSED
    );

    private final TodaySessionRepository todaySessionRepository;
    private final SessionSetupRepository sessionSetupRepository;
    private final SessionNarrativeRepository sessionNarrativeRepository;
    private final SessionLevelRepository sessionLevelRepository;
    private final TradeRepository tradeRepository;
    private final CurrentUserService currentUserService;
    private final TradeService tradeService;
    private final ContextSnapshotService contextSnapshotService;
    private final ObjectMapper objectMapper;

    @Transactional
    public SessionWorkspaceResponse getWorkspace() {
        User user = currentUserService.getCurrentUser();
        TodaySession session = todaySessionRepository.findByUser_IdAndSessionDate(user.getId(), resolveSessionDate())
                .orElseGet(() -> createDefaultSession(user));
        session.setLiveModeOnly(Boolean.TRUE);
        ensureLegacySetupBackfill(session, user);
        List<SessionSetup> setups = loadSetups(session, user.getId());
        if (session.getActiveSetupId() == null && !setups.isEmpty()) {
            session.setActiveSetupId(setups.get(0).getId());
        }
        return toWorkspace(todaySessionRepository.save(session), setups, user.getId());
    }

    @Transactional
    public SessionWorkspaceResponse updateSession(UUID sessionId, UpdateSessionWorkspaceRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSession(user, sessionId);
        session.setLiveModeOnly(Boolean.TRUE);

        if (request != null) {
            session.setLockInSession(normalizeSessionName(request.getSessionName()));
            session.setLockInObjective(normalizeObjective(request.getObjective()));
            session.setLockInBias(normalizeBias(request.getBias()));
            session.setLockInBiasReason(normalizeOptionalText(request.getBiasReason(), 220));
            if (request.getDailyMaxLoss() != null) {
                session.setLossLimit(scaleMoney(nonNegative(request.getDailyMaxLoss(), "dailyMaxLoss")));
            }
            if (request.getMaxTrades() != null) {
                if (request.getMaxTrades() <= 0) {
                    throw new IllegalArgumentException("maxTrades must be positive");
                }
                session.setMaxTrades(request.getMaxTrades());
            }
            upsertNarrative(session, user, request.getNarrative());
            if (Boolean.TRUE.equals(request.getLockSession())) {
                List<String> blockers = computeSessionReadiness(session, resolveNarrativeText(session.getId(), user.getId()), loadTrades(user.getId(), session.getId())).blockers();
                if (!blockers.isEmpty()) {
                    throw new IllegalArgumentException("Cannot lock session. Missing: " + String.join(", ", blockers));
                }
                session.setLockInAt(OffsetDateTime.now(ZoneOffset.UTC));
            } else if (Boolean.FALSE.equals(request.getLockSession())) {
                session.setLockInAt(null);
            }
        }

        TodaySession saved = todaySessionRepository.save(session);
        return toWorkspace(saved, loadSetups(saved, user.getId()), user.getId());
    }

    @Transactional
    public SessionWorkspaceResponse createSetup(UUID sessionId, UpsertSessionSetupRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSession(user, sessionId);
        List<SessionSetup> existing = loadSetups(session, user.getId());

        SessionSetup setup = SessionSetup.builder()
                .todaySession(session)
                .user(user)
                .symbol(normalizeSymbol(request == null ? null : request.getSymbol()))
                .direction(normalizeSetupDirection(request == null ? null : request.getDirection()))
                .market(request == null ? null : request.getMarket())
                .tradeSession(request == null ? null : request.getTradeSession())
                .strategyId(request == null ? null : request.getStrategyId())
                .strategyLabel(normalizeOptionalText(request == null ? null : request.getStrategyLabel(), 120))
                .setupTitle(normalizeSetupTitle(request == null ? null : request.getSetupTitle(), request == null ? null : request.getSymbol()))
                .biasAlignment(normalizeOptionalText(request == null ? null : request.getBiasAlignment(), 24))
                .narrativeSnapshotJson(objectMapper.createObjectNode())
                .contextSnapshotJson(toJsonObject(request == null ? null : request.getContext()))
                .strategySnapshotJson(toJsonObject(normalizeStrategySnapshot(request == null ? null : request.getStrategySnapshot(), request == null ? null : request.getStrategyId())))
                .triggerSnapshotJson(toJsonObject(normalizeTrigger(request == null ? null : request.getTrigger())))
                .executionSnapshotJson(toJsonObject(normalizeExecution(request == null ? null : request.getExecution())))
                .reviewSnapshotJson(toJsonObject(normalizeReview(request == null ? null : request.getReview())))
                .levelsJson(toJsonArray(request == null ? null : request.getLevels()))
                .mentorReferenceJson(toJsonObject(request == null ? null : request.getMentorReference()))
                .sortOrder(existing.size())
                .build();

        applyReadiness(setup, session.getLockInAt() != null);
        SessionSetup saved = sessionSetupRepository.save(setup);
        if (session.getActiveSetupId() == null) {
            session.setActiveSetupId(saved.getId());
            todaySessionRepository.save(session);
        }
        return toWorkspace(session, loadSetups(session, user.getId()), user.getId());
    }

    @Transactional
    public SessionWorkspaceResponse updateSetup(UUID sessionId, UUID setupId, UpsertSessionSetupRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSession(user, sessionId);
        SessionSetup setup = requireSetup(sessionId, setupId, user.getId());

        if (request != null) {
            if (request.getSymbol() != null) {
                setup.setSymbol(normalizeSymbol(request.getSymbol()));
            }
            if (request.getDirection() != null) {
                setup.setDirection(normalizeSetupDirection(request.getDirection()));
            }
            setup.setMarket(request.getMarket());
            setup.setTradeSession(request.getTradeSession());
            setup.setStrategyId(request.getStrategyId());
            setup.setStrategyLabel(normalizeOptionalText(request.getStrategyLabel(), 120));
            setup.setSetupTitle(normalizeSetupTitle(request.getSetupTitle(), setup.getSymbol()));
            setup.setBiasAlignment(normalizeOptionalText(request.getBiasAlignment(), 24));
            setup.setNarrativeSnapshotJson(copyNode(setup.getNarrativeSnapshotJson()));
            setup.setContextSnapshotJson(toJsonObject(request.getContext()));
            if (request.getStrategySnapshot() != null || request.getStrategyId() != null) {
                setup.setStrategySnapshotJson(toJsonObject(normalizeStrategySnapshot(request.getStrategySnapshot(), request.getStrategyId())));
            }
            setup.setTriggerSnapshotJson(toJsonObject(normalizeTrigger(request.getTrigger())));
            setup.setExecutionSnapshotJson(toJsonObject(normalizeExecution(request.getExecution())));
            if (request.getReview() != null) {
                setup.setReviewSnapshotJson(toJsonObject(normalizeReview(request.getReview())));
            }
            setup.setLevelsJson(toJsonArray(request.getLevels()));
            setup.setMentorReferenceJson(toJsonObject(request.getMentorReference()));
        }

        applyReadiness(setup, session.getLockInAt() != null);
        sessionSetupRepository.save(setup);
        return toWorkspace(session, loadSetups(session, user.getId()), user.getId());
    }

    @Transactional
    public SessionWorkspaceResponse duplicateSetup(UUID sessionId, UUID setupId) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSession(user, sessionId);
        SessionSetup source = requireSetup(sessionId, setupId, user.getId());
        List<SessionSetup> setups = loadSetups(session, user.getId());

        SessionSetup duplicate = SessionSetup.builder()
                .todaySession(session)
                .user(user)
                .symbol(source.getSymbol())
                .direction(source.getDirection())
                .market(source.getMarket())
                .tradeSession(source.getTradeSession())
                .strategyId(source.getStrategyId())
                .strategyLabel(source.getStrategyLabel())
                .setupTitle(normalizeSetupTitle(source.getSetupTitle() + " Copy", source.getSymbol()))
                .biasAlignment(source.getBiasAlignment())
                .narrativeSnapshotJson(copyNode(source.getNarrativeSnapshotJson()))
                .contextSnapshotJson(copyNode(source.getContextSnapshotJson()))
                .strategySnapshotJson(copyNode(source.getStrategySnapshotJson()))
                .triggerSnapshotJson(copyNode(source.getTriggerSnapshotJson()))
                .executionSnapshotJson(copyNode(source.getExecutionSnapshotJson()))
                .reviewSnapshotJson(copyNode(source.getReviewSnapshotJson()))
                .levelsJson(copyNode(source.getLevelsJson()))
                .mentorReferenceJson(copyNode(source.getMentorReferenceJson()))
                .sortOrder(setups.size())
                .status(SessionSetupStatus.DRAFT)
                .build();

        applyReadiness(duplicate, session.getLockInAt() != null);
        SessionSetup saved = sessionSetupRepository.save(duplicate);
        if (session.getActiveSetupId() == null) {
            session.setActiveSetupId(saved.getId());
            todaySessionRepository.save(session);
        }
        return toWorkspace(session, loadSetups(session, user.getId()), user.getId());
    }

    @Transactional
    public SessionWorkspaceResponse reorderSetups(UUID sessionId, SessionSetupReorderRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSession(user, sessionId);
        List<SessionSetup> setups = loadSetups(session, user.getId());
        if (request == null || request.getSetupIds() == null || request.getSetupIds().isEmpty()) {
            return toWorkspace(session, setups, user.getId());
        }

        Map<UUID, SessionSetup> byId = new LinkedHashMap<>();
        for (SessionSetup setup : setups) {
            byId.put(setup.getId(), setup);
        }

        int order = 0;
        Set<UUID> seen = new LinkedHashSet<>();
        for (UUID id : request.getSetupIds()) {
            SessionSetup setup = byId.get(id);
            if (setup == null || !seen.add(id)) {
                continue;
            }
            setup.setSortOrder(order++);
        }
        for (SessionSetup setup : setups) {
            if (seen.add(setup.getId())) {
                setup.setSortOrder(order++);
            }
        }

        sessionSetupRepository.saveAll(setups);
        return toWorkspace(session, loadSetups(session, user.getId()), user.getId());
    }

    @Transactional
    public SessionWorkspaceResponse updateSetupStatus(UUID sessionId, UUID setupId, SessionSetupStatusRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSession(user, sessionId);
        SessionSetup setup = requireSetup(sessionId, setupId, user.getId());
        SessionSetupStatus status = request == null ? null : request.getStatus();
        if (status == null) {
            throw new IllegalArgumentException("Setup status is required");
        }

        ReadinessComputation readiness = computeSetupReadiness(setup, session.getLockInAt() != null);
        if (status == SessionSetupStatus.READY && !readiness.readyBlockers().isEmpty()) {
            throw new IllegalArgumentException("Cannot mark ready. Missing: " + String.join(", ", readiness.readyBlockers()));
        }
        if (status == SessionSetupStatus.TRIGGERED && !readiness.readyBlockers().isEmpty()) {
            throw new IllegalArgumentException("Cannot mark triggered. Missing: " + String.join(", ", readiness.readyBlockers()));
        }

        setup.setStatus(status);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if (status == SessionSetupStatus.INVALIDATED) {
            setup.setInvalidatedAt(now);
        } else if (status == SessionSetupStatus.SKIPPED) {
            setup.setSkippedAt(now);
        } else if (status == SessionSetupStatus.ARCHIVED) {
            setup.setArchivedAt(now);
        } else if (status == SessionSetupStatus.CLOSED) {
            setup.setClosedAt(now);
        }
        applyReadiness(setup, session.getLockInAt() != null);
        sessionSetupRepository.save(setup);
        return toWorkspace(session, loadSetups(session, user.getId()), user.getId());
    }

    @Transactional
    public SessionWorkspaceResponse selectActiveSetup(UUID sessionId, SessionSetupSelectionRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSession(user, sessionId);
        UUID setupId = request == null ? null : request.getSetupId();
        if (setupId != null) {
            requireSetup(sessionId, setupId, user.getId());
        }
        session.setActiveSetupId(setupId);
        todaySessionRepository.save(session);
        return toWorkspace(session, loadSetups(session, user.getId()), user.getId());
    }

    @Transactional
    public SessionWorkspaceResponse startTrade(UUID sessionId, UUID setupId, StartSessionExecutionRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSession(user, sessionId);
        SessionSetup setup = requireSetup(sessionId, setupId, user.getId());
        List<Trade> sessionTrades = loadTrades(user.getId(), session.getId());

        if (tradeRepository.findFirstByUser_IdAndSessionIdAndStatusOrderByOpenedAtDescCreatedAtDesc(
                user.getId(), session.getId(), TradeStatus.OPEN).isPresent()) {
            throw new IllegalArgumentException("An active trade already exists for this session");
        }

        long closedTradesCount = sessionTrades.stream().filter(item -> item.getStatus() == TradeStatus.CLOSED).count();
        if (session.getMaxTrades() != null && closedTradesCount >= session.getMaxTrades()) {
            throw new IllegalArgumentException("Session trade limit has already been reached");
        }

        BigDecimal realized = safeMoney(tradeRepository.sumNetPnlByUserAndSessionAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED));
        if (session.getLossLimit() != null
                && session.getLossLimit().compareTo(BigDecimal.ZERO) > 0
                && realized.compareTo(session.getLossLimit().negate()) <= 0) {
            throw new IllegalArgumentException("Daily max loss has already been reached");
        }

        ReadinessComputation readiness = computeSetupReadiness(setup, session.getLockInAt() != null);
        if (!readiness.startTradeBlockers().isEmpty()) {
            throw new IllegalArgumentException("Cannot start trade. Missing: " + String.join(", ", readiness.startTradeBlockers()));
        }
        if (TERMINAL_SETUP_STATUSES.contains(setup.getStatus())) {
            throw new IllegalArgumentException("This setup is no longer actionable");
        }
        if (!isDirectionDecided(setup.getDirection())) {
            throw new IllegalArgumentException("Direction must be decided before starting a trade");
        }

        UpsertSessionSetupRequest.Context context = readNode(setup.getContextSnapshotJson(), UpsertSessionSetupRequest.Context.class, new UpsertSessionSetupRequest.Context());
        UpsertSessionSetupRequest.Trigger trigger = readNode(setup.getTriggerSnapshotJson(), UpsertSessionSetupRequest.Trigger.class, new UpsertSessionSetupRequest.Trigger());
        UpsertSessionSetupRequest.Execution execution = normalizeExecution(
                readNode(setup.getExecutionSnapshotJson(), UpsertSessionSetupRequest.Execution.class, new UpsertSessionSetupRequest.Execution())
        );
        UpsertSessionSetupRequest.Ticket executionTicket = resolveExecutionTicket(execution, request == null ? null : request.getExecutionId());
        List<UpsertSessionSetupRequest.Level> levels = readLevels(setup.getLevelsJson());

        ArrayNode prereqs = objectMapper.createArrayNode();
        prereqs.add(checklistItem("Symbol defined", setup.getSymbol() != null));
        prereqs.add(checklistItem("Direction defined", isDirectionDecided(setup.getDirection())));
        prereqs.add(checklistItem("Trade session defined", setup.getTradeSession() != null));
        prereqs.add(checklistItem("Invalidation idea", hasText(firstNonBlank(executionTicket.getInvalidation(), context.getInvalidationIdea()))));
        prereqs.add(checklistItem("Liquidity idea", hasText(context.getLiquidityNotes()) || !levels.isEmpty()));

        ArrayNode triggers = objectMapper.createArrayNode();
        triggers.add(checklistItem("Sweep identified", Boolean.TRUE.equals(trigger.getSweepIdentified())));
        triggers.add(checklistItem("Displacement confirmed", Boolean.TRUE.equals(trigger.getDisplacementConfirmed())));
        triggers.add(checklistItem("Structure confirmed", Boolean.TRUE.equals(trigger.getStructureConfirmed())));
        triggers.add(checklistItem("Entry zone defined", hasText(trigger.getEntryZone())));
        triggers.add(checklistItem("RR threshold met", trigger.getRrEstimate() != null && trigger.getRrEstimate().compareTo(RR_THRESHOLD) >= 0));

        ObjectNode lockInSnapshot = objectMapper.createObjectNode();
        lockInSnapshot.put("sessionName", firstNonBlank(session.getLockInSession(), setup.getTradeSession() == null ? null : setup.getTradeSession().name()));
        lockInSnapshot.put("objective", session.getLockInObjective());
        lockInSnapshot.put("bias", session.getLockInBias());
        lockInSnapshot.put("biasReason", session.getLockInBiasReason());
        lockInSnapshot.put("narrative", resolveNarrativeText(session.getId(), user.getId()));

        ObjectNode qualityInputs = objectMapper.createObjectNode();
        qualityInputs.put("workspaceReadinessScore", readiness.score());
        qualityInputs.put("sessionLocked", session.getLockInAt() != null);
        qualityInputs.put("setupStatus", setup.getStatus().name());
        qualityInputs.put("rrAtEntry", readiness.rrEstimate() == null ? BigDecimal.ZERO : readiness.rrEstimate());

        var snapshot = contextSnapshotService.createSnapshot(
                user,
                ContextSnapshotMode.LIVE,
                setup.getStrategyId(),
                null,
                prereqs.toString(),
                null,
                triggers.toString(),
                null,
                copyNode(setup.getLevelsJson()),
                lockInSnapshot,
                readiness.rrEstimate(),
                qualityInputs
        );

        TradeRequest tradeRequest = new TradeRequest();
        tradeRequest.setSymbol(setup.getSymbol());
        tradeRequest.setMarket(setup.getMarket() == null ? Market.FOREX : setup.getMarket());
        tradeRequest.setDirection(setup.getDirection());
        tradeRequest.setStatus(TradeStatus.OPEN);
        tradeRequest.setOpenedAt(OffsetDateTime.now(ZoneOffset.UTC));
        tradeRequest.setQuantity(executionTicket.getQuantity());
        tradeRequest.setEntryPrice(executionTicket.getEntryPrice());
        tradeRequest.setStopLossPrice(executionTicket.getStopLossPrice());
        tradeRequest.setTakeProfitPrice(executionTicket.getTakeProfitPrice());
        tradeRequest.setRiskAmount(executionTicket.getRiskAmount());
        tradeRequest.setSetup(setup.getSetupTitle());
        tradeRequest.setStrategyId(setup.getStrategyId());
        tradeRequest.setStrategyTag(setup.getStrategyLabel());
        tradeRequest.setContextSnapshotId(snapshot.getId());
        tradeRequest.setStrategyVersionId(snapshot.getStrategyVersionId());
        tradeRequest.setSetupGrade(deriveTradeGrade(readiness.score()));
        tradeRequest.setSession(resolveTradeSession(session, setup));
        tradeRequest.setSessionId(session.getId());
        tradeRequest.setSetupId(setup.getId());
        tradeRequest.setInitialNotes(normalizeOptionalText(executionTicket.getInitialNotes(), 2000));
        tradeRequest.setEntryInvalidation(normalizeOptionalText(firstNonBlank(executionTicket.getInvalidation(), context.getInvalidationIdea()), 1000));
        tradeRequest.setNarrativeSnapshotJson(buildNarrativeSnapshot(session, setup, context, trigger));
        tradeRequest.setSweepConfirmed(trigger.getSweepIdentified());
        tradeRequest.setDisplacementConfirmed(trigger.getDisplacementConfirmed());
        tradeRequest.setMssConfirmed(trigger.getStructureConfirmed());
        tradeRequest.setLevelExpectation(normalizeOptionalText(context.getLiquidityNotes(), 48));
        tradeRequest.setProfileCurrency(normalizeOptionalText(user.getBaseCurrency(), 16));

        var tradeResponse = tradeService.create(tradeRequest);
        markExecutionStarted(execution, executionTicket.getId(), tradeResponse.getId(), tradeResponse.getOpenedAt());
        appendReviewTimeline(
                setup,
                timelineEntry(
                        "execution_started",
                        "Execution started",
                        executionTicket.getLabel(),
                        executionTicket.getId(),
                        tradeResponse.getId(),
                        tradeResponse.getOpenedAt() == null ? OffsetDateTime.now(ZoneOffset.UTC) : tradeResponse.getOpenedAt()
                )
        );
        setup.setLinkedTradeId(tradeResponse.getId());
        setup.setExecutionSnapshotJson(toJsonObject(execution));
        setup.setStatus(SessionSetupStatus.EXECUTED);
        setup.setExecutedAt(tradeResponse.getOpenedAt() == null ? OffsetDateTime.now(ZoneOffset.UTC) : tradeResponse.getOpenedAt());
        applyReadiness(setup, true);
        session.setActiveSetupId(setup.getId());
        sessionSetupRepository.save(setup);
        todaySessionRepository.save(session);
        return toWorkspace(session, loadSetups(session, user.getId()), user.getId());
    }

    private TodaySession createDefaultSession(User user) {
        TodaySession session = TodaySession.builder()
                .user(user)
                .sessionDate(resolveSessionDate())
                .profitTarget(BigDecimal.ZERO)
                .lossLimit(BigDecimal.ZERO)
                .maxTrades(1)
                .status(TodaySessionStatus.ACTIVE)
                .liveModeOnly(Boolean.TRUE)
                .build();
        return todaySessionRepository.save(session);
    }

    private SessionWorkspaceResponse toWorkspace(TodaySession session, List<SessionSetup> setups, UUID userId) {
        List<Trade> sessionTrades = loadTrades(userId, session.getId());
        String narrative = resolveNarrativeText(session.getId(), userId);
        SessionReadiness sessionReadiness = computeSessionReadiness(session, narrative, sessionTrades);
        Map<UUID, Trade> tradesById = new LinkedHashMap<>();
        for (Trade trade : sessionTrades) {
            tradesById.put(trade.getId(), trade);
        }

        List<SessionSetup> orderedSetups = new ArrayList<>(setups);
        orderedSetups.sort(Comparator.comparing(SessionSetup::getSortOrder).thenComparing(SessionSetup::getCreatedAt));

        List<SessionWorkspaceResponse.SetupItem> setupItems = orderedSetups.stream()
                .map(setup -> toSetupItem(setup, session.getLockInAt() != null, tradesById.get(setup.getLinkedTradeId())))
                .toList();

        long activeSetupCount = orderedSetups.stream()
                .filter(item -> !TERMINAL_SETUP_STATUSES.contains(item.getStatus()) && item.getStatus() != SessionSetupStatus.EXECUTED)
                .count();
        BigDecimal riskUsed = sessionTrades.stream()
                .map(Trade::getRiskAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal realizedPnl = sessionTrades.stream()
                .filter(item -> item.getStatus() == TradeStatus.CLOSED)
                .map(trade -> trade.getPnlProfileCurrency() != null ? trade.getPnlProfileCurrency() : trade.getPnlNet())
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<String> warnings = new ArrayList<>();
        if (session.getLockInAt() == null) {
            warnings.add("Session is not locked");
        }
        if (tradeRepository.findFirstByUser_IdAndSessionIdAndStatusOrderByOpenedAtDescCreatedAtDesc(userId, session.getId(), TradeStatus.OPEN).isPresent()) {
            warnings.add("A live trade is already open for this session");
        }
        if (session.getMaxTrades() != null && sessionTrades.stream().filter(item -> item.getStatus() == TradeStatus.CLOSED).count() >= session.getMaxTrades()) {
            warnings.add("Session max trades reached");
        }
        if (session.getLossLimit() != null
                && session.getLossLimit().compareTo(BigDecimal.ZERO) > 0
                && realizedPnl.compareTo(session.getLossLimit().negate()) <= 0) {
            warnings.add("Daily max loss reached");
        }

        return SessionWorkspaceResponse.builder()
                .session(SessionWorkspaceResponse.SessionSummary.builder()
                        .id(session.getId())
                        .tradingDate(session.getSessionDate())
                        .sessionName(session.getLockInSession())
                        .objective(session.getLockInObjective())
                        .bias(session.getLockInBias())
                        .biasReason(session.getLockInBiasReason())
                        .narrative(narrative)
                        .dailyMaxLoss(session.getLossLimit())
                        .maxTrades(session.getMaxTrades())
                        .liveModeOnly(Boolean.TRUE.equals(session.getLiveModeOnly()))
                        .lockedInAt(session.getLockInAt())
                        .status(session.getStatus())
                        .quickStats(SessionWorkspaceResponse.QuickStats.builder()
                                .maxLoss(session.getLossLimit())
                                .riskUsed(scaleMoney(riskUsed))
                                .tradesTaken(sessionTrades.size())
                                .activeSetupCount(activeSetupCount)
                                .realizedPnl(scaleMoney(realizedPnl))
                                .build())
                        .readiness(sessionReadiness.readiness())
                        .warnings(warnings)
                        .build())
                .activeSetupId(session.getActiveSetupId())
                .setups(setupItems)
                .activity(sessionTrades.stream().map(trade -> toActivityTrade(trade, orderedSetups)).toList())
                .build();
    }

    private SessionWorkspaceResponse.SetupItem toSetupItem(SessionSetup setup, boolean sessionLocked, Trade linkedTrade) {
        ReadinessComputation readiness = computeSetupReadiness(setup, sessionLocked);
        UpsertSessionSetupRequest.Context context = readNode(setup.getContextSnapshotJson(), UpsertSessionSetupRequest.Context.class, new UpsertSessionSetupRequest.Context());
        UpsertSessionSetupRequest.Trigger trigger = readNode(setup.getTriggerSnapshotJson(), UpsertSessionSetupRequest.Trigger.class, new UpsertSessionSetupRequest.Trigger());
        UpsertSessionSetupRequest.Execution execution = normalizeExecution(
                readNode(setup.getExecutionSnapshotJson(), UpsertSessionSetupRequest.Execution.class, new UpsertSessionSetupRequest.Execution())
        );
        UpsertSessionSetupRequest.Ticket activeExecution = resolveExecutionTicket(execution, execution.getActiveExecutionId());

        SessionSetupStatus displayStatus = setup.getStatus();
        if (linkedTrade != null && linkedTrade.getStatus() == TradeStatus.CLOSED && setup.getStatus() == SessionSetupStatus.EXECUTED) {
            displayStatus = SessionSetupStatus.CLOSED;
        }

        return SessionWorkspaceResponse.SetupItem.builder()
                .id(setup.getId())
                .symbol(setup.getSymbol())
                .direction(setup.getDirection())
                .market(setup.getMarket())
                .tradeSession(setup.getTradeSession())
                .strategyId(setup.getStrategyId())
                .strategyLabel(setup.getStrategyLabel())
                .setupTitle(setup.getSetupTitle())
                .biasAlignment(setup.getBiasAlignment())
                .status(displayStatus)
                .linkedTradeId(setup.getLinkedTradeId())
                .readiness(readiness.readiness())
                .context(SessionWorkspaceResponse.SetupContext.builder()
                        .narrative(normalizeOptionalText(context.getNarrative(), 600))
                        .liquidityNotes(normalizeOptionalText(context.getLiquidityNotes(), 400))
                        .invalidationIdea(normalizeOptionalText(context.getInvalidationIdea(), 400))
                        .newsSafety(normalizeOptionalText(context.getNewsSafety(), 80))
                        .notes(normalizeOptionalText(context.getNotes(), 600))
                        .build())
                .strategySnapshot(toStrategySnapshot(setup.getStrategySnapshotJson(), setup.getStrategyId()))
                .trigger(SessionWorkspaceResponse.SetupTrigger.builder()
                        .sweepIdentified(trigger.getSweepIdentified())
                        .displacementConfirmed(trigger.getDisplacementConfirmed())
                        .structureConfirmed(trigger.getStructureConfirmed())
                        .confirmationModel(normalizeOptionalText(trigger.getConfirmationModel(), 120))
                        .sweepType(normalizeOptionalText(trigger.getSweepType(), 48))
                        .liquiditySource(normalizeOptionalText(trigger.getLiquiditySource(), 80))
                        .confirmationTimeframe(normalizeOptionalText(trigger.getConfirmationTimeframe(), 24))
                        .displacementRule(normalizeOptionalText(trigger.getDisplacementRule(), 240))
                        .structureRule(normalizeOptionalText(trigger.getStructureRule(), 240))
                        .fvgRequirement(normalizeOptionalText(trigger.getFvgRequirement(), 120))
                        .entryModel(normalizeOptionalText(trigger.getEntryModel(), 80))
                        .entryZone(normalizeOptionalText(trigger.getEntryZone(), 160))
                        .rrEstimate(scaleRatio(trigger.getRrEstimate()))
                        .rrMinimum(scaleRatio(trigger.getRrMinimum()))
                        .confluenceRequirement(normalizeOptionalText(trigger.getConfluenceRequirement(), 240))
                        .newsRestriction(normalizeOptionalText(trigger.getNewsRestriction(), 140))
                        .sessionRestriction(normalizeOptionalText(trigger.getSessionRestriction(), 140))
                        .invalidationThreshold(normalizeOptionalText(trigger.getInvalidationThreshold(), 140))
                        .notes(normalizeOptionalText(trigger.getNotes(), 400))
                        .build())
                .execution(SessionWorkspaceResponse.SetupExecution.builder()
                        .activeExecutionId(activeExecution == null ? execution.getActiveExecutionId() : activeExecution.getId())
                        .entryPrice(scalePrice(activeExecution == null ? execution.getEntryPrice() : activeExecution.getEntryPrice()))
                        .stopLossPrice(scalePrice(activeExecution == null ? execution.getStopLossPrice() : activeExecution.getStopLossPrice()))
                        .takeProfitPrice(scalePrice(activeExecution == null ? execution.getTakeProfitPrice() : activeExecution.getTakeProfitPrice()))
                        .riskAmount(scaleMoney(activeExecution == null ? execution.getRiskAmount() : activeExecution.getRiskAmount()))
                        .quantity(scaleQuantity(activeExecution == null ? execution.getQuantity() : activeExecution.getQuantity()))
                        .invalidation(normalizeOptionalText(activeExecution == null ? execution.getInvalidation() : activeExecution.getInvalidation(), 400))
                        .whyWrong(normalizeOptionalText(activeExecution == null ? execution.getWhyWrong() : activeExecution.getWhyWrong(), 400))
                        .initialNotes(normalizeOptionalText(activeExecution == null ? execution.getInitialNotes() : activeExecution.getInitialNotes(), 2000))
                        .build())
                .executions(SessionWorkspaceResponse.SetupExecutionWorkspace.builder()
                        .activeExecutionId(execution.getActiveExecutionId())
                        .tickets(toExecutionTickets(execution.getTickets()))
                        .build())
                .review(toReview(setup.getReviewSnapshotJson()))
                .levels(toLevelDtos(setup.getLevelsJson()))
                .mentorReference(toMentorReference(setup.getMentorReferenceJson()))
                .sortOrder(setup.getSortOrder())
                .executedAt(setup.getExecutedAt())
                .invalidatedAt(setup.getInvalidatedAt())
                .skippedAt(setup.getSkippedAt())
                .archivedAt(setup.getArchivedAt())
                .closedAt(setup.getClosedAt())
                .createdAt(setup.getCreatedAt())
                .updatedAt(setup.getUpdatedAt())
                .build();
    }

    private SessionWorkspaceResponse.ActivityTrade toActivityTrade(Trade trade, List<SessionSetup> setups) {
        SessionSetup linkedSetup = setups.stream()
                .filter(item -> Objects.equals(item.getId(), trade.getSetupId()))
                .findFirst()
                .orElse(null);

        return SessionWorkspaceResponse.ActivityTrade.builder()
                .tradeId(trade.getId())
                .setupId(trade.getSetupId())
                .setupTitle(linkedSetup == null ? trade.getSetup() : linkedSetup.getSetupTitle())
                .symbol(trade.getSymbol())
                .direction(trade.getDirection())
                .tradeSession(trade.getSession())
                .status(trade.getStatus() == null ? null : trade.getStatus().name())
                .entryPrice(scalePrice(trade.getEntryPrice()))
                .exitPrice(scalePrice(trade.getExitPrice()))
                .riskAmount(scaleMoney(trade.getRiskAmount()))
                .rMultiple(scaleRatio(trade.getRMultiple()))
                .pnlNet(scaleMoney(trade.getPnlProfileCurrency() != null ? trade.getPnlProfileCurrency() : trade.getPnlNet()))
                .openedAt(trade.getOpenedAt())
                .closedAt(trade.getClosedAt())
                .build();
    }

    private List<SessionWorkspaceResponse.SetupLevel> toLevelDtos(JsonNode levelsJson) {
        List<UpsertSessionSetupRequest.Level> levels = readLevels(levelsJson);
        return levels.stream()
                .map(level -> SessionWorkspaceResponse.SetupLevel.builder()
                        .label(normalizeOptionalText(level.getLabel(), 80))
                        .price(scalePrice(level.getPrice()))
                        .source(normalizeOptionalText(level.getSource(), 24))
                        .notes(normalizeOptionalText(level.getNotes(), 220))
                        .build())
                .toList();
    }

    private SessionWorkspaceResponse.MentorReference toMentorReference(JsonNode mentorJson) {
        UpsertSessionSetupRequest.Mentor mentor = readNode(mentorJson, UpsertSessionSetupRequest.Mentor.class, null);
        if (mentor == null) {
            return null;
        }
        return SessionWorkspaceResponse.MentorReference.builder()
                .planTitle(normalizeOptionalText(mentor.getPlanTitle(), 160))
                .symbol(normalizeOptionalText(mentor.getSymbol(), 64))
                .bias(normalizeOptionalText(mentor.getBias(), 80))
                .preferredScenario(normalizeOptionalText(mentor.getPreferredScenario(), 320))
                .invalidation(normalizeOptionalText(mentor.getInvalidation(), 320))
                .noTradeWarning(normalizeOptionalText(mentor.getNoTradeWarning(), 320))
                .keyLevels(mentor.getKeyLevels() == null ? List.of() : mentor.getKeyLevels().stream().map(item -> normalizeOptionalText(item, 80)).filter(Objects::nonNull).toList())
                .build();
    }

    private SessionReadiness computeSessionReadiness(TodaySession session, String narrative, List<Trade> sessionTrades) {
        List<String> planMissing = new ArrayList<>();
        if (!hasText(session.getLockInSession())) {
            planMissing.add("session");
        }
        if (!hasText(session.getLockInBias())) {
            planMissing.add("bias");
        }

        List<String> riskMissing = new ArrayList<>();
        if (session.getLossLimit() == null || session.getLossLimit().compareTo(BigDecimal.ZERO) <= 0) {
            riskMissing.add("daily max loss");
        }
        if (session.getMaxTrades() == null || session.getMaxTrades() <= 0) {
            riskMissing.add("max trades");
        }

        List<String> narrativeMissing = hasText(narrative) ? List.of() : List.of("session narrative");
        List<String> lockMissing = session.getLockInAt() == null ? List.of("lock session") : List.of();

        int completed = 0;
        if (planMissing.isEmpty()) completed++;
        if (riskMissing.isEmpty()) completed++;
        if (narrativeMissing.isEmpty()) completed++;
        if (lockMissing.isEmpty()) completed++;
        int score = (int) Math.round((completed / 4.0d) * 100);

        List<String> blockers = new ArrayList<>();
        blockers.addAll(planMissing);
        blockers.addAll(riskMissing);
        blockers.addAll(narrativeMissing);
        blockers.addAll(lockMissing);

        if (tradeRepository.findFirstByUser_IdAndSessionIdAndStatusOrderByOpenedAtDescCreatedAtDesc(
                session.getUser().getId(), session.getId(), TradeStatus.OPEN).isPresent()) {
            blockers.add("close the active live trade");
        }
        if (session.getMaxTrades() != null && sessionTrades.stream().filter(item -> item.getStatus() == TradeStatus.CLOSED).count() >= session.getMaxTrades()) {
            blockers.add("session max trades reached");
        }

        SessionSetupReadinessState state = blockers.isEmpty() ? SessionSetupReadinessState.READY : SessionSetupReadinessState.INCOMPLETE;
        String summary = blockers.isEmpty()
                ? "Session is locked and ready for live execution."
                : "Missing: " + String.join(", ", blockers);

        List<SessionWorkspaceResponse.ReadinessStep> steps = List.of(
                buildReadinessStep("plan", "Plan", planMissing),
                buildReadinessStep("risk", "Risk", riskMissing),
                buildReadinessStep("narrative", "Narrative", narrativeMissing),
                buildReadinessStep("lock", "Lock-in", lockMissing)
        );

        return new SessionReadiness(SessionWorkspaceResponse.Readiness.builder()
                .score(score)
                .state(state)
                .summary(summary)
                .missingItems(blockers)
                .blockers(blockers)
                .steps(steps)
                .build(), blockers);
    }

    private ReadinessComputation computeSetupReadiness(SessionSetup setup, boolean sessionLocked) {
        UpsertSessionSetupRequest.Context context = readNode(setup.getContextSnapshotJson(), UpsertSessionSetupRequest.Context.class, new UpsertSessionSetupRequest.Context());
        UpsertSessionSetupRequest.Trigger trigger = normalizeTrigger(
                readNode(setup.getTriggerSnapshotJson(), UpsertSessionSetupRequest.Trigger.class, new UpsertSessionSetupRequest.Trigger())
        );
        UpsertSessionSetupRequest.Execution execution = normalizeExecution(
                readNode(setup.getExecutionSnapshotJson(), UpsertSessionSetupRequest.Execution.class, new UpsertSessionSetupRequest.Execution())
        );
        UpsertSessionSetupRequest.Ticket activeExecution = resolveExecutionTicket(execution, execution.getActiveExecutionId());
        List<UpsertSessionSetupRequest.Level> levels = readLevels(setup.getLevelsJson());

        BigDecimal rrEstimate = trigger.getRrEstimate();
        if (rrEstimate == null) {
            rrEstimate = computeRr(
                    activeExecution == null ? execution.getEntryPrice() : activeExecution.getEntryPrice(),
                    activeExecution == null ? execution.getStopLossPrice() : activeExecution.getStopLossPrice(),
                    activeExecution == null ? execution.getTakeProfitPrice() : activeExecution.getTakeProfitPrice(),
                    setup.getDirection()
            );
        }

        List<String> contextMissing = new ArrayList<>();
        if (!hasText(setup.getSymbol())) {
            contextMissing.add("symbol");
        }
        if (!isDirectionDecided(setup.getDirection())) {
            contextMissing.add("direction");
        }
        if (setup.getTradeSession() == null) {
            contextMissing.add("session");
        }
        if (!hasText(firstNonBlank(context.getInvalidationIdea(), execution.getInvalidation()))) {
            contextMissing.add("invalidation concept");
        }
        if (!hasText(context.getLiquidityNotes()) && levels.isEmpty()) {
            contextMissing.add("key liquidity idea");
        }

        List<String> triggerMissing = new ArrayList<>();
        if (!Boolean.TRUE.equals(trigger.getSweepIdentified())) {
            triggerMissing.add("sweep");
        }
        if (!Boolean.TRUE.equals(trigger.getDisplacementConfirmed())) {
            triggerMissing.add("displacement");
        }
        if (!Boolean.TRUE.equals(trigger.getStructureConfirmed())) {
            triggerMissing.add("structure confirmation");
        }
        if (!hasText(firstNonBlank(trigger.getConfirmationModel(), buildConfirmationModel(trigger)))) {
            triggerMissing.add("confirmation model");
        }
        if (!hasText(firstNonBlank(trigger.getEntryZone(), trigger.getEntryModel()))) {
            triggerMissing.add("entry zone");
        }
        if (rrEstimate == null || rrEstimate.compareTo(RR_THRESHOLD) < 0) {
            triggerMissing.add("RR >= 1.5");
        }

        List<String> executionMissing = new ArrayList<>();
        BigDecimal entryPrice = activeExecution == null ? execution.getEntryPrice() : activeExecution.getEntryPrice();
        BigDecimal stopLossPrice = activeExecution == null ? execution.getStopLossPrice() : activeExecution.getStopLossPrice();
        BigDecimal takeProfitPrice = activeExecution == null ? execution.getTakeProfitPrice() : activeExecution.getTakeProfitPrice();
        BigDecimal riskAmount = activeExecution == null ? execution.getRiskAmount() : activeExecution.getRiskAmount();
        BigDecimal quantity = activeExecution == null ? execution.getQuantity() : activeExecution.getQuantity();
        String invalidation = activeExecution == null ? execution.getInvalidation() : activeExecution.getInvalidation();

        if (entryPrice == null || entryPrice.compareTo(BigDecimal.ZERO) <= 0) {
            executionMissing.add("entry");
        }
        if (stopLossPrice == null || stopLossPrice.compareTo(BigDecimal.ZERO) <= 0) {
            executionMissing.add("stop loss");
        }
        if (takeProfitPrice == null || takeProfitPrice.compareTo(BigDecimal.ZERO) <= 0) {
            executionMissing.add("take profit");
        }
        if ((riskAmount == null || riskAmount.compareTo(BigDecimal.ZERO) <= 0)
                && (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0)) {
            executionMissing.add("risk amount or quantity");
        }
        if (!hasText(firstNonBlank(invalidation, context.getInvalidationIdea()))) {
            executionMissing.add("invalidation");
        }

        int totalChecks = 16;
        int completedChecks = totalChecks - contextMissing.size() - triggerMissing.size() - executionMissing.size();
        int score = Math.max(0, Math.min(100, (int) Math.round((completedChecks / (double) totalChecks) * 100)));

        List<String> readyBlockers = new ArrayList<>();
        readyBlockers.addAll(contextMissing);
        readyBlockers.addAll(triggerMissing);

        List<String> startTradeBlockers = new ArrayList<>(readyBlockers);
        startTradeBlockers.addAll(executionMissing);
        if (!sessionLocked) {
            startTradeBlockers.add("session lock-in");
        }

        SessionSetupReadinessState state;
        List<String> blockers;
        if (TERMINAL_SETUP_STATUSES.contains(setup.getStatus())) {
            state = SessionSetupReadinessState.BLOCKED;
            blockers = List.of(humanizeStatus(setup.getStatus()));
        } else if (startTradeBlockers.isEmpty()) {
            state = SessionSetupReadinessState.READY;
            blockers = List.of();
        } else {
            state = SessionSetupReadinessState.INCOMPLETE;
            blockers = startTradeBlockers;
        }

        String summary = blockers.isEmpty()
                ? "Ready to execute."
                : "Missing: " + String.join(", ", blockers);

        List<SessionWorkspaceResponse.ReadinessStep> steps = List.of(
                buildReadinessStep("context", "Context", contextMissing),
                buildReadinessStep("trigger", "Trigger", triggerMissing),
                buildReadinessStep("execution", "Execution", executionMissing)
        );

        SessionWorkspaceResponse.Readiness readiness = SessionWorkspaceResponse.Readiness.builder()
                .score(score)
                .state(state)
                .summary(summary)
                .missingItems(new ArrayList<>(new LinkedHashSet<>(blockers)))
                .blockers(new ArrayList<>(new LinkedHashSet<>(startTradeBlockers)))
                .steps(steps)
                .build();

        return new ReadinessComputation(
                readiness,
                score,
                readyBlockers.isEmpty(),
                triggerMissing.isEmpty(),
                executionMissing.isEmpty(),
                new ArrayList<>(new LinkedHashSet<>(readyBlockers)),
                new ArrayList<>(new LinkedHashSet<>(startTradeBlockers)),
                rrEstimate
        );
    }

    private SessionWorkspaceResponse.ReadinessStep buildReadinessStep(String key, String label, List<String> missing) {
        SessionSetupReadinessState state = missing.isEmpty() ? SessionSetupReadinessState.READY : SessionSetupReadinessState.INCOMPLETE;
        return SessionWorkspaceResponse.ReadinessStep.builder()
                .key(key)
                .label(label)
                .state(state)
                .summary(missing.isEmpty() ? "Ready" : "Missing: " + String.join(", ", missing))
                .missingItems(missing)
                .build();
    }

    private void applyReadiness(SessionSetup setup, boolean sessionLocked) {
        ReadinessComputation readiness = computeSetupReadiness(setup, sessionLocked);
        setup.setReadinessScore(readiness.score());
        setup.setReadinessState(readiness.readiness().getState());
    }

    private UpsertSessionSetupRequest.Trigger normalizeTrigger(UpsertSessionSetupRequest.Trigger trigger) {
        UpsertSessionSetupRequest.Trigger normalized = new UpsertSessionSetupRequest.Trigger();
        if (trigger == null) {
            return normalized;
        }
        normalized.setSweepIdentified(trigger.getSweepIdentified());
        normalized.setDisplacementConfirmed(trigger.getDisplacementConfirmed());
        normalized.setStructureConfirmed(trigger.getStructureConfirmed());
        normalized.setConfirmationModel(normalizeOptionalText(trigger.getConfirmationModel(), 120));
        normalized.setSweepType(normalizeOptionalText(trigger.getSweepType(), 48));
        normalized.setLiquiditySource(normalizeOptionalText(trigger.getLiquiditySource(), 80));
        normalized.setConfirmationTimeframe(normalizeOptionalText(trigger.getConfirmationTimeframe(), 24));
        normalized.setDisplacementRule(normalizeOptionalText(trigger.getDisplacementRule(), 240));
        normalized.setStructureRule(normalizeOptionalText(trigger.getStructureRule(), 240));
        normalized.setFvgRequirement(normalizeOptionalText(trigger.getFvgRequirement(), 120));
        normalized.setEntryModel(normalizeOptionalText(trigger.getEntryModel(), 80));
        normalized.setEntryZone(normalizeOptionalText(trigger.getEntryZone(), 160));
        normalized.setRrEstimate(scaleRatio(trigger.getRrEstimate()));
        normalized.setRrMinimum(scaleRatio(trigger.getRrMinimum()));
        normalized.setConfluenceRequirement(normalizeOptionalText(trigger.getConfluenceRequirement(), 240));
        normalized.setNewsRestriction(normalizeOptionalText(trigger.getNewsRestriction(), 140));
        normalized.setSessionRestriction(normalizeOptionalText(trigger.getSessionRestriction(), 140));
        normalized.setInvalidationThreshold(normalizeOptionalText(trigger.getInvalidationThreshold(), 140));
        normalized.setNotes(normalizeOptionalText(trigger.getNotes(), 400));
        return normalized;
    }

    private String buildConfirmationModel(UpsertSessionSetupRequest.Trigger trigger) {
        if (trigger == null) {
            return null;
        }
        List<String> parts = new ArrayList<>();
        if (hasText(trigger.getSweepType())) {
            parts.add(trigger.getSweepType().trim());
        }
        if (hasText(trigger.getConfirmationTimeframe())) {
            parts.add(trigger.getConfirmationTimeframe().trim());
        }
        if (hasText(trigger.getEntryModel())) {
            parts.add(trigger.getEntryModel().trim());
        }
        if (parts.isEmpty()) {
            return null;
        }
        return normalizeOptionalText(String.join(" • ", parts), 120);
    }

    private UpsertSessionSetupRequest.Execution normalizeExecution(UpsertSessionSetupRequest.Execution execution) {
        UpsertSessionSetupRequest.Execution normalized = new UpsertSessionSetupRequest.Execution();
        if (execution == null) {
            execution = new UpsertSessionSetupRequest.Execution();
        }

        List<UpsertSessionSetupRequest.Ticket> tickets = new ArrayList<>();
        if (execution.getTickets() != null) {
            for (int index = 0; index < execution.getTickets().size(); index++) {
                tickets.add(normalizeExecutionTicket(execution.getTickets().get(index), index, null));
            }
        }

        if (tickets.isEmpty()) {
            boolean hasLegacyValues = execution.getEntryPrice() != null
                    || execution.getStopLossPrice() != null
                    || execution.getTakeProfitPrice() != null
                    || execution.getRiskAmount() != null
                    || execution.getQuantity() != null
                    || hasText(execution.getInvalidation())
                    || hasText(execution.getWhyWrong())
                    || hasText(execution.getInitialNotes())
                    || hasText(execution.getActiveExecutionId());
            if (hasLegacyValues) {
                UpsertSessionSetupRequest.Ticket legacy = new UpsertSessionSetupRequest.Ticket();
                legacy.setId(execution.getActiveExecutionId());
                legacy.setLabel("Primary execution");
                legacy.setStatus("DRAFT");
                legacy.setEntryPrice(execution.getEntryPrice());
                legacy.setStopLossPrice(execution.getStopLossPrice());
                legacy.setTakeProfitPrice(execution.getTakeProfitPrice());
                legacy.setRiskAmount(execution.getRiskAmount());
                legacy.setQuantity(execution.getQuantity());
                legacy.setInvalidation(execution.getInvalidation());
                legacy.setWhyWrong(execution.getWhyWrong());
                legacy.setInitialNotes(execution.getInitialNotes());
                tickets.add(normalizeExecutionTicket(legacy, 0, execution.getActiveExecutionId()));
            } else {
                tickets.add(normalizeExecutionTicket(new UpsertSessionSetupRequest.Ticket(), 0, execution.getActiveExecutionId()));
            }
        }

        String activeExecutionId = normalizeExecutionId(execution.getActiveExecutionId());
        String requestedActiveExecutionId = activeExecutionId;
        if (requestedActiveExecutionId == null || tickets.stream().noneMatch(item -> Objects.equals(item.getId(), requestedActiveExecutionId))) {
            activeExecutionId = tickets.get(0).getId();
        }

        String resolvedActiveExecutionId = activeExecutionId;
        UpsertSessionSetupRequest.Ticket active = tickets.stream()
                .filter(item -> Objects.equals(item.getId(), resolvedActiveExecutionId))
                .findFirst()
                .orElse(tickets.get(0));

        normalized.setActiveExecutionId(resolvedActiveExecutionId);
        normalized.setTickets(tickets);
        normalized.setEntryPrice(active.getEntryPrice());
        normalized.setStopLossPrice(active.getStopLossPrice());
        normalized.setTakeProfitPrice(active.getTakeProfitPrice());
        normalized.setRiskAmount(active.getRiskAmount());
        normalized.setQuantity(active.getQuantity());
        normalized.setInvalidation(active.getInvalidation());
        normalized.setWhyWrong(active.getWhyWrong());
        normalized.setInitialNotes(active.getInitialNotes());
        return normalized;
    }

    private UpsertSessionSetupRequest.Ticket normalizeExecutionTicket(UpsertSessionSetupRequest.Ticket ticket,
                                                                     int index,
                                                                     String preferredId) {
        UpsertSessionSetupRequest.Ticket normalized = new UpsertSessionSetupRequest.Ticket();
        String id = normalizeExecutionId(ticket == null ? preferredId : firstNonBlank(ticket.getId(), preferredId));
        normalized.setId(id == null ? UUID.randomUUID().toString() : id);
        normalized.setLabel(normalizeOptionalText(ticket == null ? null : ticket.getLabel(), 80));
        if (!hasText(normalized.getLabel())) {
            normalized.setLabel("Execution " + (index + 1));
        }
        normalized.setStatus(normalizeExecutionStatus(ticket == null ? null : ticket.getStatus()));
        normalized.setEntryPrice(scalePrice(ticket == null ? null : ticket.getEntryPrice()));
        normalized.setStopLossPrice(scalePrice(ticket == null ? null : ticket.getStopLossPrice()));
        normalized.setTakeProfitPrice(scalePrice(ticket == null ? null : ticket.getTakeProfitPrice()));
        normalized.setRiskAmount(scaleMoney(ticket == null ? null : ticket.getRiskAmount()));
        normalized.setQuantity(scaleQuantity(ticket == null ? null : ticket.getQuantity()));
        normalized.setInvalidation(normalizeOptionalText(ticket == null ? null : ticket.getInvalidation(), 400));
        normalized.setWhyWrong(normalizeOptionalText(ticket == null ? null : ticket.getWhyWrong(), 400));
        normalized.setInitialNotes(normalizeOptionalText(ticket == null ? null : ticket.getInitialNotes(), 2000));
        normalized.setNotes(normalizeOptionalText(ticket == null ? null : ticket.getNotes(), 1200));
        normalized.setLinkedTradeId(ticket == null ? null : ticket.getLinkedTradeId());
        normalized.setCreatedAt(ticket != null && ticket.getCreatedAt() != null ? ticket.getCreatedAt() : OffsetDateTime.now(ZoneOffset.UTC));
        normalized.setUpdatedAt(ticket == null ? null : ticket.getUpdatedAt());
        normalized.setStartedAt(ticket == null ? null : ticket.getStartedAt());
        normalized.setClosedAt(ticket == null ? null : ticket.getClosedAt());
        return normalized;
    }

    private String normalizeExecutionStatus(String rawValue) {
        if (!hasText(rawValue)) {
            return "DRAFT";
        }
        String normalized = rawValue.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "DRAFT", "WATCHING", "READY", "ACTIVE", "PARTIAL", "CLOSED", "INVALIDATED", "SKIPPED" -> normalized;
            default -> "DRAFT";
        };
    }

    private String normalizeExecutionId(String rawValue) {
        if (!hasText(rawValue)) {
            return null;
        }
        String trimmed = rawValue.trim();
        try {
            return UUID.fromString(trimmed).toString();
        } catch (IllegalArgumentException ex) {
            return trimmed;
        }
    }

    private UpsertSessionSetupRequest.Ticket resolveExecutionTicket(UpsertSessionSetupRequest.Execution execution, String requestedExecutionId) {
        UpsertSessionSetupRequest.Execution normalized = normalizeExecution(execution);
        String targetId = normalizeExecutionId(firstNonBlank(requestedExecutionId, normalized.getActiveExecutionId()));
        if (targetId != null) {
            for (UpsertSessionSetupRequest.Ticket ticket : normalized.getTickets()) {
                if (Objects.equals(ticket.getId(), targetId)) {
                    return ticket;
                }
            }
        }
        return normalized.getTickets().isEmpty() ? null : normalized.getTickets().get(0);
    }

    private List<SessionWorkspaceResponse.ExecutionTicket> toExecutionTickets(List<UpsertSessionSetupRequest.Ticket> tickets) {
        if (tickets == null || tickets.isEmpty()) {
            return List.of();
        }
        return tickets.stream()
                .map(ticket -> SessionWorkspaceResponse.ExecutionTicket.builder()
                        .id(ticket.getId())
                        .label(ticket.getLabel())
                        .status(ticket.getStatus())
                        .entryPrice(scalePrice(ticket.getEntryPrice()))
                        .stopLossPrice(scalePrice(ticket.getStopLossPrice()))
                        .takeProfitPrice(scalePrice(ticket.getTakeProfitPrice()))
                        .riskAmount(scaleMoney(ticket.getRiskAmount()))
                        .quantity(scaleQuantity(ticket.getQuantity()))
                        .invalidation(normalizeOptionalText(ticket.getInvalidation(), 400))
                        .whyWrong(normalizeOptionalText(ticket.getWhyWrong(), 400))
                        .initialNotes(normalizeOptionalText(ticket.getInitialNotes(), 2000))
                        .notes(normalizeOptionalText(ticket.getNotes(), 1200))
                        .linkedTradeId(ticket.getLinkedTradeId())
                        .createdAt(ticket.getCreatedAt())
                        .updatedAt(ticket.getUpdatedAt())
                        .startedAt(ticket.getStartedAt())
                        .closedAt(ticket.getClosedAt())
                        .build())
                .toList();
    }

    private UpsertSessionSetupRequest.StrategySnapshot normalizeStrategySnapshot(UpsertSessionSetupRequest.StrategySnapshot snapshot,
                                                                                UUID fallbackStrategyId) {
        UpsertSessionSetupRequest.StrategySnapshot normalized = new UpsertSessionSetupRequest.StrategySnapshot();
        if (snapshot == null) {
            normalized.setStrategyId(fallbackStrategyId);
            return normalized;
        }
        normalized.setStrategyId(snapshot.getStrategyId() == null ? fallbackStrategyId : snapshot.getStrategyId());
        normalized.setSource(normalizeOptionalText(snapshot.getSource(), 16));
        normalized.setName(normalizeOptionalText(snapshot.getName(), 160));
        normalized.setModel(normalizeOptionalText(snapshot.getModel(), 240));
        normalized.setEntryConditionsRich(normalizeOptionalText(snapshot.getEntryConditionsRich(), 4000));
        normalized.setEntryConditions(normalizeStringList(snapshot.getEntryConditions(), 160));
        normalized.setInvalidationLogic(normalizeOptionalText(snapshot.getInvalidationLogic(), 600));
        normalized.setTpFramework(normalizeOptionalText(snapshot.getTpFramework(), 600));
        normalized.setNoTradeRules(normalizeOptionalText(snapshot.getNoTradeRules(), 600));
        normalized.setSessionSuitability(normalizeStringList(snapshot.getSessionSuitability(), 80));
        normalized.setTags(normalizeStringList(snapshot.getTags(), 80));
        normalized.setSnapshotAssetId(snapshot.getSnapshotAssetId());
        normalized.setImportedAt(snapshot.getImportedAt());
        normalized.setLocalEditsApplied(snapshot.getLocalEditsApplied());
        return normalized;
    }

    private SessionWorkspaceResponse.SetupStrategySnapshot toStrategySnapshot(JsonNode node, UUID fallbackStrategyId) {
        UpsertSessionSetupRequest.StrategySnapshot snapshot = normalizeStrategySnapshot(
                readNode(node, UpsertSessionSetupRequest.StrategySnapshot.class, new UpsertSessionSetupRequest.StrategySnapshot()),
                fallbackStrategyId
        );
        if (snapshot.getStrategyId() == null
                && !hasText(snapshot.getName())
                && !hasText(snapshot.getModel())
                && (snapshot.getEntryConditions() == null || snapshot.getEntryConditions().isEmpty())) {
            return null;
        }
        return SessionWorkspaceResponse.SetupStrategySnapshot.builder()
                .strategyId(snapshot.getStrategyId())
                .source(snapshot.getSource())
                .name(snapshot.getName())
                .model(snapshot.getModel())
                .entryConditionsRich(snapshot.getEntryConditionsRich())
                .entryConditions(snapshot.getEntryConditions() == null ? List.of() : snapshot.getEntryConditions())
                .invalidationLogic(snapshot.getInvalidationLogic())
                .tpFramework(snapshot.getTpFramework())
                .noTradeRules(snapshot.getNoTradeRules())
                .sessionSuitability(snapshot.getSessionSuitability() == null ? List.of() : snapshot.getSessionSuitability())
                .tags(snapshot.getTags() == null ? List.of() : snapshot.getTags())
                .snapshotAssetId(snapshot.getSnapshotAssetId())
                .importedAt(snapshot.getImportedAt())
                .localEditsApplied(snapshot.getLocalEditsApplied())
                .build();
    }

    private UpsertSessionSetupRequest.Review normalizeReview(UpsertSessionSetupRequest.Review review) {
        UpsertSessionSetupRequest.Review normalized = new UpsertSessionSetupRequest.Review();
        if (review == null) {
            normalized.setTags(List.of());
            normalized.setTimeline(List.of());
            return normalized;
        }
        normalized.setLiveNotes(normalizeOptionalText(review.getLiveNotes(), 4000));
        normalized.setMistakes(normalizeOptionalText(review.getMistakes(), 2000));
        normalized.setLessons(normalizeOptionalText(review.getLessons(), 2000));
        normalized.setOutcomeSummary(normalizeOptionalText(review.getOutcomeSummary(), 1200));
        normalized.setTags(normalizeStringList(review.getTags(), 80));
        if (review.getTimeline() == null || review.getTimeline().isEmpty()) {
            normalized.setTimeline(List.of());
        } else {
            normalized.setTimeline(review.getTimeline().stream()
                    .map(this::normalizeTimelineEntry)
                    .toList());
        }
        return normalized;
    }

    private SessionWorkspaceResponse.SetupReview toReview(JsonNode node) {
        UpsertSessionSetupRequest.Review review = normalizeReview(
                readNode(node, UpsertSessionSetupRequest.Review.class, new UpsertSessionSetupRequest.Review())
        );
        return SessionWorkspaceResponse.SetupReview.builder()
                .liveNotes(review.getLiveNotes())
                .mistakes(review.getMistakes())
                .lessons(review.getLessons())
                .outcomeSummary(review.getOutcomeSummary())
                .tags(review.getTags() == null ? List.of() : review.getTags())
                .timeline(review.getTimeline() == null ? List.of() : review.getTimeline().stream()
                        .map(entry -> SessionWorkspaceResponse.ReviewTimelineEntry.builder()
                                .id(entry.getId())
                                .type(entry.getType())
                                .title(entry.getTitle())
                                .body(entry.getBody())
                                .executionId(entry.getExecutionId())
                                .tradeId(entry.getTradeId())
                                .occurredAt(entry.getOccurredAt())
                                .build())
                        .toList())
                .build();
    }

    private UpsertSessionSetupRequest.TimelineEntry normalizeTimelineEntry(UpsertSessionSetupRequest.TimelineEntry entry) {
        UpsertSessionSetupRequest.TimelineEntry normalized = new UpsertSessionSetupRequest.TimelineEntry();
        if (entry == null) {
            normalized.setId(UUID.randomUUID().toString());
            normalized.setOccurredAt(OffsetDateTime.now(ZoneOffset.UTC));
            return normalized;
        }
        normalized.setId(hasText(entry.getId()) ? entry.getId().trim() : UUID.randomUUID().toString());
        normalized.setType(normalizeOptionalText(entry.getType(), 48));
        normalized.setTitle(normalizeOptionalText(entry.getTitle(), 120));
        normalized.setBody(normalizeOptionalText(entry.getBody(), 1200));
        normalized.setExecutionId(normalizeExecutionId(entry.getExecutionId()));
        normalized.setTradeId(entry.getTradeId());
        normalized.setOccurredAt(entry.getOccurredAt() == null ? OffsetDateTime.now(ZoneOffset.UTC) : entry.getOccurredAt());
        return normalized;
    }

    private UpsertSessionSetupRequest.TimelineEntry timelineEntry(String type,
                                                                  String title,
                                                                  String body,
                                                                  String executionId,
                                                                  UUID tradeId,
                                                                  OffsetDateTime occurredAt) {
        UpsertSessionSetupRequest.TimelineEntry entry = new UpsertSessionSetupRequest.TimelineEntry();
        entry.setId(UUID.randomUUID().toString());
        entry.setType(type);
        entry.setTitle(title);
        entry.setBody(body);
        entry.setExecutionId(executionId);
        entry.setTradeId(tradeId);
        entry.setOccurredAt(occurredAt == null ? OffsetDateTime.now(ZoneOffset.UTC) : occurredAt);
        return normalizeTimelineEntry(entry);
    }

    private void appendReviewTimeline(SessionSetup setup, UpsertSessionSetupRequest.TimelineEntry entry) {
        UpsertSessionSetupRequest.Review review = normalizeReview(
                readNode(setup.getReviewSnapshotJson(), UpsertSessionSetupRequest.Review.class, new UpsertSessionSetupRequest.Review())
        );
        List<UpsertSessionSetupRequest.TimelineEntry> timeline = new ArrayList<>(review.getTimeline() == null ? List.of() : review.getTimeline());
        timeline.add(normalizeTimelineEntry(entry));
        review.setTimeline(timeline);
        setup.setReviewSnapshotJson(toJsonObject(review));
    }

    private void markExecutionStarted(UpsertSessionSetupRequest.Execution execution,
                                      String executionId,
                                      UUID tradeId,
                                      OffsetDateTime startedAt) {
        if (execution == null || execution.getTickets() == null) {
            return;
        }
        execution.setActiveExecutionId(executionId);
        for (UpsertSessionSetupRequest.Ticket ticket : execution.getTickets()) {
            if (!Objects.equals(ticket.getId(), executionId)) {
                continue;
            }
            ticket.setStatus("ACTIVE");
            ticket.setLinkedTradeId(tradeId);
            ticket.setStartedAt(startedAt);
            ticket.setUpdatedAt(startedAt);
            execution.setEntryPrice(ticket.getEntryPrice());
            execution.setStopLossPrice(ticket.getStopLossPrice());
            execution.setTakeProfitPrice(ticket.getTakeProfitPrice());
            execution.setRiskAmount(ticket.getRiskAmount());
            execution.setQuantity(ticket.getQuantity());
            execution.setInvalidation(ticket.getInvalidation());
            execution.setWhyWrong(ticket.getWhyWrong());
            execution.setInitialNotes(ticket.getInitialNotes());
        }
    }

    private List<String> normalizeStringList(List<String> values, int maxLength) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        List<String> normalized = new ArrayList<>();
        for (String value : values) {
            String item = normalizeOptionalText(value, maxLength);
            if (item != null && !normalized.contains(item)) {
                normalized.add(item);
            }
        }
        return normalized;
    }

    private void ensureLegacySetupBackfill(TodaySession session, User user) {
        if (sessionSetupRepository.existsByTodaySession_Id(session.getId())) {
            return;
        }

        List<Trade> trades = loadTrades(user.getId(), session.getId());
        Trade activeOrRecentTrade = trades.stream().findFirst().orElse(null);
        List<SessionLevel> levels = sessionLevelRepository.findByTodaySession_IdAndUser_IdOrderByCreatedAtAsc(session.getId(), user.getId());
        String plannedTicker = firstPlannedTicker(session.getPlannedTickersJson());
        String symbol = firstNonBlank(
                activeOrRecentTrade == null ? null : activeOrRecentTrade.getSymbol(),
                plannedTicker,
                levels.stream().map(SessionLevel::getSymbol).filter(Objects::nonNull).findFirst().orElse(null)
        );

        boolean hasLegacySignal = hasText(symbol)
                || hasText(session.getLockInBiasReason())
                || !levels.isEmpty()
                || hasText(resolveNarrativeText(session.getId(), user.getId()));
        if (!hasLegacySignal) {
            return;
        }

        ObjectNode context = objectMapper.createObjectNode();
        context.put("narrative", normalizeOptionalText(resolveNarrativeText(session.getId(), user.getId()), 600));
        context.put("liquidityNotes", levels.stream()
                .filter(level -> Objects.equals(normalizeSymbolOrNull(level.getSymbol()), normalizeSymbolOrNull(symbol)) || !hasText(symbol))
                .limit(4)
                .map(level -> buildLevelSummary(level))
                .reduce((left, right) -> left + ", " + right)
                .orElse(null));
        context.put("invalidationIdea", normalizeOptionalText(session.getLockInBiasReason(), 400));

        ObjectNode trigger = objectMapper.createObjectNode();
        if (activeOrRecentTrade != null) {
            trigger.put("rrEstimate", activeOrRecentTrade.getRMultiple());
            trigger.put("entryZone", activeOrRecentTrade.getEntryPrice() == null ? null : activeOrRecentTrade.getEntryPrice().toPlainString());
        }

        ObjectNode execution = objectMapper.createObjectNode();
        if (activeOrRecentTrade != null) {
            if (activeOrRecentTrade.getEntryPrice() != null) {
                execution.put("entryPrice", activeOrRecentTrade.getEntryPrice());
            }
            if (activeOrRecentTrade.getStopLossPrice() != null) {
                execution.put("stopLossPrice", activeOrRecentTrade.getStopLossPrice());
            }
            if (activeOrRecentTrade.getTakeProfitPrice() != null) {
                execution.put("takeProfitPrice", activeOrRecentTrade.getTakeProfitPrice());
            }
            if (activeOrRecentTrade.getRiskAmount() != null) {
                execution.put("riskAmount", activeOrRecentTrade.getRiskAmount());
            }
            if (activeOrRecentTrade.getQuantity() != null) {
                execution.put("quantity", activeOrRecentTrade.getQuantity());
            }
            execution.put("initialNotes", normalizeOptionalText(activeOrRecentTrade.getInitialNotes(), 2000));
            execution.put("invalidation", normalizeOptionalText(activeOrRecentTrade.getEntryInvalidation(), 400));
        }
        execution = (ObjectNode) toJsonObject(normalizeExecution(readNode(execution, UpsertSessionSetupRequest.Execution.class, new UpsertSessionSetupRequest.Execution())));

        ArrayNode levelsJson = objectMapper.createArrayNode();
        for (SessionLevel level : levels) {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("label", level.getLabel());
            if (level.getPrice() != null) {
                node.put("price", level.getPrice());
            }
            node.put("source", level.getCreatedBy() == null ? "USER" : level.getCreatedBy().name());
            node.put("notes", normalizeOptionalText(level.getNotes(), 220));
            levelsJson.add(node);
        }

        SessionSetup setup = SessionSetup.builder()
                .todaySession(session)
                .user(user)
                .symbol(normalizeSymbolOrFallback(symbol, "WATCHLIST"))
                .direction(activeOrRecentTrade == null || activeOrRecentTrade.getDirection() == null ? Direction.UNDECIDED : activeOrRecentTrade.getDirection())
                .market(activeOrRecentTrade == null ? Market.FOREX : activeOrRecentTrade.getMarket())
                .tradeSession(activeOrRecentTrade == null ? parseTradeSession(session.getLockInSession()) : activeOrRecentTrade.getSession())
                .strategyId(activeOrRecentTrade == null ? null : activeOrRecentTrade.getStrategyId())
                .strategyLabel(activeOrRecentTrade == null ? null : normalizeOptionalText(firstNonBlank(activeOrRecentTrade.getStrategyTag(), activeOrRecentTrade.getSetup()), 120))
                .setupTitle(normalizeSetupTitle(firstNonBlank(
                        activeOrRecentTrade == null ? null : activeOrRecentTrade.getSetup(),
                        symbol == null ? null : symbol + " legacy setup"
                ), symbol))
                .biasAlignment(normalizeOptionalText(session.getLockInBias(), 24))
                .narrativeSnapshotJson(objectMapper.createObjectNode())
                .contextSnapshotJson(context)
                .strategySnapshotJson(objectMapper.createObjectNode())
                .triggerSnapshotJson(trigger)
                .executionSnapshotJson(execution)
                .reviewSnapshotJson(objectMapper.createObjectNode())
                .levelsJson(levelsJson)
                .linkedTradeId(activeOrRecentTrade == null ? null : activeOrRecentTrade.getId())
                .status(activeOrRecentTrade == null
                        ? SessionSetupStatus.DRAFT
                        : activeOrRecentTrade.getStatus() == TradeStatus.CLOSED ? SessionSetupStatus.CLOSED : SessionSetupStatus.EXECUTED)
                .sortOrder(0)
                .build();

        applyReadiness(setup, session.getLockInAt() != null);
        SessionSetup saved = sessionSetupRepository.save(setup);
        if (session.getActiveSetupId() == null) {
            session.setActiveSetupId(saved.getId());
            todaySessionRepository.save(session);
        }
    }

    private void upsertNarrative(TodaySession session, User user, String narrativeText) {
        Optional<SessionNarrative> existing = sessionNarrativeRepository.findBySessionIdAndUser_Id(session.getId(), user.getId());
        String normalized = normalizeOptionalText(narrativeText, 400);
        if (existing.isPresent()) {
            existing.get().setNotes(normalized);
            sessionNarrativeRepository.save(existing.get());
            return;
        }
        SessionNarrative narrative = SessionNarrative.builder()
                .todaySession(session)
                .user(user)
                .notes(normalized)
                .build();
        sessionNarrativeRepository.save(narrative);
    }

    private SessionSetup requireSetup(UUID sessionId, UUID setupId, UUID userId) {
        return sessionSetupRepository.findByIdAndTodaySession_IdAndUser_Id(setupId, sessionId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Session setup not found"));
    }

    private TodaySession requireSession(User user, UUID sessionId) {
        return todaySessionRepository.findByIdAndUser_Id(sessionId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Session not found"));
    }

    private List<SessionSetup> loadSetups(TodaySession session, UUID userId) {
        return sessionSetupRepository.findByTodaySession_IdAndUser_IdOrderBySortOrderAscCreatedAtAsc(session.getId(), userId);
    }

    private List<Trade> loadTrades(UUID userId, UUID sessionId) {
        return tradeRepository.findByUserIdAndSessionIdOrderByOpenedAtDescCreatedAtDesc(userId, sessionId);
    }

    private LocalDate resolveSessionDate() {
        return LocalDate.now(ZoneId.of("Europe/Bucharest"));
    }

    private TradeSession resolveTradeSession(TodaySession session, SessionSetup setup) {
        if (setup.getTradeSession() != null) {
            return setup.getTradeSession();
        }
        return parseTradeSession(session.getLockInSession());
    }

    private TradeSession parseTradeSession(String rawValue) {
        if (!hasText(rawValue)) {
            return null;
        }
        try {
            return TradeSession.valueOf(rawValue.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private String normalizeSessionName(String value) {
        if (!hasText(value)) {
            return null;
        }
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeObjective(String value) {
        if (!hasText(value)) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "A_PLUS_ONLY", "ONE_TRADE_MAX", "TWO_TRADES_MAX" -> normalized;
            default -> throw new IllegalArgumentException("Unsupported objective value: " + value);
        };
    }

    private String normalizeBias(String value) {
        if (!hasText(value)) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "LONG", "SHORT", "NEUTRAL" -> normalized;
            default -> throw new IllegalArgumentException("Unsupported bias value: " + value);
        };
    }

    private String normalizeSetupTitle(String value, String fallbackSymbol) {
        String normalized = normalizeOptionalText(value, 140);
        if (normalized != null) {
            return normalized;
        }
        if (hasText(fallbackSymbol)) {
            return fallbackSymbol.trim().toUpperCase(Locale.ROOT);
        }
        throw new IllegalArgumentException("setupTitle is required");
    }

    private String normalizeSymbol(String value) {
        if (!hasText(value)) {
            throw new IllegalArgumentException("symbol is required");
        }
        return normalizeSymbolOrFallback(value, null);
    }

    private String normalizeSymbolOrFallback(String value, String fallback) {
        String normalized = normalizeSymbolOrNull(value);
        if (normalized != null) {
            return normalized;
        }
        if (fallback != null) {
            return fallback;
        }
        throw new IllegalArgumentException("symbol is required");
    }

    private String normalizeSymbolOrNull(String value) {
        if (!hasText(value)) {
            return null;
        }
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private Direction normalizeSetupDirection(Direction direction) {
        return direction == null ? Direction.UNDECIDED : direction;
    }

    private boolean isDirectionDecided(Direction direction) {
        return direction == Direction.LONG || direction == Direction.SHORT;
    }

    private BigDecimal nonNegative(BigDecimal value, String fieldName) {
        if (value == null) {
            return null;
        }
        if (value.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException(fieldName + " must be non-negative");
        }
        return value;
    }

    private BigDecimal safeMoney(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private BigDecimal computeRr(BigDecimal entry, BigDecimal stopLoss, BigDecimal takeProfit, Direction direction) {
        if (entry == null || stopLoss == null || takeProfit == null || !isDirectionDecided(direction)) {
            return null;
        }
        BigDecimal risk = direction == Direction.LONG
                ? entry.subtract(stopLoss)
                : stopLoss.subtract(entry);
        BigDecimal reward = direction == Direction.LONG
                ? takeProfit.subtract(entry)
                : entry.subtract(takeProfit);
        if (risk.compareTo(BigDecimal.ZERO) <= 0 || reward.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        return reward.divide(risk, 4, RoundingMode.HALF_UP);
    }

    private JsonNode buildNarrativeSnapshot(TodaySession session,
                                            SessionSetup setup,
                                            UpsertSessionSetupRequest.Context context,
                                            UpsertSessionSetupRequest.Trigger trigger) {
        ObjectNode snapshot = objectMapper.createObjectNode();
        snapshot.put("sessionName", session.getLockInSession());
        snapshot.put("sessionBias", session.getLockInBias());
        snapshot.put("setupBiasAlignment", setup.getBiasAlignment());
        snapshot.put("setupNarrative", normalizeOptionalText(context.getNarrative(), 600));
        snapshot.put("liquidityNotes", normalizeOptionalText(context.getLiquidityNotes(), 400));
        snapshot.put("confirmationModel", normalizeOptionalText(firstNonBlank(trigger.getConfirmationModel(), buildConfirmationModel(trigger)), 120));
        snapshot.put("entryZone", normalizeOptionalText(firstNonBlank(trigger.getEntryZone(), trigger.getEntryModel()), 160));
        return snapshot;
    }

    private ObjectNode checklistItem(String text, boolean completed) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("text", text);
        node.put("required", true);
        node.put("completed", completed);
        return node;
    }

    private TradeGrade deriveTradeGrade(int readinessScore) {
        if (readinessScore >= 90) {
            return TradeGrade.A;
        }
        if (readinessScore >= 75) {
            return TradeGrade.B;
        }
        return TradeGrade.C;
    }

    private String resolveNarrativeText(UUID sessionId, UUID userId) {
        return sessionNarrativeRepository.findBySessionIdAndUser_Id(sessionId, userId)
                .map(SessionNarrative::getNotes)
                .map(value -> normalizeOptionalText(value, 400))
                .orElse(null);
    }

    private String firstPlannedTicker(String plannedTickersJson) {
        if (!hasText(plannedTickersJson)) {
            return null;
        }
        try {
            List<String> tickers = objectMapper.readValue(plannedTickersJson, STRING_LIST);
            return tickers.stream().map(this::normalizeSymbolOrNull).filter(Objects::nonNull).findFirst().orElse(null);
        } catch (Exception ex) {
            return null;
        }
    }

    private List<UpsertSessionSetupRequest.Level> readLevels(JsonNode node) {
        if (node == null || node.isNull() || !node.isArray()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.convertValue(node, LEVEL_LIST);
        } catch (IllegalArgumentException ex) {
            return Collections.emptyList();
        }
    }

    private <T> T readNode(JsonNode node, Class<T> type, T fallback) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return fallback;
        }
        try {
            return objectMapper.treeToValue(node, type);
        } catch (Exception ex) {
            return fallback;
        }
    }

    private JsonNode toJsonObject(Object value) {
        if (value == null) {
            return objectMapper.createObjectNode();
        }
        JsonNode node = objectMapper.valueToTree(value);
        return node == null || node.isNull() ? objectMapper.createObjectNode() : node;
    }

    private JsonNode toJsonArray(Object value) {
        if (value == null) {
            return objectMapper.createArrayNode();
        }
        JsonNode node = objectMapper.valueToTree(value);
        return node == null || node.isNull() ? objectMapper.createArrayNode() : node;
    }

    private JsonNode copyNode(JsonNode node) {
        return node == null ? null : node.deepCopy();
    }

    private String buildLevelSummary(SessionLevel level) {
        if (level.getPrice() == null) {
            return level.getLabel();
        }
        return level.getLabel() + " " + level.getPrice().setScale(4, RoundingMode.HALF_UP).toPlainString();
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String normalizeOptionalText(String value, int maxLength) {
        if (!hasText(value)) {
            return null;
        }
        String normalized = value.trim();
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (hasText(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private String humanizeStatus(SessionSetupStatus status) {
        return switch (status) {
            case INVALIDATED -> "setup invalidated";
            case SKIPPED -> "setup skipped";
            case ARCHIVED -> "setup archived";
            case CLOSED -> "linked trade closed";
            default -> "setup blocked";
        };
    }

    private BigDecimal scaleMoney(BigDecimal value) {
        if (value == null) {
            return null;
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal scaleRatio(BigDecimal value) {
        if (value == null) {
            return null;
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal scalePrice(BigDecimal value) {
        if (value == null) {
            return null;
        }
        return value.setScale(5, RoundingMode.HALF_UP);
    }

    private BigDecimal scaleQuantity(BigDecimal value) {
        if (value == null) {
            return null;
        }
        return value.setScale(4, RoundingMode.HALF_UP);
    }

    private record ReadinessComputation(
            SessionWorkspaceResponse.Readiness readiness,
            int score,
            boolean contextReady,
            boolean triggerReady,
            boolean executionReady,
            List<String> readyBlockers,
            List<String> startTradeBlockers,
            BigDecimal rrEstimate
    ) {
    }

    private record SessionReadiness(
            SessionWorkspaceResponse.Readiness readiness,
            List<String> blockers
    ) {
    }
}
