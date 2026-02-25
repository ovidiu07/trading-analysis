package com.tradevault.service.today;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.domain.TodaySessionDefaults;
import com.tradevault.domain.entity.ChecklistTemplate;
import com.tradevault.domain.entity.ChecklistTemplateEntry;
import com.tradevault.domain.entity.ChecklistTemplateItem;
import com.tradevault.domain.entity.ChecklistTemplateVersion;
import com.tradevault.domain.entity.LiquidityPool;
import com.tradevault.domain.entity.SessionAutoTradeEvent;
import com.tradevault.domain.entity.SessionLevel;
import com.tradevault.domain.entity.SessionNarrative;
import com.tradevault.domain.entity.TodaySession;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.AutoJournalState;
import com.tradevault.domain.enums.AutoTradeEventType;
import com.tradevault.domain.enums.ChecklistTemplateType;
import com.tradevault.domain.enums.ChecklistValueType;
import com.tradevault.domain.enums.ContextSnapshotMode;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.LevelCreatedBy;
import com.tradevault.domain.enums.LevelStatus;
import com.tradevault.domain.enums.LevelTimeframe;
import com.tradevault.domain.enums.LevelType;
import com.tradevault.domain.enums.NarrativeConfirmationModel;
import com.tradevault.domain.enums.NarrativeDeliveryModel;
import com.tradevault.domain.enums.NarrativeHtfDraw;
import com.tradevault.domain.enums.NarrativeManipulation;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.QuoteSide;
import com.tradevault.domain.enums.SessionLevelCategory;
import com.tradevault.domain.enums.TodaySessionStatus;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.session.ChecklistTemplateItemDto;
import com.tradevault.dto.session.ChecklistTemplateRequest;
import com.tradevault.dto.session.ChecklistTemplateResponse;
import com.tradevault.dto.session.CloseSessionTradeRequest;
import com.tradevault.dto.session.SessionChecklistItemDto;
import com.tradevault.dto.session.SessionLevelDto;
import com.tradevault.dto.session.SessionLevelRequest;
import com.tradevault.dto.session.SessionLevelSuggestionDto;
import com.tradevault.dto.session.SessionAutoTradeEventDto;
import com.tradevault.dto.session.SessionAutoTradeEventRequest;
import com.tradevault.dto.session.SessionNarrativeDto;
import com.tradevault.dto.session.SessionNarrativeRequest;
import com.tradevault.dto.session.SessionPoolDto;
import com.tradevault.dto.session.SessionPoolRequest;
import com.tradevault.dto.session.SessionRoleSelectionRequest;
import com.tradevault.dto.session.StartSessionTradeRequest;
import com.tradevault.dto.session.TodaySessionActiveSweepLevelRequest;
import com.tradevault.dto.session.TodaySessionChecklistUpdateRequest;
import com.tradevault.dto.session.TodaySessionConfigRequest;
import com.tradevault.dto.session.TodaySessionLockInRequest;
import com.tradevault.dto.session.TodaySessionPlannedTickersRequest;
import com.tradevault.dto.session.TodaySessionResponse;
import com.tradevault.dto.trade.TradeRequest;
import com.tradevault.dto.trade.TradeResponse;
import com.tradevault.repository.ChecklistTemplateEntryRepository;
import com.tradevault.repository.ChecklistTemplateItemRepository;
import com.tradevault.repository.ChecklistTemplateRepository;
import com.tradevault.repository.ChecklistTemplateVersionRepository;
import com.tradevault.repository.LiquidityPoolRepository;
import com.tradevault.repository.SessionAutoTradeEventRepository;
import com.tradevault.repository.SessionLevelRepository;
import com.tradevault.repository.SessionNarrativeRepository;
import com.tradevault.repository.TodaySessionRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.ContextSnapshotService;
import com.tradevault.service.TimezoneService;
import com.tradevault.service.TradeService;
import com.tradevault.service.TradeTaxonomy;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
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
@Slf4j
public class TodaySessionService {
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};
    private static final TypeReference<List<SessionChecklistItemDto>> CHECKLIST_LIST = new TypeReference<>() {};
    private static final TypeReference<List<Map<String, Object>>> CHECKLIST_OBJECT_LIST = new TypeReference<>() {};

    private static final int MAX_CHECKLIST_ITEMS = 30;
    private static final int MAX_TICKERS = 30;
    private static final int MAX_TICKER_LENGTH = 16;
    private static final int MAX_TEMPLATE_NAME_LENGTH = 120;
    private static final int MAX_CHECKLIST_TEXT_LENGTH = 160;
    private static final int MAX_LEVEL_LABEL_LENGTH = 64;
    private static final int MAX_LEVEL_ORIGIN_RULE_LENGTH = 400;
    private static final int MAX_LEVEL_EXPECTATION_LENGTH = 48;
    private static final int MAX_POOL_NAME_LENGTH = 120;
    private static final int MAX_NARRATIVE_NOTES_LENGTH = 400;
    private static final int MAX_AUTO_TRADE_NOTE_LENGTH = 280;

    private static final Set<String> LOCK_IN_SESSIONS = Set.of("ASIA", "LONDON", "NY_AM", "NY_PM");
    private static final Set<String> LOCK_IN_OBJECTIVES = Set.of("A_PLUS_ONLY", "ONE_TRADE_MAX", "TWO_TRADES_MAX");
    private static final Set<String> LOCK_IN_BIAS = Set.of("LONG", "SHORT", "NEUTRAL");

    private final TodaySessionRepository todaySessionRepository;
    private final TradeRepository tradeRepository;
    private final ChecklistTemplateRepository checklistTemplateRepository;
    private final ChecklistTemplateEntryRepository checklistTemplateEntryRepository;
    private final ChecklistTemplateItemRepository checklistTemplateItemRepository;
    private final ChecklistTemplateVersionRepository checklistTemplateVersionRepository;
    private final SessionLevelRepository sessionLevelRepository;
    private final LiquidityPoolRepository liquidityPoolRepository;
    private final SessionAutoTradeEventRepository sessionAutoTradeEventRepository;
    private final SessionNarrativeRepository sessionNarrativeRepository;
    private final CurrentUserService currentUserService;
    private final TradeService tradeService;
    private final ContextSnapshotService contextSnapshotService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public TodaySessionResponse getTodaySession() {
        User user = currentUserService.getCurrentUser();
        LocalDate today = resolveSessionDate();
        TodaySession session = todaySessionRepository.findByUser_IdAndSessionDate(user.getId(), today).orElse(null);
        if (session == null) {
            return null;
        }
        return toResponse(session, user.getId());
    }

    @Transactional
    public TodaySessionResponse saveTodaySessionConfig(TodaySessionConfigRequest request) {
        User user = currentUserService.getCurrentUser();
        LocalDate today = resolveSessionDate();

        TodaySession session = todaySessionRepository.findByUser_IdAndSessionDate(user.getId(), today)
                .orElseGet(() -> TodaySession.builder()
                        .user(user)
                        .sessionDate(today)
                        .status(TodaySessionStatus.ACTIVE)
                        .build());

        session.setProfitTarget(normalizeMoney(request.getProfitTarget(), "profitTarget"));
        session.setLossLimit(normalizeMoney(request.getLossLimit(), "lossLimit"));
        session.setMaxTrades(normalizeMaxTrades(request.getMaxTrades()));
        if (session.getStatus() == null) {
            session.setStatus(TodaySessionStatus.ACTIVE);
        }

        hydrateLegacyChecklistState(session);

        if (isBlank(session.getPrereqsStateJson())) {
            Optional<ChecklistTemplate> defaultTemplate = checklistTemplateRepository
                    .findFirstByUser_IdAndTypeAndIsDefaultTrue(user.getId(), ChecklistTemplateType.PREREQS);
            session.setPrereqsTemplate(defaultTemplate.orElse(null));
            List<SessionChecklistItemDto> seeded = defaultTemplate
                    .map(template -> mergeWithTemplateEntries(template.getId(), List.of()))
                    .orElseGet(() -> mergeWithGlobalChecklistTemplate(user.getId(), List.of()));
            if (seeded.isEmpty()) {
                seeded = fallbackPrereqsTemplateItems();
            }
            session.setPrereqsStateJson(writeChecklistItems(seeded));
        }

        if (isBlank(session.getTriggersStateJson())) {
            Optional<ChecklistTemplate> defaultTemplate = checklistTemplateRepository
                    .findFirstByUser_IdAndTypeAndIsDefaultTrue(user.getId(), ChecklistTemplateType.TRIGGERS);
            session.setTriggersTemplate(defaultTemplate.orElse(null));
            List<SessionChecklistItemDto> seeded = defaultTemplate
                    .map(template -> mergeWithTemplateEntries(template.getId(), List.of()))
                    .orElseGet(this::fallbackTriggerTemplateItems);
            session.setTriggersStateJson(writeChecklistItems(seeded));
        }

        syncLegacyChecklistFields(session);

        TodaySession saved = todaySessionRepository.saveAndFlush(session);
        refreshSessionStatus(saved, user.getId());
        return toResponse(saved, user.getId());
    }

    @Transactional
    public TodaySessionResponse updatePlannedTickers(TodaySessionPlannedTickersRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireTodaySession(user);
        List<String> tickers = normalizeTickers(request == null ? null : request.getTickers());
        session.setPlannedTickersJson(writeStringList(tickers));
        TodaySession saved = todaySessionRepository.save(session);
        return toResponse(saved, user.getId());
    }

    @Transactional
    public TodaySessionResponse updateChecklist(TodaySessionChecklistUpdateRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireTodaySession(user);

        ChecklistTemplateType type = request != null && request.getType() != null
                ? request.getType()
                : ChecklistTemplateType.PREREQS;

        List<SessionChecklistItemDto> current = resolveChecklistItems(session, user.getId(), type);

        if (request != null && request.getTemplateId() != null) {
            ChecklistTemplate template = checklistTemplateRepository.findByIdAndUser_Id(request.getTemplateId(), user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Checklist template not found"));
            if (template.getType() != type) {
                throw new IllegalArgumentException("Template type does not match checklist type");
            }
            List<SessionChecklistItemDto> merged = mergeWithTemplateEntries(template.getId(), current);
            applyChecklistTypeState(session, type, template, merged);
        } else if (request != null && request.getItems() != null) {
            List<SessionChecklistItemDto> items = normalizeChecklistItems(request.getItems());
            ChecklistTemplate activeTemplate = getTemplateForType(session, type);
            if (activeTemplate != null && activeTemplate.getId() != null) {
                List<SessionChecklistItemDto> templateRows = loadTemplateRows(activeTemplate.getId());
                // If structure changed in session editor, detach from template and keep session-specific rows.
                if (hasCustomChecklistStructure(items, templateRows)) {
                    applyChecklistTypeState(session, type, null, items);
                } else {
                    applyChecklistTypeState(session, type, activeTemplate, items);
                }
            } else {
                applyChecklistTypeState(session, type, null, items);
            }
        }

        if (request != null && request.getActiveSweepLevelId() != null) {
            applyActiveSweepLevel(session, user.getId(), request.getActiveSweepLevelId());
        }

        syncLegacyChecklistFields(session);
        TodaySession saved = todaySessionRepository.save(session);
        return toResponse(saved, user.getId());
    }

    @Transactional
    public TodaySessionResponse updateLockIn(TodaySessionLockInRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireTodaySession(user);

        session.setLockInSession(normalizeLockInSession(request == null ? null : request.getSession()));
        session.setLockInObjective(normalizeLockInObjective(request == null ? null : request.getObjective()));
        session.setLockInBias(normalizeLockInBias(request == null ? null : request.getBias()));
        session.setLockInBiasReason(normalizeLockInBiasReason(request == null ? null : request.getBiasReason()));

        if (isLockInComplete(session)) {
            if (session.getLockInAt() == null) {
                session.setLockInAt(OffsetDateTime.now(ZoneOffset.UTC));
            }
        } else {
            session.setLockInAt(null);
        }

        TodaySession saved = todaySessionRepository.save(session);
        return toResponse(saved, user.getId());
    }

    @Transactional(readOnly = true)
    public List<SessionAutoTradeEventDto> listAutoTradeEvents(UUID sessionId) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSessionById(user, sessionId);
        return sessionAutoTradeEventRepository
                .findByTodaySession_IdAndUser_IdOrderByCreatedAtUtcDesc(session.getId(), user.getId())
                .stream()
                .map(this::toAutoTradeEventDto)
                .toList();
    }

    @Transactional
    public SessionAutoTradeEventDto logAutoTradeEvent(UUID sessionId, SessionAutoTradeEventRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSessionById(user, sessionId);

        Trade linkedTrade = null;
        UUID tradeId = request == null ? null : request.getTradeId();
        if (tradeId != null) {
            linkedTrade = tradeRepository.findByIdAndUserId(tradeId, user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Trade not found"));
            if (!Objects.equals(linkedTrade.getSessionId(), session.getId())) {
                throw new IllegalArgumentException("Trade is not linked to this session");
            }
        }

        SessionAutoTradeEvent event = SessionAutoTradeEvent.builder()
                .todaySession(session)
                .user(user)
                .trade(linkedTrade)
                .eventType(normalizeAutoTradeEventType(request == null ? null : request.getType()))
                .priceSide(normalizeAutoTradePriceSide(request == null ? null : request.getSide()))
                .price(normalizeAutoTradeEventPrice(request == null ? null : request.getPrice()))
                .note(normalizeAutoTradeEventNote(request == null ? null : request.getNote()))
                .build();
        SessionAutoTradeEvent saved = sessionAutoTradeEventRepository.save(event);
        return toAutoTradeEventDto(saved);
    }

    @Transactional(readOnly = true)
    public List<SessionLevelDto> listSessionLevels() {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireTodaySession(user);
        return listSessionLevels(session.getId(), null);
    }

    @Transactional(readOnly = true)
    public List<SessionLevelDto> listSessionLevels(UUID sessionId, String symbol) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSessionById(user, sessionId);
        return findSessionLevels(session.getId(), user.getId(), symbol).stream()
                .map(this::toSessionLevelDto)
                .toList();
    }

    @Transactional
    public TodaySessionResponse createSessionLevel(SessionLevelRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireTodaySession(user);
        return createSessionLevel(session.getId(), request);
    }

    @Transactional
    public TodaySessionResponse createSessionLevel(UUID sessionId, SessionLevelRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSessionById(user, sessionId);
        String symbol = normalizeOptionalTicker(request == null ? null : request.getSymbol());
        boolean swept = Boolean.TRUE.equals(request == null ? null : request.getSwept());
        OffsetDateTime sweptAt = swept ? OffsetDateTime.now(ZoneOffset.UTC) : null;

        SessionLevel level = SessionLevel.builder()
                .todaySession(session)
                .user(user)
                .label(normalizeLevelLabel(request == null ? null : request.getLabel()))
                .price(normalizeLevelPrice(request == null ? null : request.getPrice()))
                .symbol(symbol)
                .levelType(normalizeLevelType(request == null ? null : request.getType()))
                .timeframe(normalizeLevelTimeframe(request == null ? null : request.getTimeframe()))
                .zoneLow(normalizeLevelZonePrice(request == null ? null : request.getZoneLow(), "zoneLow"))
                .zoneHigh(normalizeLevelZonePrice(request == null ? null : request.getZoneHigh(), "zoneHigh"))
                .originRule(normalizeLevelOriginRule(request == null ? null : request.getOriginRule()))
                .strengthScore(normalizeStrengthScore(request == null ? null : request.getStrengthScore()))
                .status(swept ? LevelStatus.SWEPT : normalizeLevelStatus(request == null ? null : request.getStatus()))
                .touchedCount(swept ? 1 : 0)
                .lastTouchedAtUtc(sweptAt)
                .createdBy(LevelCreatedBy.USER)
                .expectation(normalizeLevelExpectation(request == null ? null : request.getExpectation()))
                .sweepRole(Boolean.TRUE.equals(request == null ? null : request.getSweepRole()))
                .entryRole(Boolean.TRUE.equals(request == null ? null : request.getEntryRole()))
                .slRole(Boolean.TRUE.equals(request == null ? null : request.getSlRole()))
                .tpRole(Boolean.TRUE.equals(request == null ? null : request.getTpRole()))
                .category(normalizeLevelCategory(request == null ? null : request.getCategory()))
                .notes(normalizeLevelNotes(request == null ? null : request.getNotes()))
                .sweptAt(sweptAt)
                .build();

        ensureValidZone(level.getZoneLow(), level.getZoneHigh());
        sessionLevelRepository.save(level);
        normalizeRolesAfterLevelUpdate(session, user.getId(), symbol, level.getId());
        syncLegacySweepSelection(session, user.getId(), symbol);
        return toResponse(session, user.getId());
    }

    @Transactional
    public TodaySessionResponse updateSessionLevel(UUID levelId, SessionLevelRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireTodaySession(user);
        return updateSessionLevel(session.getId(), levelId, request);
    }

    @Transactional
    public TodaySessionResponse updateSessionLevel(UUID sessionId, UUID levelId, SessionLevelRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSessionById(user, sessionId);

        SessionLevel level = sessionLevelRepository.findByIdAndTodaySession_IdAndUser_Id(levelId, session.getId(), user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Session level not found"));

        if (request != null && request.getLabel() != null) {
            level.setLabel(normalizeLevelLabel(request.getLabel()));
        }
        if (request != null) {
            level.setPrice(normalizeLevelPrice(request.getPrice()));
            if (request.getSymbol() != null) {
                level.setSymbol(normalizeOptionalTicker(request.getSymbol()));
            }
            if (request.getType() != null) {
                level.setLevelType(normalizeLevelType(request.getType()));
            }
            if (request.getTimeframe() != null) {
                level.setTimeframe(normalizeLevelTimeframe(request.getTimeframe()));
            }
            if (request.getZoneLow() != null || request.getZoneHigh() != null) {
                level.setZoneLow(normalizeLevelZonePrice(request.getZoneLow(), "zoneLow"));
                level.setZoneHigh(normalizeLevelZonePrice(request.getZoneHigh(), "zoneHigh"));
            }
            if (request.getOriginRule() != null) {
                level.setOriginRule(normalizeLevelOriginRule(request.getOriginRule()));
            }
            if (request.getStrengthScore() != null) {
                level.setStrengthScore(normalizeStrengthScore(request.getStrengthScore()));
            }
            if (request.getStatus() != null) {
                level.setStatus(normalizeLevelStatus(request.getStatus()));
            }
            if (request.getExpectation() != null) {
                level.setExpectation(normalizeLevelExpectation(request.getExpectation()));
            }
            if (request.getSweepRole() != null) {
                level.setSweepRole(request.getSweepRole());
            }
            if (request.getEntryRole() != null) {
                level.setEntryRole(request.getEntryRole());
            }
            if (request.getSlRole() != null) {
                level.setSlRole(request.getSlRole());
            }
            if (request.getTpRole() != null) {
                level.setTpRole(request.getTpRole());
            }
            level.setCategory(normalizeLevelCategory(request.getCategory()));
            level.setNotes(normalizeLevelNotes(request.getNotes()));
            if (request.getSwept() != null) {
                if (Boolean.TRUE.equals(request.getSwept())) {
                    OffsetDateTime touchedAt = OffsetDateTime.now(ZoneOffset.UTC);
                    level.setSweptAt(touchedAt);
                    level.setStatus(LevelStatus.SWEPT);
                    level.setTouchedCount((level.getTouchedCount() == null ? 0 : level.getTouchedCount()) + 1);
                    level.setLastTouchedAtUtc(touchedAt);
                } else {
                    level.setSweptAt(null);
                    if (level.getStatus() == LevelStatus.SWEPT) {
                        level.setStatus(LevelStatus.FRESH);
                    }
                }
            }
        }

        ensureValidZone(level.getZoneLow(), level.getZoneHigh());
        sessionLevelRepository.save(level);
        normalizeRolesAfterLevelUpdate(session, user.getId(), level.getSymbol(), level.getId());
        syncLegacySweepSelection(session, user.getId(), level.getSymbol());
        return toResponse(session, user.getId());
    }

    @Transactional
    public void deleteSessionLevel(UUID levelId) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireTodaySession(user);
        deleteSessionLevel(session.getId(), levelId);
    }

    @Transactional
    public void deleteSessionLevel(UUID sessionId, UUID levelId) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSessionById(user, sessionId);
        sessionLevelRepository.deleteByIdAndTodaySession_IdAndUser_Id(levelId, session.getId(), user.getId());
        if (Objects.equals(session.getActiveSweepLevelId(), levelId)) {
            session.setActiveSweepLevelId(null);
        }
        if (Objects.equals(session.getActiveEntryLevelId(), levelId)) {
            session.setActiveEntryLevelId(null);
        }
        if (Objects.equals(session.getActiveSlLevelId(), levelId)) {
            session.setActiveSlLevelId(null);
        }
        if (Objects.equals(session.getActiveTpLevelId(), levelId)) {
            session.setActiveTpLevelId(null);
        }
        todaySessionRepository.save(session);
    }

    @Transactional
    public TodaySessionResponse setActiveSweepLevel(TodaySessionActiveSweepLevelRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireTodaySession(user);
        SessionRoleSelectionRequest roleRequest = new SessionRoleSelectionRequest();
        roleRequest.setSweepLevelId(request == null ? null : request.getLevelId());
        return setSessionRoles(session.getId(), roleRequest);
    }

    @Transactional
    public TodaySessionResponse setSessionRoles(UUID sessionId, SessionRoleSelectionRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSessionById(user, sessionId);
        String symbol = normalizeOptionalTicker(request == null ? null : request.getSymbol());

        if (request == null) {
            TodaySession saved = todaySessionRepository.save(session);
            return toResponse(saved, user.getId());
        }

        if (request.getSweepPoolId() != null) {
            LiquidityPool pool = liquidityPoolRepository.findByIdAndTodaySession_IdAndUser_Id(request.getSweepPoolId(), session.getId(), user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Sweep pool not found"));
            symbol = normalizeOptionalTicker(firstNonBlank(symbol, pool.getSymbol()));
            clearSweepPoolRoleForSymbol(session.getId(), user.getId(), symbol, pool.getId());
            pool.setSweepRole(true);
            liquidityPoolRepository.save(pool);
            session.setActiveSweepPoolId(pool.getId());
            session.setActiveSweepLevelId(null);
        } else if (request.getSweepLevelId() != null) {
            SessionLevel sweepLevel = sessionLevelRepository.findByIdAndTodaySession_IdAndUser_Id(request.getSweepLevelId(), session.getId(), user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Sweep level not found"));
            symbol = normalizeOptionalTicker(firstNonBlank(symbol, sweepLevel.getSymbol()));
            clearLevelRoleForSymbol(session.getId(), user.getId(), symbol, RoleSelector.SWEEP, sweepLevel.getId());
            sweepLevel.setSweepRole(true);
            sessionLevelRepository.save(sweepLevel);
            session.setActiveSweepLevelId(sweepLevel.getId());
            session.setActiveSweepPoolId(null);
        } else if (request.getEntryLevelId() == null && request.getSlLevelId() == null && request.getTpLevelId() == null) {
            clearLevelRoleForSymbol(session.getId(), user.getId(), symbol, RoleSelector.SWEEP, null);
            clearSweepPoolRoleForSymbol(session.getId(), user.getId(), symbol, null);
            session.setActiveSweepLevelId(null);
            session.setActiveSweepPoolId(null);
        }

        if (request.getEntryLevelId() != null) {
            SessionLevel entryLevel = sessionLevelRepository.findByIdAndTodaySession_IdAndUser_Id(request.getEntryLevelId(), session.getId(), user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Entry level not found"));
            symbol = normalizeOptionalTicker(firstNonBlank(symbol, entryLevel.getSymbol()));
            clearLevelRoleForSymbol(session.getId(), user.getId(), symbol, RoleSelector.ENTRY, entryLevel.getId());
            entryLevel.setEntryRole(true);
            sessionLevelRepository.save(entryLevel);
            session.setActiveEntryLevelId(entryLevel.getId());
        }

        if (request.getSlLevelId() != null) {
            SessionLevel slLevel = sessionLevelRepository.findByIdAndTodaySession_IdAndUser_Id(request.getSlLevelId(), session.getId(), user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("SL level not found"));
            symbol = normalizeOptionalTicker(firstNonBlank(symbol, slLevel.getSymbol()));
            clearLevelRoleForSymbol(session.getId(), user.getId(), symbol, RoleSelector.SL, slLevel.getId());
            slLevel.setSlRole(true);
            sessionLevelRepository.save(slLevel);
            session.setActiveSlLevelId(slLevel.getId());
        }

        if (request.getTpLevelId() != null) {
            SessionLevel tpLevel = sessionLevelRepository.findByIdAndTodaySession_IdAndUser_Id(request.getTpLevelId(), session.getId(), user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("TP level not found"));
            symbol = normalizeOptionalTicker(firstNonBlank(symbol, tpLevel.getSymbol()));
            clearLevelRoleForSymbol(session.getId(), user.getId(), symbol, RoleSelector.TP, tpLevel.getId());
            tpLevel.setTpRole(true);
            sessionLevelRepository.save(tpLevel);
            session.setActiveTpLevelId(tpLevel.getId());
        }

        TodaySession saved = todaySessionRepository.save(session);
        return toResponse(saved, user.getId());
    }

    @Transactional(readOnly = true)
    public List<SessionPoolDto> listSessionPools(UUID sessionId, String symbol) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSessionById(user, sessionId);
        List<LiquidityPool> pools = isBlank(symbol)
                ? liquidityPoolRepository.findByTodaySession_IdAndUser_IdOrderByCreatedAtUtcAsc(session.getId(), user.getId())
                : liquidityPoolRepository.findByTodaySession_IdAndUser_IdAndSymbolIgnoreCaseOrderByCreatedAtUtcAsc(
                session.getId(),
                user.getId(),
                normalizeOptionalTicker(symbol)
        );
        return pools.stream().map(this::toSessionPoolDto).toList();
    }

    @Transactional
    public SessionPoolDto createSessionPool(UUID sessionId, SessionPoolRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSessionById(user, sessionId);
        String symbol = normalizeRequiredTicker(request == null ? null : request.getSymbol(), "Pool symbol is required");

        BigDecimal zoneLow = normalizeLevelZonePrice(request == null ? null : request.getZoneLow(), "zoneLow");
        BigDecimal zoneHigh = normalizeLevelZonePrice(request == null ? null : request.getZoneHigh(), "zoneHigh");
        ensureValidZone(zoneLow, zoneHigh);

        LiquidityPool pool = LiquidityPool.builder()
                .todaySession(session)
                .user(user)
                .symbol(symbol)
                .poolName(normalizePoolName(request == null ? null : request.getPoolName()))
                .type(normalizeLevelType(request == null ? null : request.getType()))
                .timeframe(normalizeLevelTimeframe(request == null ? null : request.getTimeframe()))
                .zoneLow(zoneLow)
                .zoneHigh(zoneHigh)
                .cleanlinessScore(normalizeCleanlinessScore(request == null ? null : request.getCleanlinessScore()))
                .status(normalizePoolStatus(request == null ? null : request.getStatus()))
                .sweepRole(Boolean.TRUE.equals(request == null ? null : request.getSweepRole()))
                .levels(resolvePoolLevels(session, user.getId(), request == null ? null : request.getLevelIds()))
                .build();

        LiquidityPool saved = liquidityPoolRepository.save(pool);
        if (saved.isSweepRole()) {
            clearSweepPoolRoleForSymbol(session.getId(), user.getId(), symbol, saved.getId());
            saved.setSweepRole(true);
            liquidityPoolRepository.save(saved);
            clearLevelRoleForSymbol(session.getId(), user.getId(), symbol, RoleSelector.SWEEP, null);
            session.setActiveSweepPoolId(saved.getId());
            session.setActiveSweepLevelId(null);
            todaySessionRepository.save(session);
        }
        return toSessionPoolDto(saved);
    }

    @Transactional
    public SessionPoolDto updateSessionPool(UUID sessionId, UUID poolId, SessionPoolRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSessionById(user, sessionId);
        LiquidityPool pool = liquidityPoolRepository.findByIdAndTodaySession_IdAndUser_Id(poolId, session.getId(), user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Liquidity pool not found"));

        String symbol = normalizeRequiredTicker(firstNonBlank(
                request == null ? null : request.getSymbol(),
                pool.getSymbol()
        ), "Pool symbol is required");
        pool.setSymbol(symbol);

        if (request != null && request.getPoolName() != null) {
            pool.setPoolName(normalizePoolName(request.getPoolName()));
        }
        if (request != null && request.getType() != null) {
            pool.setType(normalizeLevelType(request.getType()));
        }
        if (request != null && request.getTimeframe() != null) {
            pool.setTimeframe(normalizeLevelTimeframe(request.getTimeframe()));
        }
        if (request != null && request.getZoneLow() != null) {
            pool.setZoneLow(normalizeLevelZonePrice(request.getZoneLow(), "zoneLow"));
        }
        if (request != null && request.getZoneHigh() != null) {
            pool.setZoneHigh(normalizeLevelZonePrice(request.getZoneHigh(), "zoneHigh"));
        }
        ensureValidZone(pool.getZoneLow(), pool.getZoneHigh());
        if (request != null && request.getCleanlinessScore() != null) {
            pool.setCleanlinessScore(normalizeCleanlinessScore(request.getCleanlinessScore()));
        }
        if (request != null && request.getStatus() != null) {
            pool.setStatus(normalizePoolStatus(request.getStatus()));
        }
        if (request != null && request.getSweepRole() != null) {
            pool.setSweepRole(request.getSweepRole());
        }
        if (request != null && request.getLevelIds() != null) {
            pool.setLevels(resolvePoolLevels(session, user.getId(), request.getLevelIds()));
        }

        LiquidityPool saved = liquidityPoolRepository.save(pool);
        if (saved.isSweepRole()) {
            clearSweepPoolRoleForSymbol(session.getId(), user.getId(), symbol, saved.getId());
            saved.setSweepRole(true);
            liquidityPoolRepository.save(saved);
            clearLevelRoleForSymbol(session.getId(), user.getId(), symbol, RoleSelector.SWEEP, null);
            session.setActiveSweepPoolId(saved.getId());
            session.setActiveSweepLevelId(null);
        } else if (Objects.equals(session.getActiveSweepPoolId(), saved.getId())) {
            session.setActiveSweepPoolId(null);
        }
        todaySessionRepository.save(session);
        return toSessionPoolDto(saved);
    }

    @Transactional
    public void deleteSessionPool(UUID sessionId, UUID poolId) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSessionById(user, sessionId);
        liquidityPoolRepository.deleteByIdAndTodaySession_IdAndUser_Id(poolId, session.getId(), user.getId());
        if (Objects.equals(session.getActiveSweepPoolId(), poolId)) {
            session.setActiveSweepPoolId(null);
            todaySessionRepository.save(session);
        }
    }

    @Transactional(readOnly = true)
    public SessionNarrativeDto getSessionNarrative(UUID sessionId) {
        User user = currentUserService.getCurrentUser();
        requireSessionById(user, sessionId);
        return sessionNarrativeRepository.findBySessionIdAndUser_Id(sessionId, user.getId())
                .map(this::toSessionNarrativeDto)
                .orElse(null);
    }

    @Transactional
    public SessionNarrativeDto upsertSessionNarrative(UUID sessionId, SessionNarrativeRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSessionById(user, sessionId);

        Optional<SessionNarrative> existing = sessionNarrativeRepository
                .findBySessionIdAndUser_Id(session.getId(), user.getId());

        if (existing.isPresent()) {
            SessionNarrative narrative = existing.get();
            applyNarrativeRequest(narrative, request);
            sessionNarrativeRepository.flush();
            log.debug("Updated session narrative [sessionId={}, narrativeId={}]", session.getId(), narrative.getSessionId());
            return toSessionNarrativeDto(narrative);
        }

        SessionNarrative narrative = SessionNarrative.builder()
                .todaySession(session)
                .user(session.getUser())
                .build();
        applyNarrativeRequest(narrative, request);
        log.debug("Creating session narrative [sessionId={}, narrativeId={}]", session.getId(), narrative.getSessionId());
        SessionNarrative saved = sessionNarrativeRepository.saveAndFlush(narrative);
        log.debug("Created session narrative [sessionId={}, narrativeId={}]", session.getId(), saved.getSessionId());
        return toSessionNarrativeDto(saved);
    }

    @Transactional(readOnly = true)
    public List<SessionLevelSuggestionDto> suggestSessionLevels(UUID sessionId, String symbol) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSessionById(user, sessionId);
        String normalizedSymbol = normalizeOptionalTicker(symbol);
        List<SessionLevel> levels = findSessionLevels(session.getId(), user.getId(), normalizedSymbol);
        Set<LevelType> existingTypes = new HashSet<>();
        for (SessionLevel level : levels) {
            existingTypes.add(level.getLevelType() == null ? LevelType.OTHER : level.getLevelType());
        }

        List<SessionLevelSuggestionDto> suggestions = new ArrayList<>();
        addDefaultSuggestion(suggestions, existingTypes, LevelType.PDH, LevelTimeframe.D1, "Prior daily high is a common liquidity draw", 0.72);
        addDefaultSuggestion(suggestions, existingTypes, LevelType.PDL, LevelTimeframe.D1, "Prior daily low is a common liquidity draw", 0.72);
        addDefaultSuggestion(suggestions, existingTypes, LevelType.ASIA_H, LevelTimeframe.H1, "Asia high often anchors London manipulation", 0.68);
        addDefaultSuggestion(suggestions, existingTypes, LevelType.ASIA_L, LevelTimeframe.H1, "Asia low often anchors London manipulation", 0.68);
        addDefaultSuggestion(suggestions, existingTypes, LevelType.HTF_SWING_HIGH, LevelTimeframe.H1, "Recent H1 swing highs can frame external liquidity", 0.61);
        addDefaultSuggestion(suggestions, existingTypes, LevelType.HTF_SWING_LOW, LevelTimeframe.H1, "Recent H1 swing lows can frame external liquidity", 0.61);
        addDefaultSuggestion(suggestions, existingTypes, LevelType.EQH, LevelTimeframe.M15, "Equal highs cluster stop liquidity", 0.59);
        addDefaultSuggestion(suggestions, existingTypes, LevelType.EQL, LevelTimeframe.M15, "Equal lows cluster stop liquidity", 0.59);
        return suggestions;
    }

    @Transactional(readOnly = true)
    public List<ChecklistTemplateResponse> listChecklistTemplates(ChecklistTemplateType type) {
        User user = currentUserService.getCurrentUser();
        List<ChecklistTemplate> templates = type == null
                ? checklistTemplateRepository.findByUser_IdOrderByUpdatedAtDesc(user.getId())
                : checklistTemplateRepository.findByUser_IdAndTypeOrderByUpdatedAtDesc(user.getId(), type);
        return templates.stream().map(this::toChecklistTemplateResponse).toList();
    }

    @Transactional
    public ChecklistTemplateResponse createChecklistTemplate(ChecklistTemplateRequest request) {
        User user = currentUserService.getCurrentUser();
        ChecklistTemplateType type = request == null || request.getType() == null
                ? ChecklistTemplateType.PREREQS
                : request.getType();
        String name = normalizeTemplateName(request == null ? null : request.getName());
        List<ChecklistTemplateItemDto> items = normalizeTemplateItems(request == null ? null : request.getItems());

        ChecklistTemplate template = ChecklistTemplate.builder()
                .user(user)
                .name(name)
                .type(type)
                .isDefault(request != null && request.isDefault())
                .build();
        checklistTemplateRepository.save(template);

        if (template.isDefault()) {
            clearOtherDefaults(user.getId(), type, template.getId());
        }

        saveTemplateEntries(template, items);
        createChecklistTemplateVersion(template, user, items);
        return toChecklistTemplateResponse(template);
    }

    @Transactional
    public ChecklistTemplateResponse updateChecklistTemplate(UUID templateId, ChecklistTemplateRequest request) {
        User user = currentUserService.getCurrentUser();
        ChecklistTemplate template = checklistTemplateRepository.findByIdAndUser_Id(templateId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Checklist template not found"));

        ChecklistTemplateType targetType = request != null && request.getType() != null
                ? request.getType()
                : template.getType();

        template.setName(normalizeTemplateName(request == null ? null : request.getName()));
        template.setType(targetType);
        template.setDefault(request != null && request.isDefault());
        checklistTemplateRepository.save(template);

        if (template.isDefault()) {
            clearOtherDefaults(user.getId(), targetType, template.getId());
        }

        List<ChecklistTemplateItemDto> normalizedItems = normalizeTemplateItems(request == null ? null : request.getItems());
        saveTemplateEntries(template, normalizedItems);
        createChecklistTemplateVersion(template, user, normalizedItems);
        return toChecklistTemplateResponse(template);
    }

    @Transactional
    public void deleteChecklistTemplate(UUID templateId) {
        User user = currentUserService.getCurrentUser();
        ChecklistTemplate template = checklistTemplateRepository.findByIdAndUser_Id(templateId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Checklist template not found"));
        checklistTemplateRepository.delete(template);
    }

    @Transactional
    public TradeResponse startTrade(StartSessionTradeRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireTodaySession(user);
        enforceSessionGuardrails(session, user.getId());

        Trade activeTrade = tradeRepository
                .findFirstByUser_IdAndSessionIdAndStatusOrderByOpenedAtDescCreatedAtDesc(user.getId(), session.getId(), TradeStatus.OPEN)
                .orElse(null);
        if (activeTrade != null) {
            throw new IllegalArgumentException("An active trade already exists for this session");
        }

        if (request.getFeeling() != null && !TradeTaxonomy.FEELINGS_SET.contains(request.getFeeling().trim())) {
            throw new IllegalArgumentException("Invalid feeling selection");
        }

        String tradeSymbol = normalizeTicker(request.getSymbol());
        List<SessionChecklistItemDto> prereqsState = resolveChecklistItems(session, user.getId(), ChecklistTemplateType.PREREQS);
        List<SessionChecklistItemDto> triggersState = resolveChecklistItems(session, user.getId(), ChecklistTemplateType.TRIGGERS);
        BigDecimal rrAtEntry = computeRrAtEntry(
                request.getDirection(),
                request.getEntryPrice(),
                request.getStopLossPrice(),
                request.getTakeProfitPrice()
        );

        SessionNarrative narrative = sessionNarrativeRepository.findBySessionIdAndUser_Id(session.getId(), user.getId()).orElse(null);
        UUID sweepPoolId = firstNonNull(request.getSweepPoolId(), session.getActiveSweepPoolId());
        if (sweepPoolId != null) {
            LiquidityPool sweepPool = liquidityPoolRepository
                    .findByIdAndTodaySession_IdAndUser_Id(sweepPoolId, session.getId(), user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Sweep pool not found"));
            if (!Objects.equals(normalizeOptionalTicker(sweepPool.getSymbol()), tradeSymbol)) {
                throw new IllegalArgumentException("Selected sweep pool does not match trade symbol");
            }
        }
        SessionLevel sweepLevel = resolveRoleLevel(session, user.getId(), tradeSymbol, firstNonNull(request.getSweepLevelId(), session.getActiveSweepLevelId()));
        SessionLevel entryLevel = resolveRoleLevel(session, user.getId(), tradeSymbol, firstNonNull(request.getEntryLevelId(), session.getActiveEntryLevelId()));
        SessionLevel slLevel = resolveRoleLevel(session, user.getId(), tradeSymbol, firstNonNull(request.getSlLevelId(), session.getActiveSlLevelId()));
        SessionLevel tpLevel = resolveRoleLevel(session, user.getId(), tradeSymbol, firstNonNull(request.getTpLevelId(), session.getActiveTpLevelId()));

        List<String> strictMissingItems = new ArrayList<>();
        if (!isLockInComplete(session)) {
            strictMissingItems.add("lock-in");
        }
        if (!isChecklistComplete(prereqsState)) {
            strictMissingItems.add("prerequisites checklist");
        }
        if (!isChecklistComplete(triggersState)) {
            strictMissingItems.add("triggers checklist");
        }
        if (rrAtEntry == null || rrAtEntry.compareTo(BigDecimal.valueOf(1.5)) < 0) {
            strictMissingItems.add("RR >= 1.5R");
        }
        if (!isNarrativeComplete(narrative)) {
            strictMissingItems.add("narrative (draw/manipulation/confirmation)");
        }
        if (sweepLevel == null && sweepPoolId == null) {
            strictMissingItems.add("sweep role");
        }
        if (entryLevel == null) {
            strictMissingItems.add("entry role");
        }
        if (slLevel == null) {
            strictMissingItems.add("SL role");
        }

        boolean strictAPlusOnly = "A_PLUS_ONLY".equalsIgnoreCase(session.getLockInObjective());
        if (strictAPlusOnly && !strictMissingItems.isEmpty()) {
            throw new IllegalArgumentException("Cannot start trade. Missing: " + String.join(", ", strictMissingItems));
        }

        List<String> quickMissingItems = new ArrayList<>();
        if (request.getStopLossPrice() == null || request.getStopLossPrice().compareTo(BigDecimal.ZERO) <= 0) {
            quickMissingItems.add("stop loss");
        }
        if (isBlank(request.getEntryInvalidation())) {
            quickMissingItems.add("invalidation");
        }
        if (request.getRiskAmount() == null
                && (request.getQuantity() == null || request.getQuantity().compareTo(BigDecimal.ZERO) <= 0)) {
            quickMissingItems.add("risk amount or quantity");
        }
        if (!quickMissingItems.isEmpty()) {
            throw new IllegalArgumentException("Cannot start trade. Missing: " + String.join(", ", quickMissingItems));
        }

        List<SessionLevelDto> levelsSnapshot = findSessionLevels(session.getId(), user.getId(), null).stream()
                .map(this::toSessionLevelDto)
                .toList();

        TradeRequest tradeRequest = new TradeRequest();
        tradeRequest.setSymbol(tradeSymbol);
        tradeRequest.setMarket(request.getMarket() == null ? Market.FOREX : request.getMarket());
        tradeRequest.setDirection(request.getDirection());
        tradeRequest.setStatus(TradeStatus.OPEN);
        tradeRequest.setOpenedAt(OffsetDateTime.now(ZoneOffset.UTC));
        tradeRequest.setQuantity(request.getQuantity());
        tradeRequest.setEntryPrice(request.getEntryPrice());
        tradeRequest.setTakeProfitPrice(request.getTakeProfitPrice());
        tradeRequest.setStopLossPrice(request.getStopLossPrice());
        tradeRequest.setRiskAmount(request.getRiskAmount());
        tradeRequest.setTradeCurrency(normalizeOptionalText(request.getTradeCurrency()));
        tradeRequest.setProfileCurrency(normalizeOptionalText(user.getBaseCurrency()));
        tradeRequest.setFxRateTradeToProfile(request.getFxRateTradeToProfile());
        tradeRequest.setFxRateSource(normalizeOptionalText(request.getFxRateSource()));
        tradeRequest.setSession(request.getSession());
        tradeRequest.setSetupGrade(request.getSetupGrade());
        tradeRequest.setStrategyId(request.getStrategyId());
        tradeRequest.setStrategyTag(normalizeOptionalText(request.getStrategyTag()));
        tradeRequest.setRuleBreaks(Set.of());
        tradeRequest.setSessionId(session.getId());
        tradeRequest.setFeeling(normalizeOptionalText(request.getFeeling()));
        String initialNotes = normalizeOptionalText(firstNonBlank(request.getInitialNotes(), request.getNotes()));
        if (!strictAPlusOnly && !strictMissingItems.isEmpty()) {
            initialNotes = normalizeOptionalText(firstNonBlank(initialNotes, "Discipline: Incomplete"));
            if (initialNotes != null && !initialNotes.contains("Discipline: Incomplete")) {
                initialNotes = (initialNotes + "\nDiscipline: Incomplete").trim();
            }
        }
        tradeRequest.setInitialNotes(initialNotes);
        tradeRequest.setNotes(null);
        tradeRequest.setEntryJournalText(normalizeOptionalText(request.getEntryJournalText()));
        tradeRequest.setEntryInvalidation(normalizeOptionalText(request.getEntryInvalidation()));
        tradeRequest.setEntryScreenshotAssetIds(request.getEntryScreenshotAssetIds());
        tradeRequest.setSweepLevelId(sweepLevel == null ? null : sweepLevel.getId());
        tradeRequest.setSweepPoolId(sweepPoolId);
        tradeRequest.setEntryLevelId(entryLevel == null ? null : entryLevel.getId());
        tradeRequest.setSlLevelId(slLevel == null ? null : slLevel.getId());
        tradeRequest.setTpLevelId(tpLevel == null ? null : tpLevel.getId());
        tradeRequest.setNarrativeSnapshotJson(objectMapper.valueToTree(toSessionNarrativeDto(narrative)));
        tradeRequest.setSweepConfirmed(isTriggerCompleted(triggersState, "sweep"));
        tradeRequest.setDisplacementConfirmed(isTriggerCompleted(triggersState, "displacement"));
        tradeRequest.setMssConfirmed(isTriggerCompleted(triggersState, "mss"));
        tradeRequest.setLevelExpectation(entryLevel == null ? null : entryLevel.getExpectation());
        tradeRequest.setTimeSweepToEntrySeconds(computeSweepToEntrySeconds(sweepLevel, tradeRequest.getOpenedAt()));

        ObjectNode qualityInputs = objectMapper.createObjectNode();
        qualityInputs.put("prereqsComplete", isChecklistComplete(prereqsState));
        qualityInputs.put("triggersComplete", isChecklistComplete(triggersState));
        qualityInputs.put("prereqsCompletedCount", countCompleted(prereqsState));
        qualityInputs.put("triggersCompletedCount", countCompleted(triggersState));
        qualityInputs.put("rrAvailable", rrAtEntry != null);
        qualityInputs.put("rrThresholdMet", rrAtEntry != null && rrAtEntry.compareTo(BigDecimal.valueOf(1.5)) >= 0);
        qualityInputs.put("narrativeComplete", isNarrativeComplete(narrative));
        qualityInputs.put("rolesComplete", sweepLevel != null || sweepPoolId != null);

        ObjectNode lockInSnapshot = objectMapper.createObjectNode();
        lockInSnapshot.put("session", session.getLockInSession());
        lockInSnapshot.put("objective", session.getLockInObjective());
        lockInSnapshot.put("bias", session.getLockInBias());
        lockInSnapshot.put("biasReason", session.getLockInBiasReason());
        if (session.getProfitTarget() != null) {
            lockInSnapshot.put("profitTarget", session.getProfitTarget());
        }
        if (session.getLossLimit() != null) {
            lockInSnapshot.put("lossLimit", session.getLossLimit());
        }
        if (session.getMaxTrades() != null) {
            lockInSnapshot.put("maxTrades", session.getMaxTrades());
        }
        lockInSnapshot.set("narrative", objectMapper.valueToTree(toSessionNarrativeDto(narrative)));

        var snapshot = contextSnapshotService.createSnapshot(
                user,
                ContextSnapshotMode.LIVE,
                request.getStrategyId(),
                session.getPrereqsTemplate() == null ? null : session.getPrereqsTemplate().getId(),
                session.getPrereqsStateJson(),
                session.getTriggersTemplate() == null ? null : session.getTriggersTemplate().getId(),
                session.getTriggersStateJson(),
                sweepLevel == null ? null : sweepLevel.getId(),
                objectMapper.valueToTree(levelsSnapshot),
                lockInSnapshot,
                rrAtEntry,
                qualityInputs
        );
        tradeRequest.setContextSnapshotId(snapshot.getId());
        tradeRequest.setStrategyVersionId(snapshot.getStrategyVersionId());

        UUID linkedPlanId = request.getLinkedPlanId();
        if (linkedPlanId != null) {
            tradeRequest.setLinkedContentIds(Set.of(linkedPlanId));
        }

        TradeResponse response = tradeService.create(tradeRequest);
        refreshSessionStatus(session, user.getId());
        return response;
    }

    @Transactional
    public TradeResponse closeTrade(UUID tradeId, CloseSessionTradeRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireTodaySession(user);

        Trade existing = tradeRepository.findByIdAndUserId(tradeId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Trade not found"));
        if (!Objects.equals(existing.getSessionId(), session.getId())) {
            throw new IllegalArgumentException("Trade is not linked to today's session");
        }
        if (existing.getStatus() != TradeStatus.OPEN) {
            throw new IllegalArgumentException("Trade is already closed");
        }

        Set<String> normalizedRuleBreaks = normalizeRuleBreaks(request.getRuleBreaks());
        String postTradeNotes = normalizeOptionalText(request.getPostTradeNotes());

        BigDecimal exitPrice = request.getExitPrice();
        BigDecimal directionalMove = computeDirectionalPointMove(existing, exitPrice);
        BigDecimal mfePoints = directionalMove == null
                ? null
                : directionalMove.max(BigDecimal.ZERO).setScale(8, RoundingMode.HALF_UP);
        BigDecimal maePoints = directionalMove == null
                ? null
                : directionalMove.negate().max(BigDecimal.ZERO).setScale(8, RoundingMode.HALF_UP);

        TradeRequest update = toTradeUpdateRequest(existing);
        update.setStatus(TradeStatus.CLOSED);
        update.setClosedAt(OffsetDateTime.now(ZoneOffset.UTC));
        update.setExitPrice(exitPrice);
        update.setRuleBreaks(normalizedRuleBreaks);
        update.setNotes(postTradeNotes);
        update.setMfePoints(mfePoints);
        update.setMaePoints(maePoints);
        update.setSweepDepthPoints(null);
        update.setDisplacementSizePoints(null);
        update.setLevelExpectationMet(resolveExpectationOutcome(existing, exitPrice));

        TradeResponse updated = tradeService.update(existing.getId(), update);
        refreshSessionStatus(session, user.getId());
        return updated;
    }

    private void applyChecklistTypeState(TodaySession session,
                                         ChecklistTemplateType type,
                                         ChecklistTemplate template,
                                         List<SessionChecklistItemDto> items) {
        if (type == ChecklistTemplateType.TRIGGERS) {
            session.setTriggersTemplate(template);
            session.setTriggersStateJson(writeChecklistItems(items));
            return;
        }
        session.setPrereqsTemplate(template);
        session.setPrereqsStateJson(writeChecklistItems(items));
    }

    private ChecklistTemplate getTemplateForType(TodaySession session, ChecklistTemplateType type) {
        return type == ChecklistTemplateType.TRIGGERS ? session.getTriggersTemplate() : session.getPrereqsTemplate();
    }

    private void applyActiveSweepLevel(TodaySession session, UUID userId, UUID levelId) {
        SessionLevel level = sessionLevelRepository.findByIdAndTodaySession_IdAndUser_Id(levelId, session.getId(), userId).orElse(null);
        if (level == null) {
            throw new EntityNotFoundException("Sweep level not found");
        }
        String symbol = normalizeOptionalTicker(level.getSymbol());
        clearSweepPoolRoleForSymbol(session.getId(), userId, symbol, null);
        clearLevelRoleForSymbol(session.getId(), userId, symbol, RoleSelector.SWEEP, levelId);
        level.setSweepRole(true);
        sessionLevelRepository.save(level);
        session.setActiveSweepLevelId(levelId);
        session.setActiveSweepPoolId(null);
    }

    private void clearOtherDefaults(UUID userId, ChecklistTemplateType type, UUID keepId) {
        List<ChecklistTemplate> templates = checklistTemplateRepository.findByUser_IdAndTypeOrderByUpdatedAtDesc(userId, type);
        List<ChecklistTemplate> changed = templates.stream()
                .filter(ChecklistTemplate::isDefault)
                .filter(item -> !Objects.equals(item.getId(), keepId))
                .peek(item -> item.setDefault(false))
                .toList();
        if (!changed.isEmpty()) {
            checklistTemplateRepository.saveAll(changed);
        }
    }

    private void saveTemplateEntries(ChecklistTemplate template, List<ChecklistTemplateItemDto> items) {
        List<ChecklistTemplateEntry> existing = checklistTemplateEntryRepository
                .findByTemplate_IdOrderBySortOrderAscCreatedAtAsc(template.getId());
        Map<UUID, ChecklistTemplateEntry> byId = new HashMap<>();
        for (ChecklistTemplateEntry entry : existing) {
            byId.put(entry.getId(), entry);
        }

        Set<UUID> keepIds = new HashSet<>();
        for (int index = 0; index < items.size(); index++) {
            ChecklistTemplateItemDto item = items.get(index);
            ChecklistTemplateEntry entry = null;
            UUID itemId = parseUuid(normalizeOptionalText(item.getId()));
            if (itemId != null) {
                entry = byId.get(itemId);
            }
            if (entry == null) {
                entry = ChecklistTemplateEntry.builder()
                        .template(template)
                        .build();
            }

            entry.setTemplate(template);
            entry.setItemText(item.getText());
            entry.setSortOrder(item.getOrder() == null ? index : Math.max(0, item.getOrder()));
            entry.setRequired(item.isRequired());
            entry.setHasNote(item.isHasNote());
            entry.setNotePlaceholder(item.isHasNote() ? normalizeNotePlaceholder(item.getNotePlaceholder()) : null);
            entry.setHasValue(item.isHasValue());
            entry.setValueLabel(item.isHasValue() ? normalizeValueLabel(item.getValueLabel()) : null);
            entry.setValueType(item.isHasValue() ? normalizeValueType(item.getValueType()) : ChecklistValueType.TEXT);
            entry.setDefaultChecked(item.isDefaultChecked());

            ChecklistTemplateEntry saved = checklistTemplateEntryRepository.save(entry);
            keepIds.add(saved.getId());
        }

        for (ChecklistTemplateEntry entry : existing) {
            if (!keepIds.contains(entry.getId())) {
                checklistTemplateEntryRepository.delete(entry);
            }
        }
    }

    private void createChecklistTemplateVersion(ChecklistTemplate template,
                                                User user,
                                                List<ChecklistTemplateItemDto> items) {
        int nextVersion = checklistTemplateVersionRepository.findFirstByTemplate_IdOrderByVersionNumberDesc(template.getId())
                .map(item -> item.getVersionNumber() + 1)
                .orElse(1);
        ChecklistTemplateVersion version = ChecklistTemplateVersion.builder()
                .template(template)
                .user(user)
                .versionNumber(nextVersion)
                .itemsJson(objectMapper.valueToTree(items == null ? List.of() : items))
                .build();
        checklistTemplateVersionRepository.save(version);
    }

    private TradeRequest toTradeUpdateRequest(Trade trade) {
        TradeRequest request = new TradeRequest();
        request.setSymbol(trade.getSymbol());
        request.setMarket(trade.getMarket());
        request.setDirection(trade.getDirection());
        request.setStatus(trade.getStatus());
        request.setOpenedAt(trade.getOpenedAt());
        request.setClosedAt(trade.getClosedAt());
        request.setQuantity(trade.getQuantity());
        request.setEntryPrice(trade.getEntryPrice());
        request.setExitPrice(trade.getExitPrice());
        request.setStopLossPrice(trade.getStopLossPrice());
        request.setTakeProfitPrice(trade.getTakeProfitPrice());
        request.setFees(trade.getFees());
        request.setFeesProfileCurrency(trade.getFeesProfileCurrency());
        request.setCommission(trade.getCommission());
        request.setSlippage(trade.getSlippage());
        request.setTradeCurrency(trade.getTradeCurrency());
        request.setProfileCurrency(trade.getProfileCurrency());
        request.setFxRateTradeToProfile(trade.getFxRateTradeToProfile());
        request.setFxRateTimestamp(trade.getFxRateTimestamp());
        request.setFxRateSource(trade.getFxRateSource());
        request.setPnlProfileCurrency(trade.getPnlProfileCurrency());
        request.setRiskAmount(trade.getRiskAmount());
        request.setCapitalUsed(trade.getCapitalUsed());
        request.setTimeframe(trade.getTimeframe());
        request.setSetup(trade.getSetup());
        request.setStrategyTag(trade.getStrategyTag());
        request.setCatalystTag(trade.getCatalystTag());
        request.setStrategyId(trade.getStrategyId());
        request.setStrategyVersionId(trade.getStrategyVersionId());
        request.setContextSnapshotId(trade.getContextSnapshotId());
        request.setSetupGrade(trade.getSetupGrade());
        request.setSession(trade.getSession());
        request.setSessionId(trade.getSessionId());
        request.setSweepLevelId(trade.getSweepLevelId());
        request.setSweepPoolId(trade.getSweepPoolId());
        request.setEntryLevelId(trade.getEntryLevelId());
        request.setSlLevelId(trade.getSlLevelId());
        request.setTpLevelId(trade.getTpLevelId());
        request.setNarrativeSnapshotJson(trade.getNarrativeSnapshotJson());
        request.setSweepConfirmed(trade.getSweepConfirmed());
        request.setDisplacementConfirmed(trade.getDisplacementConfirmed());
        request.setMssConfirmed(trade.getMssConfirmed());
        request.setSweepDepthPoints(trade.getSweepDepthPoints());
        request.setDisplacementSizePoints(trade.getDisplacementSizePoints());
        request.setTimeSweepToEntrySeconds(trade.getTimeSweepToEntrySeconds());
        request.setMfePoints(trade.getMfePoints());
        request.setMaePoints(trade.getMaePoints());
        request.setLevelExpectationMet(trade.getLevelExpectationMet());
        request.setLevelExpectation(trade.getLevelExpectation());
        request.setFeeling(trade.getFeeling());
        request.setLinkedContentIds(trade.getLinkedContentIds());
        request.setLinkedPlanIds(trade.getLinkedPlanIds());
        request.setRuleBreaks(trade.getRuleBreaks());
        request.setNotes(trade.getNotes());
        request.setInitialNotes(trade.getInitialNotes());
        request.setEntryJournalText(trade.getEntryJournalText());
        request.setEntryInvalidation(trade.getEntryInvalidation());
        request.setEntryScreenshotAssetIds(trade.getEntryScreenshotAssetIds());
        request.setAccountId(trade.getAccount() == null ? null : trade.getAccount().getId());
        return request;
    }

    private void enforceSessionGuardrails(TodaySession session, UUID userId) {
        if (session.getStatus() == TodaySessionStatus.COMPLETED) {
            throw new IllegalArgumentException("Session is completed. Configure a new one tomorrow.");
        }
        SessionProgress progress = computeProgress(session, userId);
        if (isStopConditionReached(session, progress)) {
            session.setStatus(TodaySessionStatus.COMPLETED);
            todaySessionRepository.save(session);
            throw new IllegalArgumentException("Session guardrail reached. Trading is locked for today.");
        }
    }

    private void refreshSessionStatus(TodaySession session, UUID userId) {
        SessionProgress progress = computeProgress(session, userId);
        if (isStopConditionReached(session, progress)) {
            session.setStatus(TodaySessionStatus.COMPLETED);
        } else if (session.getStatus() == null) {
            session.setStatus(TodaySessionStatus.ACTIVE);
        }
        todaySessionRepository.save(session);
    }

    private SessionProgress computeProgress(TodaySession session, UUID userId) {
        long closedTrades = tradeRepository.countByUser_IdAndSessionIdAndStatus(userId, session.getId(), TradeStatus.CLOSED);
        BigDecimal realizedPnl = tradeRepository.sumNetPnlByUserAndSessionAndStatus(userId, session.getId(), TradeStatus.CLOSED);
        if (realizedPnl == null) {
            realizedPnl = BigDecimal.ZERO;
        }
        return new SessionProgress(closedTrades, realizedPnl);
    }

    private boolean isStopConditionReached(TodaySession session, SessionProgress progress) {
        if (progress.closedTrades() >= session.getMaxTrades()) {
            return true;
        }
        if (progress.realizedPnl().compareTo(session.getProfitTarget()) >= 0) {
            return true;
        }
        BigDecimal negativeLossLimit = session.getLossLimit().negate();
        return progress.realizedPnl().compareTo(negativeLossLimit) <= 0;
    }

    private BigDecimal computeRrAtEntry(Direction direction,
                                        BigDecimal entryPrice,
                                        BigDecimal stopLossPrice,
                                        BigDecimal takeProfitPrice) {
        if (direction == null || entryPrice == null || stopLossPrice == null || takeProfitPrice == null) {
            return null;
        }
        BigDecimal riskDistance = entryPrice.subtract(stopLossPrice).abs();
        if (riskDistance.compareTo(BigDecimal.ZERO) == 0) {
            return null;
        }
        BigDecimal rewardDistance = takeProfitPrice.subtract(entryPrice).abs();
        return rewardDistance.divide(riskDistance, 4, RoundingMode.HALF_UP);
    }

    private boolean isChecklistComplete(List<SessionChecklistItemDto> items) {
        if (items == null || items.isEmpty()) {
            return false;
        }
        return items.stream()
                .filter(SessionChecklistItemDto::isRequired)
                .allMatch(SessionChecklistItemDto::isCompleted);
    }

    private long countCompleted(List<SessionChecklistItemDto> items) {
        if (items == null || items.isEmpty()) {
            return 0;
        }
        return items.stream().filter(SessionChecklistItemDto::isCompleted).count();
    }

    private TodaySessionResponse toResponse(TodaySession session, UUID userId) {
        List<SessionChecklistItemDto> prereqs = resolveChecklistItems(session, userId, ChecklistTemplateType.PREREQS);
        List<SessionChecklistItemDto> triggers = resolveChecklistItems(session, userId, ChecklistTemplateType.TRIGGERS);

        return toResponse(session, userId, prereqs, triggers);
    }

    private TodaySessionResponse toResponse(TodaySession session,
                                            UUID userId,
                                            List<SessionChecklistItemDto> prereqs,
                                            List<SessionChecklistItemDto> triggers) {
        SessionProgress progress = computeProgress(session, userId);
        long remainingTrades = Math.max(0, session.getMaxTrades() - progress.closedTrades());

        TradeResponse activeTrade = tradeRepository
                .findFirstByUser_IdAndSessionIdAndStatusOrderByOpenedAtDescCreatedAtDesc(userId, session.getId(), TradeStatus.OPEN)
                .map(trade -> tradeService.getById(trade.getId()))
                .orElse(null);

        List<SessionLevelDto> levels = sessionLevelRepository
                .findByTodaySession_IdAndUser_IdOrderByCreatedAtAsc(session.getId(), userId)
                .stream()
                .map(this::toSessionLevelDto)
                .toList();
        List<SessionPoolDto> pools = liquidityPoolRepository
                .findByTodaySession_IdAndUser_IdOrderByCreatedAtUtcAsc(session.getId(), userId)
                .stream()
                .map(this::toSessionPoolDto)
                .toList();
        SessionNarrativeDto narrative = sessionNarrativeRepository
                .findBySessionIdAndUser_Id(session.getId(), userId)
                .map(this::toSessionNarrativeDto)
                .orElse(null);

        return TodaySessionResponse.builder()
                .id(session.getId())
                .sessionDate(session.getSessionDate())
                .profitTarget(session.getProfitTarget())
                .lossLimit(session.getLossLimit())
                .maxTrades(session.getMaxTrades())
                .status(session.getStatus())
                .realizedPnl(progress.realizedPnl())
                .closedTradesCount(progress.closedTrades())
                .remainingTrades(remainingTrades)
                .plannedTickers(readStringList(session.getPlannedTickersJson()))
                .checklistItems(prereqs)
                .checklistTemplateId(session.getPrereqsTemplate() == null ? null : session.getPrereqsTemplate().getId())
                .prereqsChecklistItems(prereqs)
                .triggerChecklistItems(triggers)
                .prereqsTemplateId(session.getPrereqsTemplate() == null ? null : session.getPrereqsTemplate().getId())
                .triggerTemplateId(session.getTriggersTemplate() == null ? null : session.getTriggersTemplate().getId())
                .lockInSession(session.getLockInSession())
                .lockInObjective(session.getLockInObjective())
                .lockInBias(session.getLockInBias())
                .lockInBiasReason(session.getLockInBiasReason())
                .lockInAt(session.getLockInAt())
                .autoJournalState(defaultAutoJournalState(session.getAutoJournalState()))
                .autoJournalTolerancePips(defaultAutoJournalTolerancePips(session.getAutoJournalTolerancePips()))
                .autoJournalTimeoutMin(defaultAutoJournalTimeoutMin(session.getAutoJournalTimeoutMin()))
                .activeSweepLevelId(session.getActiveSweepLevelId())
                .activeEntryLevelId(session.getActiveEntryLevelId())
                .activeSlLevelId(session.getActiveSlLevelId())
                .activeTpLevelId(session.getActiveTpLevelId())
                .activeSweepPoolId(session.getActiveSweepPoolId())
                .levels(levels)
                .pools(pools)
                .narrative(narrative)
                .activeTrade(activeTrade)
                .createdAt(session.getCreatedAt())
                .updatedAt(session.getUpdatedAt())
                .build();
    }

    private SessionLevelDto toSessionLevelDto(SessionLevel level) {
        return SessionLevelDto.builder()
                .id(level.getId())
                .label(level.getLabel())
                .price(level.getPrice())
                .symbol(level.getSymbol())
                .type(level.getLevelType())
                .timeframe(level.getTimeframe())
                .zoneLow(level.getZoneLow())
                .zoneHigh(level.getZoneHigh())
                .originRule(level.getOriginRule())
                .strengthScore(level.getStrengthScore())
                .status(level.getStatus())
                .touchedCount(level.getTouchedCount())
                .lastTouchedAtUtc(level.getLastTouchedAtUtc())
                .createdBy(level.getCreatedBy())
                .expectation(level.getExpectation())
                .sweepRole(level.isSweepRole())
                .entryRole(level.isEntryRole())
                .slRole(level.isSlRole())
                .tpRole(level.isTpRole())
                .category(level.getCategory())
                .notes(level.getNotes())
                .sweptAt(level.getSweptAt())
                .createdAt(level.getCreatedAt())
                .updatedAt(level.getUpdatedAt())
                .build();
    }

    private TodaySession requireTodaySession(User user) {
        LocalDate today = resolveSessionDate();
        return todaySessionRepository.findByUser_IdAndSessionDate(user.getId(), today)
                .orElseThrow(() -> new IllegalArgumentException("Session is not configured for today"));
    }

    private LocalDate resolveSessionDate() {
        ZoneId zone = ZoneId.of(TimezoneService.DEFAULT_TIMEZONE);
        return LocalDate.now(zone);
    }

    private AutoJournalState defaultAutoJournalState(AutoJournalState state) {
        return state == null ? AutoJournalState.DISARMED : state;
    }

    private BigDecimal defaultAutoJournalTolerancePips(BigDecimal tolerancePips) {
        return tolerancePips == null ? TodaySessionDefaults.AUTO_JOURNAL_TOLERANCE_PIPS : tolerancePips;
    }

    private int defaultAutoJournalTimeoutMin(Integer timeoutMinutes) {
        return timeoutMinutes == null ? TodaySessionDefaults.AUTO_JOURNAL_TIMEOUT_MINUTES : timeoutMinutes;
    }

    private void hydrateLegacyChecklistState(TodaySession session) {
        if (isBlank(session.getPrereqsStateJson()) && !isBlank(session.getChecklistStateJson())) {
            session.setPrereqsStateJson(session.getChecklistStateJson());
        }
        if (session.getPrereqsTemplate() == null && session.getChecklistTemplate() != null) {
            session.setPrereqsTemplate(session.getChecklistTemplate());
        }
    }

    private void syncLegacyChecklistFields(TodaySession session) {
        if (!isBlank(session.getPrereqsStateJson())) {
            session.setChecklistStateJson(session.getPrereqsStateJson());
        }
        if (session.getPrereqsTemplate() != null) {
            session.setChecklistTemplate(session.getPrereqsTemplate());
        }
    }

    private String writeStringList(List<String> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(values);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid list payload");
        }
    }

    private List<String> readStringList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<String> values = objectMapper.readValue(json, STRING_LIST);
            return values == null ? List.of() : values.stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(item -> !item.isEmpty())
                    .toList();
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private String writeChecklistItems(List<SessionChecklistItemDto> items) {
        if (items == null || items.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(items);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid checklist payload");
        }
    }

    private List<SessionChecklistItemDto> readChecklistItems(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<SessionChecklistItemDto> items = objectMapper.readValue(json, CHECKLIST_LIST);
            return items == null ? List.of() : items;
        } catch (Exception ignored) {
            return readChecklistItemsFromObjects(json);
        }
    }

    private List<SessionChecklistItemDto> readChecklistItemsFromObjects(String json) {
        try {
            List<Map<String, Object>> rows = objectMapper.readValue(json, CHECKLIST_OBJECT_LIST);
            if (rows == null || rows.isEmpty()) {
                return List.of();
            }

            List<SessionChecklistItemDto> items = new ArrayList<>();
            int index = 0;
            for (Map<String, Object> row : rows) {
                if (row == null || row.isEmpty()) {
                    continue;
                }

                String text = normalizeOptionalText(stringValue(row.get("text")));
                if (text == null) {
                    continue;
                }

                String id = normalizeOptionalText(stringValue(row.get("id")));
                boolean completed = booleanValue(row.get("completed"));

                items.add(SessionChecklistItemDto.builder()
                        .id(id == null ? "item-" + (index + 1) : id)
                        .text(text)
                        .order(index)
                        .required(true)
                        .valueType(ChecklistValueType.TEXT)
                        .completed(completed)
                        .build());
                index++;
            }

            return items;
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private List<SessionChecklistItemDto> normalizeChecklistItems(List<SessionChecklistItemDto> items) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        if (items.size() > MAX_CHECKLIST_ITEMS) {
            throw new IllegalArgumentException("Checklist cannot contain more than " + MAX_CHECKLIST_ITEMS + " items");
        }

        List<SessionChecklistItemDto> normalized = new ArrayList<>();
        Set<String> seenIds = new HashSet<>();

        for (int index = 0; index < items.size(); index++) {
            SessionChecklistItemDto item = items.get(index);
            String text = normalizeChecklistText(item == null ? null : item.getText());
            String requestedId = normalizeOptionalText(item == null ? null : item.getId());
            String id = requestedId == null ? "item-" + (index + 1) : requestedId;
            if (!seenIds.add(id)) {
                id = id + "-" + (index + 1);
                seenIds.add(id);
            }

            boolean hasNote = item != null && item.isHasNote();
            boolean hasValue = item != null && item.isHasValue();

            normalized.add(SessionChecklistItemDto.builder()
                    .id(id)
                    .text(text)
                    .order(item == null || item.getOrder() == null ? index : Math.max(0, item.getOrder()))
                    .required(item == null || item.isRequired())
                    .hasNote(hasNote)
                    .notePlaceholder(hasNote ? normalizeNotePlaceholder(item.getNotePlaceholder()) : null)
                    .note(hasNote ? normalizeNoteValue(item.getNote()) : null)
                    .hasValue(hasValue)
                    .valueLabel(hasValue ? normalizeValueLabel(item.getValueLabel()) : null)
                    .valueType(hasValue ? normalizeValueType(item.getValueType()) : ChecklistValueType.TEXT)
                    .value(hasValue ? normalizeValue(item.getValue()) : null)
                    .defaultChecked(item != null && item.isDefaultChecked())
                    .completed(item != null && item.isCompleted())
                    .build());
        }

        return normalized;
    }

    private List<ChecklistTemplateItemDto> normalizeTemplateItems(List<ChecklistTemplateItemDto> items) {
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("Template items are required");
        }
        if (items.size() > MAX_CHECKLIST_ITEMS) {
            throw new IllegalArgumentException("Template cannot contain more than " + MAX_CHECKLIST_ITEMS + " items");
        }

        List<ChecklistTemplateItemDto> normalized = new ArrayList<>();
        for (int index = 0; index < items.size(); index++) {
            ChecklistTemplateItemDto item = items.get(index);
            String text = normalizeChecklistText(item == null ? null : item.getText());
            boolean hasNote = item != null && item.isHasNote();
            boolean hasValue = item != null && item.isHasValue();

            normalized.add(ChecklistTemplateItemDto.builder()
                    .id(normalizeOptionalText(item == null ? null : item.getId()))
                    .text(text)
                    .order(item == null || item.getOrder() == null ? index : Math.max(0, item.getOrder()))
                    .required(item == null || item.isRequired())
                    .hasNote(hasNote)
                    .notePlaceholder(hasNote ? normalizeNotePlaceholder(item.getNotePlaceholder()) : null)
                    .hasValue(hasValue)
                    .valueLabel(hasValue ? normalizeValueLabel(item.getValueLabel()) : null)
                    .valueType(hasValue ? normalizeValueType(item.getValueType()) : ChecklistValueType.TEXT)
                    .defaultChecked(item != null && item.isDefaultChecked())
                    .build());
        }

        return normalized;
    }

    private List<SessionChecklistItemDto> resolveChecklistItems(TodaySession session,
                                                                UUID userId,
                                                                ChecklistTemplateType type) {
        List<SessionChecklistItemDto> persistedState = readChecklistItems(getChecklistStateJson(session, type));
        ChecklistTemplate template = getTemplateForType(session, type);
        if (template != null && template.getId() != null) {
            List<SessionChecklistItemDto> templateRows = loadTemplateRows(template.getId());
            if (hasCustomChecklistStructure(persistedState, templateRows)) {
                return normalizeChecklistItems(persistedState);
            }
            return mergeWithTemplateEntries(template.getId(), persistedState);
        }

        // Explicit session-scoped checklist rows should remain authoritative once detached from templates.
        if (type == ChecklistTemplateType.TRIGGERS && !isBlank(session.getTriggersStateJson()) && !persistedState.isEmpty()) {
            return normalizeChecklistItems(persistedState);
        }
        // For prereqs keep legacy checklist migration path unless dedicated prereqs JSON exists.
        if (type == ChecklistTemplateType.PREREQS && !isBlank(session.getPrereqsStateJson()) && !persistedState.isEmpty()) {
            return normalizeChecklistItems(persistedState);
        }

        if (type == ChecklistTemplateType.PREREQS) {
            if (!isBlank(session.getChecklistStateJson())) {
                return mergeWithGlobalChecklistTemplate(userId, persistedState);
            }
            Optional<ChecklistTemplate> defaultTemplate = checklistTemplateRepository
                    .findFirstByUser_IdAndTypeAndIsDefaultTrue(userId, ChecklistTemplateType.PREREQS);
            if (defaultTemplate.isPresent()) {
                return mergeWithTemplateEntries(defaultTemplate.get().getId(), persistedState);
            }
            List<SessionChecklistItemDto> merged = mergeWithGlobalChecklistTemplate(userId, persistedState);
            if (!merged.isEmpty()) {
                return merged;
            }
            return mergeTemplateRows(fallbackPrereqsTemplateItems(), persistedState);
        }

        Optional<ChecklistTemplate> defaultTemplate = checklistTemplateRepository
                .findFirstByUser_IdAndTypeAndIsDefaultTrue(userId, ChecklistTemplateType.TRIGGERS);
        if (defaultTemplate.isPresent()) {
            return mergeWithTemplateEntries(defaultTemplate.get().getId(), persistedState);
        }
        return mergeTemplateRows(fallbackTriggerTemplateItems(), persistedState);
    }

    private String getChecklistStateJson(TodaySession session, ChecklistTemplateType type) {
        if (type == ChecklistTemplateType.TRIGGERS) {
            return firstNonBlank(session.getTriggersStateJson());
        }
        return firstNonBlank(session.getPrereqsStateJson(), session.getChecklistStateJson());
    }

    private List<SessionChecklistItemDto> mergeWithGlobalChecklistTemplate(UUID userId, List<SessionChecklistItemDto> persistedState) {
        List<ChecklistTemplateItem> templateItems = checklistTemplateItemRepository
                .findByUser_IdAndIsEnabledTrueOrderBySortOrderAscCreatedAtAsc(userId);
        if (templateItems.isEmpty()) {
            return List.of();
        }

        List<SessionChecklistItemDto> rows = templateItems.stream()
                .limit(MAX_CHECKLIST_ITEMS)
                .map(item -> SessionChecklistItemDto.builder()
                        .id(item.getId().toString())
                        .text(item.getText())
                        .order(item.getSortOrder())
                        .required(true)
                        .valueType(ChecklistValueType.TEXT)
                        .defaultChecked(false)
                        .completed(false)
                        .build())
                .toList();

        return mergeTemplateRows(rows, persistedState);
    }

    private List<SessionChecklistItemDto> mergeWithTemplateEntries(UUID templateId,
                                                                    List<SessionChecklistItemDto> persistedState) {
        List<SessionChecklistItemDto> templateRows = loadTemplateRows(templateId);
        if (templateRows.isEmpty()) {
            return List.of();
        }
        return mergeTemplateRows(templateRows, persistedState);
    }

    private List<SessionChecklistItemDto> mergeTemplateRows(List<SessionChecklistItemDto> templateRows,
                                                            List<SessionChecklistItemDto> persistedState) {
        if (templateRows.isEmpty()) {
            return List.of();
        }

        ChecklistStateMaps maps = buildStateMaps(persistedState);
        List<SessionChecklistItemDto> merged = new ArrayList<>();

        for (int index = 0; index < templateRows.size() && index < MAX_CHECKLIST_ITEMS; index++) {
            SessionChecklistItemDto template = templateRows.get(index);
            SessionChecklistItemDto state = null;
            if (template.getId() != null) {
                state = maps.byId().get(template.getId());
            }
            if (state == null) {
                state = maps.byText().get(normalizeChecklistMatchText(template.getText()));
            }

            merged.add(SessionChecklistItemDto.builder()
                    .id(template.getId())
                    .text(template.getText())
                    .order(template.getOrder() == null ? index : template.getOrder())
                    .required(template.isRequired())
                    .hasNote(template.isHasNote())
                    .notePlaceholder(template.getNotePlaceholder())
                    .note(template.isHasNote() ? normalizeNoteValue(state == null ? null : state.getNote()) : null)
                    .hasValue(template.isHasValue())
                    .valueLabel(template.getValueLabel())
                    .valueType(template.getValueType() == null ? ChecklistValueType.TEXT : template.getValueType())
                    .value(template.isHasValue() ? normalizeValue(state == null ? null : state.getValue()) : null)
                    .defaultChecked(template.isDefaultChecked())
                    .completed(state == null ? template.isDefaultChecked() : state.isCompleted())
                    .build());
        }

        return merged;
    }

    private List<SessionChecklistItemDto> loadTemplateRows(UUID templateId) {
        List<ChecklistTemplateEntry> entries = checklistTemplateEntryRepository
                .findByTemplate_IdOrderBySortOrderAscCreatedAtAsc(templateId);
        if (entries.isEmpty()) {
            return List.of();
        }

        return entries.stream()
                .limit(MAX_CHECKLIST_ITEMS)
                .map(entry -> SessionChecklistItemDto.builder()
                        .id(entry.getId().toString())
                        .text(entry.getItemText())
                        .order(entry.getSortOrder())
                        .required(entry.isRequired())
                        .hasNote(entry.isHasNote())
                        .notePlaceholder(entry.getNotePlaceholder())
                        .hasValue(entry.isHasValue())
                        .valueLabel(entry.getValueLabel())
                        .valueType(entry.getValueType() == null ? ChecklistValueType.TEXT : entry.getValueType())
                        .defaultChecked(entry.isDefaultChecked())
                        .completed(entry.isDefaultChecked())
                        .build())
                .toList();
    }

    private boolean hasCustomChecklistStructure(List<SessionChecklistItemDto> stateItems,
                                                List<SessionChecklistItemDto> templateRows) {
        if (stateItems == null || stateItems.isEmpty()) {
            return false;
        }
        if (templateRows == null || templateRows.isEmpty()) {
            return true;
        }
        if (stateItems.size() != templateRows.size()) {
            return true;
        }

        Map<String, SessionChecklistItemDto> byId = new HashMap<>();
        for (SessionChecklistItemDto templateRow : templateRows) {
            String id = normalizeOptionalText(templateRow.getId());
            if (id != null) {
                byId.put(id, templateRow);
            }
        }

        for (int index = 0; index < stateItems.size(); index++) {
            SessionChecklistItemDto state = stateItems.get(index);
            if (state == null) {
                return true;
            }
            String id = normalizeOptionalText(state.getId());
            SessionChecklistItemDto template = id == null ? null : byId.get(id);
            if (template == null) {
                return true;
            }

            int stateOrder = state.getOrder() == null ? index : Math.max(0, state.getOrder());
            int templateOrder = template.getOrder() == null ? index : Math.max(0, template.getOrder());
            if (stateOrder != templateOrder) {
                return true;
            }
            if (!Objects.equals(normalizeOptionalText(state.getText()), normalizeOptionalText(template.getText()))) {
                return true;
            }
            if (state.isRequired() != template.isRequired()) {
                return true;
            }
            if (state.isHasNote() != template.isHasNote()) {
                return true;
            }
            if (!Objects.equals(normalizeOptionalText(state.getNotePlaceholder()), normalizeOptionalText(template.getNotePlaceholder()))) {
                return true;
            }
            if (state.isHasValue() != template.isHasValue()) {
                return true;
            }
            if (!Objects.equals(normalizeOptionalText(state.getValueLabel()), normalizeOptionalText(template.getValueLabel()))) {
                return true;
            }
            if (normalizeValueType(state.getValueType()) != normalizeValueType(template.getValueType())) {
                return true;
            }
            if (state.isDefaultChecked() != template.isDefaultChecked()) {
                return true;
            }
        }

        return false;
    }

    private ChecklistStateMaps buildStateMaps(List<SessionChecklistItemDto> items) {
        Map<String, SessionChecklistItemDto> byId = new LinkedHashMap<>();
        Map<String, SessionChecklistItemDto> byText = new LinkedHashMap<>();
        if (items == null || items.isEmpty()) {
            return new ChecklistStateMaps(byId, byText);
        }
        for (SessionChecklistItemDto item : items) {
            if (item == null) continue;
            String id = normalizeOptionalText(item.getId());
            if (id != null) {
                byId.put(id, item);
            }
            String key = normalizeChecklistMatchText(item.getText());
            if (key != null) {
                byText.putIfAbsent(key, item);
            }
        }
        return new ChecklistStateMaps(byId, byText);
    }

    private List<SessionChecklistItemDto> fallbackPrereqsTemplateItems() {
        return List.of(
                SessionChecklistItemDto.builder()
                        .id("pr-news")
                        .text("News check done")
                        .order(0)
                        .required(true)
                        .valueType(ChecklistValueType.TEXT)
                        .build(),
                SessionChecklistItemDto.builder()
                        .id("pr-red-news")
                        .text("Red news window")
                        .order(1)
                        .required(false)
                        .hasValue(true)
                        .valueLabel("Time")
                        .valueType(ChecklistValueType.TIME)
                        .build(),
                SessionChecklistItemDto.builder()
                        .id("pr-levels")
                        .text("Key levels marked")
                        .order(2)
                        .required(true)
                        .hasNote(true)
                        .notePlaceholder("Quick notes")
                        .valueType(ChecklistValueType.TEXT)
                        .build(),
                SessionChecklistItemDto.builder()
                        .id("pr-risk")
                        .text("Risk and max trades confirmed")
                        .order(3)
                        .required(true)
                        .valueType(ChecklistValueType.TEXT)
                        .defaultChecked(true)
                        .completed(true)
                        .build(),
                SessionChecklistItemDto.builder()
                        .id("pr-invalidation")
                        .text("Invalidation written")
                        .order(4)
                        .required(true)
                        .valueType(ChecklistValueType.TEXT)
                        .build()
        );
    }

    private List<SessionChecklistItemDto> fallbackTriggerTemplateItems() {
        return List.of(
                SessionChecklistItemDto.builder()
                        .id("tr-sweep")
                        .text("Liquidity sweep confirmed")
                        .order(0)
                        .required(true)
                        .valueType(ChecklistValueType.TEXT)
                        .build(),
                SessionChecklistItemDto.builder()
                        .id("tr-displacement")
                        .text("Displacement close (M5) away from sweep")
                        .order(1)
                        .required(true)
                        .valueType(ChecklistValueType.TEXT)
                        .build(),
                SessionChecklistItemDto.builder()
                        .id("tr-mss")
                        .text("MSS confirmed on close")
                        .order(2)
                        .required(true)
                        .valueType(ChecklistValueType.TEXT)
                        .build(),
                SessionChecklistItemDto.builder()
                        .id("tr-entry-zone")
                        .text("Entry zone identified")
                        .order(3)
                        .required(true)
                        .valueType(ChecklistValueType.TEXT)
                        .build(),
                SessionChecklistItemDto.builder()
                        .id("tr-rr")
                        .text("RR threshold met")
                        .order(4)
                        .required(true)
                        .valueType(ChecklistValueType.TEXT)
                        .build()
        );
    }

    private boolean isLockInComplete(TodaySession session) {
        return session.getLossLimit() != null
                && session.getLossLimit().compareTo(BigDecimal.ZERO) > 0
                && session.getMaxTrades() != null
                && session.getMaxTrades() > 0
                && normalizeOptionalText(session.getLockInSession()) != null
                && normalizeOptionalText(session.getLockInBias()) != null
                && normalizeOptionalText(session.getLockInBiasReason()) != null;
    }

    private String normalizeChecklistMatchText(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            return null;
        }
        return normalized.toLowerCase(Locale.ROOT);
    }

    private String firstNonBlank(String... values) {
        if (values == null || values.length == 0) {
            return null;
        }
        for (String value : values) {
            String normalized = normalizeOptionalText(value);
            if (normalized != null) {
                return normalized;
            }
        }
        return null;
    }

    private String normalizeChecklistText(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            throw new IllegalArgumentException("Checklist item text is required");
        }
        if (normalized.length() > MAX_CHECKLIST_TEXT_LENGTH) {
            throw new IllegalArgumentException("Checklist item text cannot exceed " + MAX_CHECKLIST_TEXT_LENGTH + " characters");
        }
        return normalized;
    }

    private String normalizeTemplateName(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            throw new IllegalArgumentException("Template name is required");
        }
        if (normalized.length() > MAX_TEMPLATE_NAME_LENGTH) {
            throw new IllegalArgumentException("Template name cannot exceed " + MAX_TEMPLATE_NAME_LENGTH + " characters");
        }
        return normalized;
    }

    private String normalizeNotePlaceholder(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized != null && normalized.length() > 160) {
            throw new IllegalArgumentException("Note placeholder cannot exceed 160 characters");
        }
        return normalized;
    }

    private String normalizeNoteValue(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized != null && normalized.length() > 280) {
            throw new IllegalArgumentException("Checklist note cannot exceed 280 characters");
        }
        return normalized;
    }

    private String normalizeValueLabel(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized != null && normalized.length() > 80) {
            throw new IllegalArgumentException("Value label cannot exceed 80 characters");
        }
        return normalized;
    }

    private String normalizeValue(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized != null && normalized.length() > 120) {
            throw new IllegalArgumentException("Checklist value cannot exceed 120 characters");
        }
        return normalized;
    }

    private ChecklistValueType normalizeValueType(ChecklistValueType valueType) {
        return valueType == null ? ChecklistValueType.TEXT : valueType;
    }

    private String normalizeLevelLabel(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            throw new IllegalArgumentException("Level label is required");
        }
        if (normalized.length() > MAX_LEVEL_LABEL_LENGTH) {
            throw new IllegalArgumentException("Level label cannot exceed " + MAX_LEVEL_LABEL_LENGTH + " characters");
        }
        return normalized;
    }

    private BigDecimal normalizeLevelPrice(BigDecimal value) {
        if (value == null) {
            return null;
        }
        if (value.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Level price must be greater than zero");
        }
        return value.setScale(8, RoundingMode.HALF_UP);
    }

    private SessionLevelCategory normalizeLevelCategory(SessionLevelCategory value) {
        return value == null ? SessionLevelCategory.OTHER : value;
    }

    private String normalizeLevelNotes(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized != null && normalized.length() > 280) {
            throw new IllegalArgumentException("Level notes cannot exceed 280 characters");
        }
        return normalized;
    }

    private TodaySession requireSessionById(User user, UUID sessionId) {
        if (sessionId == null) {
            throw new IllegalArgumentException("Session id is required");
        }
        return todaySessionRepository.findByIdAndUser_Id(sessionId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Session not found"));
    }

    private List<SessionLevel> findSessionLevels(UUID sessionId, UUID userId, String symbol) {
        String normalizedSymbol = normalizeOptionalTicker(symbol);
        if (normalizedSymbol == null) {
            return sessionLevelRepository.findByTodaySession_IdAndUser_IdOrderByCreatedAtAsc(sessionId, userId);
        }
        return sessionLevelRepository.findByTodaySession_IdAndUser_IdAndSymbolIgnoreCaseOrderByCreatedAtAsc(
                sessionId,
                userId,
                normalizedSymbol
        );
    }

    private String normalizeOptionalTicker(String ticker) {
        return normalizeTicker(ticker);
    }

    private String normalizeRequiredTicker(String ticker, String message) {
        String normalized = normalizeOptionalTicker(ticker);
        if (normalized == null) {
            throw new IllegalArgumentException(message);
        }
        return normalized;
    }

    private LevelType normalizeLevelType(LevelType value) {
        return value == null ? LevelType.OTHER : value;
    }

    private LevelTimeframe normalizeLevelTimeframe(LevelTimeframe value) {
        return value == null ? LevelTimeframe.M15 : value;
    }

    private BigDecimal normalizeLevelZonePrice(BigDecimal value, String fieldName) {
        if (value == null) {
            return null;
        }
        if (value.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException(fieldName + " must be greater than zero");
        }
        return value.setScale(8, RoundingMode.HALF_UP);
    }

    private String normalizeLevelOriginRule(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized != null && normalized.length() > MAX_LEVEL_ORIGIN_RULE_LENGTH) {
            throw new IllegalArgumentException("Level origin rule cannot exceed " + MAX_LEVEL_ORIGIN_RULE_LENGTH + " characters");
        }
        return normalized;
    }

    private Short normalizeStrengthScore(Short value) {
        short normalized = value == null ? 3 : value;
        if (normalized < 0 || normalized > 5) {
            throw new IllegalArgumentException("Strength score must be between 0 and 5");
        }
        return normalized;
    }

    private LevelStatus normalizeLevelStatus(LevelStatus status) {
        return status == null ? LevelStatus.FRESH : status;
    }

    private String normalizeLevelExpectation(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized != null && normalized.length() > MAX_LEVEL_EXPECTATION_LENGTH) {
            throw new IllegalArgumentException("Level expectation cannot exceed " + MAX_LEVEL_EXPECTATION_LENGTH + " characters");
        }
        return normalized;
    }

    private void ensureValidZone(BigDecimal zoneLow, BigDecimal zoneHigh) {
        if (zoneLow == null && zoneHigh == null) {
            return;
        }
        if (zoneLow == null || zoneHigh == null) {
            throw new IllegalArgumentException("Both zoneLow and zoneHigh are required for zone levels");
        }
        if (zoneHigh.compareTo(zoneLow) < 0) {
            throw new IllegalArgumentException("zoneHigh must be greater than or equal to zoneLow");
        }
    }

    private void normalizeRolesAfterLevelUpdate(TodaySession session, UUID userId, String symbol, UUID preferredLevelId) {
        String normalizedSymbol = normalizeOptionalTicker(symbol);
        if (normalizedSymbol == null && preferredLevelId != null) {
            normalizedSymbol = sessionLevelRepository.findByIdAndTodaySession_IdAndUser_Id(preferredLevelId, session.getId(), userId)
                    .map(SessionLevel::getSymbol)
                    .map(this::normalizeOptionalTicker)
                    .orElse(null);
        }

        List<SessionLevel> levels = findSessionLevels(session.getId(), userId, normalizedSymbol);
        UUID sweepId = normalizeSingleRole(levels, RoleSelector.SWEEP, preferredLevelId);
        UUID entryId = normalizeSingleRole(levels, RoleSelector.ENTRY, preferredLevelId);
        UUID slId = normalizeSingleRole(levels, RoleSelector.SL, preferredLevelId);
        UUID tpId = normalizeSingleRole(levels, RoleSelector.TP, preferredLevelId);

        if (sweepId != null) {
            clearSweepPoolRoleForSymbol(session.getId(), userId, normalizedSymbol, null);
            session.setActiveSweepPoolId(null);
            session.setActiveSweepLevelId(sweepId);
        } else if (isLevelForSymbol(session.getId(), userId, session.getActiveSweepLevelId(), normalizedSymbol)) {
            session.setActiveSweepLevelId(null);
        }

        if (entryId != null) {
            session.setActiveEntryLevelId(entryId);
        } else if (isLevelForSymbol(session.getId(), userId, session.getActiveEntryLevelId(), normalizedSymbol)) {
            session.setActiveEntryLevelId(null);
        }

        if (slId != null) {
            session.setActiveSlLevelId(slId);
        } else if (isLevelForSymbol(session.getId(), userId, session.getActiveSlLevelId(), normalizedSymbol)) {
            session.setActiveSlLevelId(null);
        }

        if (tpId != null) {
            session.setActiveTpLevelId(tpId);
        } else if (isLevelForSymbol(session.getId(), userId, session.getActiveTpLevelId(), normalizedSymbol)) {
            session.setActiveTpLevelId(null);
        }

        todaySessionRepository.save(session);
    }

    private UUID normalizeSingleRole(List<SessionLevel> levels, RoleSelector selector, UUID preferredLevelId) {
        if (levels == null || levels.isEmpty()) {
            return null;
        }

        SessionLevel preferred = preferredLevelId == null
                ? null
                : levels.stream().filter(item -> Objects.equals(item.getId(), preferredLevelId)).findFirst().orElse(null);
        SessionLevel selected = preferred != null && selector.read(preferred) ? preferred : null;

        List<SessionLevel> changed = new ArrayList<>();
        for (SessionLevel level : levels) {
            if (!selector.read(level)) {
                continue;
            }
            if (selected == null) {
                selected = level;
                continue;
            }
            if (!Objects.equals(selected.getId(), level.getId())) {
                selector.write(level, false);
                changed.add(level);
            }
        }

        if (!changed.isEmpty()) {
            sessionLevelRepository.saveAll(changed);
        }
        return selected == null ? null : selected.getId();
    }

    private boolean isLevelForSymbol(UUID sessionId, UUID userId, UUID levelId, String symbol) {
        String normalizedSymbol = normalizeOptionalTicker(symbol);
        if (levelId == null || normalizedSymbol == null) {
            return false;
        }
        return sessionLevelRepository.findByIdAndTodaySession_IdAndUser_Id(levelId, sessionId, userId)
                .map(SessionLevel::getSymbol)
                .map(this::normalizeOptionalTicker)
                .map(normalizedSymbol::equals)
                .orElse(false);
    }

    private void syncLegacySweepSelection(TodaySession session, UUID userId, String symbol) {
        String normalizedSymbol = normalizeOptionalTicker(symbol);
        if (normalizedSymbol == null) {
            return;
        }

        LiquidityPool activeSweepPool = session.getActiveSweepPoolId() == null
                ? null
                : liquidityPoolRepository.findByIdAndTodaySession_IdAndUser_Id(session.getActiveSweepPoolId(), session.getId(), userId).orElse(null);
        if (activeSweepPool != null && activeSweepPool.isSweepRole()
                && normalizedSymbol.equals(normalizeOptionalTicker(activeSweepPool.getSymbol()))) {
            session.setActiveSweepLevelId(null);
            todaySessionRepository.save(session);
            return;
        }

        SessionLevel sweepLevel = sessionLevelRepository
                .findByTodaySession_IdAndUser_IdAndSymbolIgnoreCaseAndSweepRoleTrue(session.getId(), userId, normalizedSymbol)
                .orElse(null);
        if (sweepLevel != null) {
            session.setActiveSweepLevelId(sweepLevel.getId());
            if (isPoolForSymbol(session.getId(), userId, session.getActiveSweepPoolId(), normalizedSymbol)) {
                session.setActiveSweepPoolId(null);
            }
        } else if (isLevelForSymbol(session.getId(), userId, session.getActiveSweepLevelId(), normalizedSymbol)) {
            session.setActiveSweepLevelId(null);
        }
        todaySessionRepository.save(session);
    }

    private boolean isPoolForSymbol(UUID sessionId, UUID userId, UUID poolId, String symbol) {
        String normalizedSymbol = normalizeOptionalTicker(symbol);
        if (poolId == null || normalizedSymbol == null) {
            return false;
        }
        return liquidityPoolRepository.findByIdAndTodaySession_IdAndUser_Id(poolId, sessionId, userId)
                .map(LiquidityPool::getSymbol)
                .map(this::normalizeOptionalTicker)
                .map(normalizedSymbol::equals)
                .orElse(false);
    }

    private void clearSweepPoolRoleForSymbol(UUID sessionId, UUID userId, String symbol, UUID keepId) {
        String normalizedSymbol = normalizeOptionalTicker(symbol);
        List<LiquidityPool> pools = normalizedSymbol == null
                ? liquidityPoolRepository.findByTodaySession_IdAndUser_IdOrderByCreatedAtUtcAsc(sessionId, userId)
                : liquidityPoolRepository.findByTodaySession_IdAndUser_IdAndSymbolIgnoreCaseOrderByCreatedAtUtcAsc(sessionId, userId, normalizedSymbol);
        List<LiquidityPool> changed = new ArrayList<>();
        for (LiquidityPool pool : pools) {
            if (!pool.isSweepRole()) {
                continue;
            }
            if (keepId != null && Objects.equals(pool.getId(), keepId)) {
                continue;
            }
            pool.setSweepRole(false);
            changed.add(pool);
        }
        if (!changed.isEmpty()) {
            liquidityPoolRepository.saveAll(changed);
        }
    }

    private void clearLevelRoleForSymbol(UUID sessionId,
                                         UUID userId,
                                         String symbol,
                                         RoleSelector roleSelector,
                                         UUID keepId) {
        List<SessionLevel> levels = findSessionLevels(sessionId, userId, symbol);
        List<SessionLevel> changed = new ArrayList<>();
        for (SessionLevel level : levels) {
            if (!roleSelector.read(level)) {
                continue;
            }
            if (keepId != null && Objects.equals(level.getId(), keepId)) {
                continue;
            }
            roleSelector.write(level, false);
            changed.add(level);
        }
        if (!changed.isEmpty()) {
            sessionLevelRepository.saveAll(changed);
        }
    }

    private Set<SessionLevel> resolvePoolLevels(TodaySession session, UUID userId, List<UUID> levelIds) {
        if (levelIds == null || levelIds.isEmpty()) {
            return new LinkedHashSet<>();
        }
        LinkedHashSet<SessionLevel> resolved = new LinkedHashSet<>();
        for (UUID levelId : new LinkedHashSet<>(levelIds)) {
            SessionLevel level = sessionLevelRepository.findByIdAndTodaySession_IdAndUser_Id(levelId, session.getId(), userId)
                    .orElseThrow(() -> new EntityNotFoundException("Session level not found: " + levelId));
            resolved.add(level);
        }
        return resolved;
    }

    private String normalizePoolName(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            throw new IllegalArgumentException("Pool name is required");
        }
        if (normalized.length() > MAX_POOL_NAME_LENGTH) {
            throw new IllegalArgumentException("Pool name cannot exceed " + MAX_POOL_NAME_LENGTH + " characters");
        }
        return normalized;
    }

    private Short normalizeCleanlinessScore(Short value) {
        short normalized = value == null ? 3 : value;
        if (normalized < 0 || normalized > 5) {
            throw new IllegalArgumentException("Cleanliness score must be between 0 and 5");
        }
        return normalized;
    }

    private LevelStatus normalizePoolStatus(LevelStatus value) {
        LevelStatus normalized = value == null ? LevelStatus.FRESH : value;
        if (normalized == LevelStatus.RECLAIMED) {
            return LevelStatus.TAPPED;
        }
        return normalized;
    }

    private SessionPoolDto toSessionPoolDto(LiquidityPool pool) {
        List<UUID> levelIds = pool.getLevels() == null
                ? List.of()
                : pool.getLevels().stream().map(SessionLevel::getId).toList();
        return SessionPoolDto.builder()
                .id(pool.getId())
                .symbol(pool.getSymbol())
                .poolName(pool.getPoolName())
                .type(pool.getType())
                .timeframe(pool.getTimeframe())
                .zoneLow(pool.getZoneLow())
                .zoneHigh(pool.getZoneHigh())
                .cleanlinessScore(pool.getCleanlinessScore())
                .status(pool.getStatus())
                .sweepRole(pool.isSweepRole())
                .levelIds(levelIds)
                .createdAtUtc(pool.getCreatedAtUtc())
                .updatedAtUtc(pool.getUpdatedAtUtc())
                .build();
    }

    private SessionNarrativeDto toSessionNarrativeDto(SessionNarrative narrative) {
        if (narrative == null) {
            return null;
        }
        return SessionNarrativeDto.builder()
                .sessionId(narrative.getSessionId())
                .htfDraw(narrative.getHtfDraw())
                .expectedManipulation(narrative.getExpectedManipulation())
                .deliveryModel(narrative.getDeliveryModel())
                .confirmationModel(narrative.getConfirmationModel())
                .notes(narrative.getNotes())
                .createdAtUtc(narrative.getCreatedAtUtc())
                .updatedAtUtc(narrative.getUpdatedAtUtc())
                .build();
    }

    private String normalizeNarrativeNotes(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized != null && normalized.length() > MAX_NARRATIVE_NOTES_LENGTH) {
            throw new IllegalArgumentException("Narrative notes cannot exceed " + MAX_NARRATIVE_NOTES_LENGTH + " characters");
        }
        return normalized;
    }

    private void applyNarrativeRequest(SessionNarrative narrative, SessionNarrativeRequest request) {
        narrative.setHtfDraw(request == null ? null : request.getHtfDraw());
        narrative.setExpectedManipulation(request == null ? null : request.getExpectedManipulation());
        narrative.setDeliveryModel(request == null ? null : request.getDeliveryModel());
        narrative.setConfirmationModel(request == null ? null : request.getConfirmationModel());
        narrative.setNotes(normalizeNarrativeNotes(request == null ? null : request.getNotes()));
    }

    private void addDefaultSuggestion(List<SessionLevelSuggestionDto> suggestions,
                                      Set<LevelType> existingTypes,
                                      LevelType type,
                                      LevelTimeframe timeframe,
                                      String reason,
                                      double confidence) {
        if (existingTypes.contains(type)) {
            return;
        }
        suggestions.add(SessionLevelSuggestionDto.builder()
                .type(type)
                .timeframe(timeframe)
                .reason(reason)
                .confidence(confidence)
                .untouchedSinceUtc(null)
                .confluences(List.of("SMC"))
                .build());
        existingTypes.add(type);
    }

    private SessionLevel resolveRoleLevel(TodaySession session, UUID userId, String symbol, UUID levelId) {
        if (levelId == null) {
            return null;
        }
        SessionLevel level = sessionLevelRepository.findByIdAndTodaySession_IdAndUser_Id(levelId, session.getId(), userId)
                .orElseThrow(() -> new EntityNotFoundException("Session level not found"));
        String normalizedSymbol = normalizeOptionalTicker(symbol);
        if (normalizedSymbol != null && !Objects.equals(normalizedSymbol, normalizeOptionalTicker(level.getSymbol()))) {
            throw new IllegalArgumentException("Selected level role does not match trade symbol");
        }
        return level;
    }

    private boolean isNarrativeComplete(SessionNarrative narrative) {
        return narrative != null
                && narrative.getHtfDraw() != null
                && narrative.getExpectedManipulation() != null
                && narrative.getConfirmationModel() != null;
    }

    private boolean isTriggerCompleted(List<SessionChecklistItemDto> triggers, String token) {
        if (triggers == null || triggers.isEmpty()) {
            return false;
        }
        String needle = normalizeOptionalText(token);
        if (needle == null) {
            return false;
        }
        String loweredNeedle = needle.toLowerCase(Locale.ROOT);
        return triggers.stream()
                .filter(Objects::nonNull)
                .anyMatch(item -> item.isCompleted()
                        && normalizeOptionalText(item.getText()) != null
                        && item.getText().toLowerCase(Locale.ROOT).contains(loweredNeedle));
    }

    private Integer computeSweepToEntrySeconds(SessionLevel sweepLevel, OffsetDateTime openedAt) {
        if (sweepLevel == null || openedAt == null) {
            return null;
        }
        OffsetDateTime touchedAt = firstNonNull(sweepLevel.getLastTouchedAtUtc(), sweepLevel.getSweptAt());
        if (touchedAt == null) {
            return null;
        }
        long seconds = Duration.between(touchedAt, openedAt).getSeconds();
        if (seconds < 0 || seconds > Integer.MAX_VALUE) {
            return null;
        }
        return (int) seconds;
    }

    private Boolean resolveExpectationOutcome(Trade trade, BigDecimal exitPrice) {
        String expectation = normalizeOptionalText(trade.getLevelExpectation());
        if (expectation == null || exitPrice == null) {
            return null;
        }

        BigDecimal directionalMove = computeDirectionalPointMove(trade, exitPrice);
        if (directionalMove == null) {
            return null;
        }
        String token = expectation.toUpperCase(Locale.ROOT);
        if (token.contains("TARGET") || token.contains("MAGNET")) {
            if (trade.getTakeProfitPrice() != null) {
                if (trade.getDirection() == Direction.LONG) {
                    return exitPrice.compareTo(trade.getTakeProfitPrice()) >= 0;
                }
                return exitPrice.compareTo(trade.getTakeProfitPrice()) <= 0;
            }
            return directionalMove.compareTo(BigDecimal.ZERO) > 0;
        }
        if (token.contains("HOLD")) {
            return directionalMove.compareTo(BigDecimal.ZERO) >= 0;
        }
        if (token.contains("SWEEP") || token.contains("DISPLACE")) {
            return directionalMove.compareTo(BigDecimal.ZERO) > 0;
        }
        return directionalMove.compareTo(BigDecimal.ZERO) > 0;
    }

    private BigDecimal computeDirectionalPointMove(Trade trade, BigDecimal exitPrice) {
        if (trade == null || exitPrice == null || trade.getEntryPrice() == null || trade.getDirection() == null) {
            return null;
        }
        BigDecimal rawMove = exitPrice.subtract(trade.getEntryPrice());
        if (trade.getDirection() == Direction.SHORT) {
            rawMove = rawMove.negate();
        }
        return rawMove.setScale(8, RoundingMode.HALF_UP);
    }

    private SessionAutoTradeEventDto toAutoTradeEventDto(SessionAutoTradeEvent event) {
        return SessionAutoTradeEventDto.builder()
                .id(event.getId())
                .sessionId(event.getTodaySession() == null ? null : event.getTodaySession().getId())
                .tradeId(event.getTrade() == null ? null : event.getTrade().getId())
                .type(event.getEventType())
                .side(event.getPriceSide())
                .price(event.getPrice())
                .note(event.getNote())
                .tsUtc(event.getCreatedAtUtc())
                .build();
    }

    private AutoTradeEventType normalizeAutoTradeEventType(AutoTradeEventType value) {
        if (value == null) {
            throw new IllegalArgumentException("Auto-trade event type is required");
        }
        return value;
    }

    private QuoteSide normalizeAutoTradePriceSide(QuoteSide value) {
        return value;
    }

    private BigDecimal normalizeAutoTradeEventPrice(BigDecimal value) {
        if (value == null) {
            return null;
        }
        if (value.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Auto-trade event price must be greater than zero");
        }
        return value.setScale(8, RoundingMode.HALF_UP);
    }

    private String normalizeAutoTradeEventNote(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized != null && normalized.length() > MAX_AUTO_TRADE_NOTE_LENGTH) {
            throw new IllegalArgumentException("Auto-trade note cannot exceed " + MAX_AUTO_TRADE_NOTE_LENGTH + " characters");
        }
        return normalized;
    }

    private <T> T firstNonNull(T first, T second) {
        return first != null ? first : second;
    }

    private enum RoleSelector {
        SWEEP {
            @Override
            boolean read(SessionLevel level) {
                return level.isSweepRole();
            }

            @Override
            void write(SessionLevel level, boolean value) {
                level.setSweepRole(value);
            }
        },
        ENTRY {
            @Override
            boolean read(SessionLevel level) {
                return level.isEntryRole();
            }

            @Override
            void write(SessionLevel level, boolean value) {
                level.setEntryRole(value);
            }
        },
        SL {
            @Override
            boolean read(SessionLevel level) {
                return level.isSlRole();
            }

            @Override
            void write(SessionLevel level, boolean value) {
                level.setSlRole(value);
            }
        },
        TP {
            @Override
            boolean read(SessionLevel level) {
                return level.isTpRole();
            }

            @Override
            void write(SessionLevel level, boolean value) {
                level.setTpRole(value);
            }
        };

        abstract boolean read(SessionLevel level);

        abstract void write(SessionLevel level, boolean value);
    }

    private String normalizeLockInSession(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            return null;
        }
        String token = normalized.toUpperCase(Locale.ROOT);
        if (!LOCK_IN_SESSIONS.contains(token)) {
            throw new IllegalArgumentException("Invalid lock-in session");
        }
        return token;
    }

    private String normalizeLockInObjective(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            return null;
        }
        String token = normalized.toUpperCase(Locale.ROOT);
        if (!LOCK_IN_OBJECTIVES.contains(token)) {
            throw new IllegalArgumentException("Invalid lock-in objective");
        }
        return token;
    }

    private String normalizeLockInBias(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            return null;
        }
        String token = normalized.toUpperCase(Locale.ROOT);
        if (!LOCK_IN_BIAS.contains(token)) {
            throw new IllegalArgumentException("Invalid lock-in bias");
        }
        return token;
    }

    private String normalizeLockInBiasReason(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            return null;
        }
        if (normalized.length() > 140) {
            throw new IllegalArgumentException("Lock-in bias reason cannot exceed 140 characters");
        }
        return normalized;
    }

    private List<String> normalizeTickers(List<String> tickers) {
        if (tickers == null || tickers.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> values = new LinkedHashSet<>();
        for (String ticker : tickers) {
            String normalized = normalizeTicker(ticker);
            if (normalized != null) {
                values.add(normalized);
            }
            if (values.size() > MAX_TICKERS) {
                throw new IllegalArgumentException("Planned tickers cannot exceed " + MAX_TICKERS);
            }
        }
        return List.copyOf(values);
    }

    private String normalizeTicker(String ticker) {
        String normalized = normalizeOptionalText(ticker);
        if (normalized == null) {
            return null;
        }
        String upper = normalized.toUpperCase();
        if (upper.length() > MAX_TICKER_LENGTH) {
            throw new IllegalArgumentException("Ticker cannot exceed " + MAX_TICKER_LENGTH + " characters");
        }
        return upper;
    }

    private Integer normalizeMaxTrades(Integer value) {
        if (value == null || value <= 0) {
            throw new IllegalArgumentException("maxTrades must be greater than zero");
        }
        return value;
    }

    private BigDecimal normalizeMoney(BigDecimal value, String fieldName) {
        if (value == null) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        if (value.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException(fieldName + " cannot be negative");
        }
        return value.setScale(4, RoundingMode.HALF_UP);
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private Set<String> normalizeRuleBreaks(Set<String> values) {
        if (values == null || values.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String value : values) {
            String token = normalizeOptionalText(value);
            if (token == null) continue;
            if (!TradeTaxonomy.RULE_BREAKS_SET.contains(token)) {
                throw new IllegalArgumentException("Invalid rule break: " + token);
            }
            normalized.add(token);
        }
        return normalized;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private boolean booleanValue(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value == null) {
            return false;
        }
        return Boolean.parseBoolean(String.valueOf(value));
    }

    private UUID parseUuid(String value) {
        if (value == null) {
            return null;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private ChecklistTemplateResponse toChecklistTemplateResponse(ChecklistTemplate template) {
        List<ChecklistTemplateItemDto> items = checklistTemplateEntryRepository
                .findByTemplate_IdOrderBySortOrderAscCreatedAtAsc(template.getId())
                .stream()
                .map(entry -> ChecklistTemplateItemDto.builder()
                        .id(entry.getId().toString())
                        .text(entry.getItemText())
                        .order(entry.getSortOrder())
                        .required(entry.isRequired())
                        .hasNote(entry.isHasNote())
                        .notePlaceholder(entry.getNotePlaceholder())
                        .hasValue(entry.isHasValue())
                        .valueLabel(entry.getValueLabel())
                        .valueType(entry.getValueType() == null ? ChecklistValueType.TEXT : entry.getValueType())
                        .defaultChecked(entry.isDefaultChecked())
                        .build())
                .toList();

        return ChecklistTemplateResponse.builder()
                .id(template.getId())
                .name(template.getName())
                .type(template.getType())
                .isDefault(template.isDefault())
                .items(items)
                .createdAt(template.getCreatedAt())
                .updatedAt(template.getUpdatedAt())
                .build();
    }

    private record ChecklistStateMaps(Map<String, SessionChecklistItemDto> byId,
                                      Map<String, SessionChecklistItemDto> byText) {
    }

    private record SessionProgress(long closedTrades, BigDecimal realizedPnl) {
    }
}
