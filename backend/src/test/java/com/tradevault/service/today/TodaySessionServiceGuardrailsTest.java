package com.tradevault.service.today;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.ChecklistTemplateItem;
import com.tradevault.domain.entity.ChecklistTemplate;
import com.tradevault.domain.entity.ChecklistTemplateEntry;
import com.tradevault.domain.entity.ContextSnapshot;
import com.tradevault.domain.entity.LiquidityPool;
import com.tradevault.domain.entity.SessionAutoTradeEvent;
import com.tradevault.domain.entity.SessionLevel;
import com.tradevault.domain.entity.SessionNarrative;
import com.tradevault.domain.entity.TodaySession;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.ContextSnapshotMode;
import com.tradevault.domain.enums.AutoTradeEventType;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.ChecklistTemplateType;
import com.tradevault.domain.enums.ChecklistValueType;
import com.tradevault.domain.enums.LevelCreatedBy;
import com.tradevault.domain.enums.LevelStatus;
import com.tradevault.domain.enums.LevelTimeframe;
import com.tradevault.domain.enums.LevelType;
import com.tradevault.domain.enums.NarrativeConfirmationModel;
import com.tradevault.domain.enums.NarrativeHtfDraw;
import com.tradevault.domain.enums.NarrativeManipulation;
import com.tradevault.domain.enums.QuoteSide;
import com.tradevault.domain.enums.SessionLevelCategory;
import com.tradevault.domain.enums.TodaySessionStatus;
import com.tradevault.domain.enums.TradeGrade;
import com.tradevault.domain.enums.TradeSession;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.session.CloseSessionTradeRequest;
import com.tradevault.dto.session.SessionChecklistItemDto;
import com.tradevault.dto.session.SessionAutoTradeEventRequest;
import com.tradevault.dto.session.SessionLevelRequest;
import com.tradevault.dto.session.SessionNarrativeRequest;
import com.tradevault.dto.session.StartSessionTradeRequest;
import com.tradevault.dto.session.TodaySessionChecklistUpdateRequest;
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
import com.tradevault.service.ContextSnapshotService;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.TradeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TodaySessionServiceGuardrailsTest {
    private TodaySessionRepository todaySessionRepository;
    private TradeRepository tradeRepository;
    private ChecklistTemplateRepository checklistTemplateRepository;
    private ChecklistTemplateEntryRepository checklistTemplateEntryRepository;
    private ChecklistTemplateItemRepository checklistTemplateItemRepository;
    private ChecklistTemplateVersionRepository checklistTemplateVersionRepository;
    private SessionLevelRepository sessionLevelRepository;
    private LiquidityPoolRepository liquidityPoolRepository;
    private SessionAutoTradeEventRepository sessionAutoTradeEventRepository;
    private SessionNarrativeRepository sessionNarrativeRepository;
    private CurrentUserService currentUserService;
    private TradeService tradeService;
    private ContextSnapshotService contextSnapshotService;
    private TodaySessionService todaySessionService;
    private ObjectMapper objectMapper;

    private User user;
    private TodaySession session;
    private SessionLevel sweepLevel;
    private SessionLevel entryLevel;
    private SessionLevel slLevel;
    private SessionLevel tpLevel;
    private SessionNarrative narrative;

    private List<SessionLevel> levelsStore;
    private List<LiquidityPool> poolsStore;
    private SessionNarrative narrativeStore;

    @BeforeEach
    void setup() throws Exception {
        todaySessionRepository = Mockito.mock(TodaySessionRepository.class);
        tradeRepository = Mockito.mock(TradeRepository.class);
        checklistTemplateRepository = Mockito.mock(ChecklistTemplateRepository.class);
        checklistTemplateEntryRepository = Mockito.mock(ChecklistTemplateEntryRepository.class);
        checklistTemplateItemRepository = Mockito.mock(ChecklistTemplateItemRepository.class);
        checklistTemplateVersionRepository = Mockito.mock(ChecklistTemplateVersionRepository.class);
        sessionLevelRepository = Mockito.mock(SessionLevelRepository.class);
        liquidityPoolRepository = Mockito.mock(LiquidityPoolRepository.class);
        sessionAutoTradeEventRepository = Mockito.mock(SessionAutoTradeEventRepository.class);
        sessionNarrativeRepository = Mockito.mock(SessionNarrativeRepository.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        tradeService = Mockito.mock(TradeService.class);
        contextSnapshotService = Mockito.mock(ContextSnapshotService.class);

        objectMapper = new ObjectMapper();
        todaySessionService = new TodaySessionService(
                todaySessionRepository,
                tradeRepository,
                checklistTemplateRepository,
                checklistTemplateEntryRepository,
                checklistTemplateItemRepository,
                checklistTemplateVersionRepository,
                sessionLevelRepository,
                liquidityPoolRepository,
                sessionAutoTradeEventRepository,
                sessionNarrativeRepository,
                currentUserService,
                tradeService,
                contextSnapshotService,
                objectMapper
        );

        user = User.builder()
                .id(UUID.randomUUID())
                .email("trader@example.com")
                .timezone("Europe/Bucharest")
                .baseCurrency("USD")
                .build();
        when(currentUserService.getCurrentUser()).thenReturn(user);

        session = TodaySession.builder()
                .id(UUID.randomUUID())
                .user(user)
                .sessionDate(LocalDate.now())
                .profitTarget(BigDecimal.valueOf(200))
                .lossLimit(BigDecimal.valueOf(100))
                .maxTrades(3)
                .status(TodaySessionStatus.ACTIVE)
                .lockInSession("LONDON")
                .lockInObjective("A_PLUS_ONLY")
                .lockInBias("LONG")
                .lockInBiasReason("HTF draw is PDH")
                .prereqsStateJson(objectMapper.writeValueAsString(completedPrereqs()))
                .triggersStateJson(objectMapper.writeValueAsString(completedTriggers()))
                .build();

        ChecklistTemplate prereqsTemplate = ChecklistTemplate.builder()
                .id(UUID.randomUUID())
                .user(user)
                .name("Prereqs")
                .type(ChecklistTemplateType.PREREQS)
                .build();
        ChecklistTemplate triggersTemplate = ChecklistTemplate.builder()
                .id(UUID.randomUUID())
                .user(user)
                .name("Triggers")
                .type(ChecklistTemplateType.TRIGGERS)
                .build();
        session.setPrereqsTemplate(prereqsTemplate);
        session.setTriggersTemplate(triggersTemplate);

        sweepLevel = baseLevel("PDH", LevelType.PDH, true, false, false, false);
        entryLevel = baseLevel("Entry", LevelType.EQL, false, true, false, false);
        slLevel = baseLevel("SL", LevelType.PDL, false, false, true, false);
        tpLevel = baseLevel("TP", LevelType.PDH, false, false, false, true);

        session.setActiveSweepLevelId(sweepLevel.getId());
        session.setActiveEntryLevelId(entryLevel.getId());
        session.setActiveSlLevelId(slLevel.getId());
        session.setActiveTpLevelId(tpLevel.getId());

        levelsStore = new ArrayList<>(List.of(sweepLevel, entryLevel, slLevel, tpLevel));
        poolsStore = new ArrayList<>();

        narrative = SessionNarrative.builder()
                .sessionId(session.getId())
                .todaySession(session)
                .user(user)
                .htfDraw(NarrativeHtfDraw.PDH)
                .expectedManipulation(NarrativeManipulation.RAID_UP)
                .confirmationModel(NarrativeConfirmationModel.DISPLACEMENT_M5_MSS_M5)
                .notes("PDH draw with London raid")
                .build();
        narrativeStore = narrative;

        when(todaySessionRepository.findByUser_IdAndSessionDate(eq(user.getId()), any(LocalDate.class)))
                .thenReturn(Optional.of(session));
        when(todaySessionRepository.findByIdAndUser_Id(session.getId(), user.getId()))
                .thenReturn(Optional.of(session));
        when(todaySessionRepository.save(any(TodaySession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(tradeRepository.countByUser_IdAndSessionIdAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED))
                .thenReturn(0L);
        when(tradeRepository.sumNetPnlByUserAndSessionAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED))
                .thenReturn(BigDecimal.ZERO);
        when(tradeRepository.findFirstByUser_IdAndSessionIdAndStatusOrderByOpenedAtDescCreatedAtDesc(
                eq(user.getId()), eq(session.getId()), eq(TradeStatus.OPEN)))
                .thenReturn(Optional.empty());

        when(contextSnapshotService.createSnapshot(
                eq(user),
                eq(ContextSnapshotMode.LIVE),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any()
        )).thenReturn(ContextSnapshot.builder().id(UUID.randomUUID()).build());

        when(checklistTemplateEntryRepository.findByTemplate_IdOrderBySortOrderAscCreatedAtAsc(
                session.getPrereqsTemplate().getId()
        )).thenReturn(List.of(
                ChecklistTemplateEntry.builder()
                        .id(UUID.fromString("00000000-0000-0000-0000-000000000011"))
                        .template(session.getPrereqsTemplate())
                        .itemText("News check done")
                        .sortOrder(0)
                        .required(true)
                        .build(),
                ChecklistTemplateEntry.builder()
                        .id(UUID.fromString("00000000-0000-0000-0000-000000000012"))
                        .template(session.getPrereqsTemplate())
                        .itemText("Key levels marked")
                        .sortOrder(1)
                        .required(true)
                        .build()
        ));

        when(checklistTemplateEntryRepository.findByTemplate_IdOrderBySortOrderAscCreatedAtAsc(
                session.getTriggersTemplate().getId()
        )).thenReturn(List.of(
                ChecklistTemplateEntry.builder()
                        .id(UUID.fromString("00000000-0000-0000-0000-000000000021"))
                        .template(session.getTriggersTemplate())
                        .itemText("Liquidity sweep confirmed")
                        .sortOrder(0)
                        .required(true)
                        .build(),
                ChecklistTemplateEntry.builder()
                        .id(UUID.fromString("00000000-0000-0000-0000-000000000022"))
                        .template(session.getTriggersTemplate())
                        .itemText("Displacement close (M5) away from sweep")
                        .sortOrder(1)
                        .required(true)
                        .build(),
                ChecklistTemplateEntry.builder()
                        .id(UUID.fromString("00000000-0000-0000-0000-000000000023"))
                        .template(session.getTriggersTemplate())
                        .itemText("MSS confirmed on close")
                        .sortOrder(2)
                        .required(true)
                        .build()
        ));

        wireSessionLevelRepositoryStore();
        wirePoolRepositoryStore();
        wireNarrativeRepositoryStore();
    }

    @Test
    void startTradeIsBlockedWhenMaxTradesReached() {
        when(tradeRepository.countByUser_IdAndSessionIdAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED))
                .thenReturn(3L);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> todaySessionService.startTrade(validStartRequest()));

        assertEquals("Session guardrail reached. Trading is locked for today.", ex.getMessage());
        verify(tradeService, never()).create(any());
        verifySessionMarkedCompleted();
    }

    @Test
    void startTradeIsBlockedWhenProfitTargetReached() {
        when(tradeRepository.countByUser_IdAndSessionIdAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED))
                .thenReturn(1L);
        when(tradeRepository.sumNetPnlByUserAndSessionAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED))
                .thenReturn(BigDecimal.valueOf(250));

        assertThrows(IllegalArgumentException.class, () -> todaySessionService.startTrade(validStartRequest()));

        verify(tradeService, never()).create(any());
        verifySessionMarkedCompleted();
    }

    @Test
    void startTradeIsBlockedWhenLossLimitReached() {
        when(tradeRepository.countByUser_IdAndSessionIdAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED))
                .thenReturn(1L);
        when(tradeRepository.sumNetPnlByUserAndSessionAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED))
                .thenReturn(BigDecimal.valueOf(-120));

        assertThrows(IllegalArgumentException.class, () -> todaySessionService.startTrade(validStartRequest()));

        verify(tradeService, never()).create(any());
        verifySessionMarkedCompleted();
    }

    @Test
    void startTradePassesWhenGuardrailsAndV1RequirementsAreMet() {
        TradeResponse expected = TradeResponse.builder()
                .id(UUID.randomUUID())
                .status(TradeStatus.OPEN)
                .openedAt(OffsetDateTime.now())
                .build();
        when(tradeService.create(any())).thenReturn(expected);

        TradeResponse response = todaySessionService.startTrade(validStartRequest());

        assertEquals(expected.getId(), response.getId());
        ArgumentCaptor<TradeRequest> captor = ArgumentCaptor.forClass(TradeRequest.class);
        verify(tradeService).create(captor.capture());
        assertEquals(sweepLevel.getId(), captor.getValue().getSweepLevelId());
        assertEquals(entryLevel.getId(), captor.getValue().getEntryLevelId());
        assertEquals(slLevel.getId(), captor.getValue().getSlLevelId());
    }

    @Test
    void startTradeValidationIncludesNarrativeAndRoles() {
        narrativeStore = null;
        session.setActiveSweepLevelId(null);
        session.setActiveEntryLevelId(null);
        session.setActiveSlLevelId(null);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> todaySessionService.startTrade(validStartRequest()));

        assertTrue(ex.getMessage().contains("narrative"));
        assertTrue(ex.getMessage().contains("sweep role"));
        assertTrue(ex.getMessage().contains("entry role"));
        assertTrue(ex.getMessage().contains("SL role"));
    }

    @Test
    void createUpdateDeleteLevelWorks() {
        int before = levelsStore.size();

        SessionLevelRequest create = new SessionLevelRequest();
        create.setLabel("London High");
        create.setSymbol("EURUSD");
        create.setType(LevelType.LONDON_H);
        create.setTimeframe(LevelTimeframe.H1);
        create.setPrice(BigDecimal.valueOf(1.0912));
        create.setStrengthScore((short) 4);
        todaySessionService.createSessionLevel(session.getId(), create);

        assertEquals(before + 1, levelsStore.size());
        SessionLevel created = levelsStore.get(levelsStore.size() - 1);
        assertEquals(LevelType.LONDON_H, created.getLevelType());
        assertEquals(LevelTimeframe.H1, created.getTimeframe());

        SessionLevelRequest update = new SessionLevelRequest();
        update.setSwept(true);
        update.setStatus(LevelStatus.SWEPT);
        update.setStrengthScore((short) 5);
        todaySessionService.updateSessionLevel(session.getId(), created.getId(), update);

        SessionLevel updated = levelsStore.stream().filter(item -> item.getId().equals(created.getId())).findFirst().orElseThrow();
        assertEquals(LevelStatus.SWEPT, updated.getStatus());
        assertTrue((updated.getTouchedCount() == null ? 0 : updated.getTouchedCount()) >= 1);

        todaySessionService.deleteSessionLevel(session.getId(), created.getId());
        assertEquals(before, levelsStore.size());
    }

    @Test
    void sweepRoleIsSingleSelectionPerSessionAndSymbol() {
        SessionLevel another = baseLevel("Secondary Sweep", LevelType.ASIA_H, false, false, false, false);
        levelsStore.add(another);

        SessionLevelRequest request = new SessionLevelRequest();
        request.setSweepRole(true);
        todaySessionService.updateSessionLevel(session.getId(), another.getId(), request);

        List<SessionLevel> eurusdLevels = levelsStore.stream()
                .filter(level -> "EURUSD".equalsIgnoreCase(level.getSymbol()))
                .toList();
        long sweepCount = eurusdLevels.stream().filter(SessionLevel::isSweepRole).count();
        assertEquals(1L, sweepCount);
        SessionLevel selectedSweep = eurusdLevels.stream().filter(SessionLevel::isSweepRole).findFirst().orElseThrow();
        assertEquals(another.getId(), selectedSweep.getId());
    }

    @Test
    void suggestLevelsReturnsDeterministicStructure() {
        levelsStore.clear();

        var first = todaySessionService.suggestSessionLevels(session.getId(), "EURUSD");
        var second = todaySessionService.suggestSessionLevels(session.getId(), "EURUSD");

        assertFalse(first.isEmpty());
        assertEquals(first, second);
        assertTrue(first.stream().allMatch(item -> item.getConfidence() >= 0.0 && item.getConfidence() <= 1.0));
        assertNotNull(first.get(0).getType());
        assertNotNull(first.get(0).getTimeframe());
    }

    @Test
    void narrativeSaveAndLoadWorks() {
        SessionNarrativeRequest request = new SessionNarrativeRequest();
        request.setHtfDraw(NarrativeHtfDraw.WEEKLY_H);
        request.setExpectedManipulation(NarrativeManipulation.RAID_DOWN);
        request.setConfirmationModel(NarrativeConfirmationModel.DISPLACEMENT_M1_MSS_M1);
        request.setNotes("Expect raid then reversal");

        var saved = todaySessionService.upsertSessionNarrative(session.getId(), request);
        var loaded = todaySessionService.getSessionNarrative(session.getId());

        assertEquals(NarrativeHtfDraw.WEEKLY_H, saved.getHtfDraw());
        assertEquals(NarrativeManipulation.RAID_DOWN, saved.getExpectedManipulation());
        assertEquals(NarrativeConfirmationModel.DISPLACEMENT_M1_MSS_M1, loaded.getConfirmationModel());
    }

    @Test
    void narrativeCreatePathUsesMapsIdFlowWithoutPresetIdentifier() {
        narrativeStore = null;

        SessionNarrativeRequest request = new SessionNarrativeRequest();
        request.setHtfDraw(NarrativeHtfDraw.WEEKLY_H);
        request.setExpectedManipulation(NarrativeManipulation.RAID_DOWN);
        request.setNotes("Create path");

        when(sessionNarrativeRepository.saveAndFlush(any(SessionNarrative.class))).thenAnswer(invocation -> {
            SessionNarrative toPersist = invocation.getArgument(0);
            assertEquals(null, toPersist.getSessionId());
            assertEquals(session, toPersist.getTodaySession());
            assertEquals(session.getUser(), toPersist.getUser());
            toPersist.setSessionId(session.getId());
            narrativeStore = toPersist;
            return toPersist;
        });

        var saved = todaySessionService.upsertSessionNarrative(session.getId(), request);

        assertEquals(session.getId(), saved.getSessionId());
        assertEquals(session.getId(), narrativeStore.getSessionId());
        verify(sessionNarrativeRepository).saveAndFlush(any(SessionNarrative.class));
    }

    @Test
    void closeTradeComputesMfeMaeAndKeepsNullableCandleMetricsSafe() {
        Trade existing = Trade.builder()
                .id(UUID.randomUUID())
                .user(user)
                .symbol("EURUSD")
                .direction(Direction.LONG)
                .status(TradeStatus.OPEN)
                .sessionId(session.getId())
                .openedAt(OffsetDateTime.now().minusMinutes(30))
                .quantity(BigDecimal.ONE)
                .entryPrice(BigDecimal.valueOf(1.0812))
                .stopLossPrice(BigDecimal.valueOf(1.0790))
                .takeProfitPrice(BigDecimal.valueOf(1.0840))
                .session(TradeSession.LONDON)
                .setupGrade(TradeGrade.A)
                .initialNotes("Initial thesis before entry")
                .levelExpectation("Target only")
                .build();

        when(tradeRepository.findByIdAndUserId(existing.getId(), user.getId())).thenReturn(Optional.of(existing));
        when(tradeService.update(eq(existing.getId()), any())).thenReturn(TradeResponse.builder()
                .id(existing.getId())
                .status(TradeStatus.CLOSED)
                .initialNotes("Initial thesis before entry")
                .notes("Closed after target hit")
                .build());

        CloseSessionTradeRequest request = new CloseSessionTradeRequest();
        request.setExitPrice(BigDecimal.valueOf(1.083));
        request.setPostTradeNotes("Closed after target hit");

        todaySessionService.closeTrade(existing.getId(), request);

        ArgumentCaptor<TradeRequest> updateCaptor = ArgumentCaptor.forClass(TradeRequest.class);
        verify(tradeService).update(eq(existing.getId()), updateCaptor.capture());
        assertEquals("Initial thesis before entry", updateCaptor.getValue().getInitialNotes());
        assertEquals("Closed after target hit", updateCaptor.getValue().getNotes());
        assertEquals(BigDecimal.valueOf(0.00180000).setScale(8), updateCaptor.getValue().getMfePoints());
        assertEquals(BigDecimal.ZERO.setScale(8), updateCaptor.getValue().getMaePoints());
        assertEquals(null, updateCaptor.getValue().getSweepDepthPoints());
        assertEquals(null, updateCaptor.getValue().getDisplacementSizePoints());
    }

    @Test
    void updateChecklistDetachesTriggerTemplateWhenStructureChanges() {
        TodaySessionChecklistUpdateRequest request = new TodaySessionChecklistUpdateRequest();
        request.setType(ChecklistTemplateType.TRIGGERS);
        request.setItems(List.of(
                SessionChecklistItemDto.builder()
                        .id("00000000-0000-0000-0000-000000000021")
                        .text("Liquidity sweep confirmed")
                        .order(0)
                        .required(true)
                        .valueType(ChecklistValueType.TEXT)
                        .completed(true)
                        .build(),
                SessionChecklistItemDto.builder()
                        .id("custom-structure-1")
                        .text("Wait for reclaim candle")
                        .order(1)
                        .required(true)
                        .hasNote(true)
                        .notePlaceholder("Evidence")
                        .valueType(ChecklistValueType.TEXT)
                        .completed(false)
                        .build()
        ));

        var response = todaySessionService.updateChecklist(request);

        assertEquals(null, response.getTriggerTemplateId());
        assertEquals(2, response.getTriggerChecklistItems().size());
        assertEquals("Wait for reclaim candle", response.getTriggerChecklistItems().get(1).getText());
        assertEquals(null, session.getTriggersTemplate());
    }

    @Test
    void updateChecklistKeepsTriggerTemplateForCompletionUpdates() {
        UUID activeTemplateId = session.getTriggersTemplate().getId();

        TodaySessionChecklistUpdateRequest request = new TodaySessionChecklistUpdateRequest();
        request.setType(ChecklistTemplateType.TRIGGERS);
        request.setItems(List.of(
                SessionChecklistItemDto.builder()
                        .id("00000000-0000-0000-0000-000000000021")
                        .text("Liquidity sweep confirmed")
                        .order(0)
                        .required(true)
                        .valueType(ChecklistValueType.TEXT)
                        .completed(true)
                        .build(),
                SessionChecklistItemDto.builder()
                        .id("00000000-0000-0000-0000-000000000022")
                        .text("Displacement close (M5) away from sweep")
                        .order(1)
                        .required(true)
                        .valueType(ChecklistValueType.TEXT)
                        .completed(false)
                        .build(),
                SessionChecklistItemDto.builder()
                        .id("00000000-0000-0000-0000-000000000023")
                        .text("MSS confirmed on close")
                        .order(2)
                        .required(true)
                        .valueType(ChecklistValueType.TEXT)
                        .completed(false)
                        .build()
        ));

        var response = todaySessionService.updateChecklist(request);

        assertEquals(activeTemplateId, response.getTriggerTemplateId());
        assertTrue(response.getTriggerChecklistItems().get(0).isCompleted());
    }

    @Test
    void updateChecklistAppliesTriggerTemplateAndReplacesRows() {
        UUID importedTemplateId = UUID.randomUUID();
        ChecklistTemplate importedTemplate = ChecklistTemplate.builder()
                .id(importedTemplateId)
                .user(user)
                .name("Imported trigger template")
                .type(ChecklistTemplateType.TRIGGERS)
                .build();
        when(checklistTemplateRepository.findByIdAndUser_Id(importedTemplateId, user.getId()))
                .thenReturn(Optional.of(importedTemplate));
        when(checklistTemplateEntryRepository.findByTemplate_IdOrderBySortOrderAscCreatedAtAsc(importedTemplateId))
                .thenReturn(List.of(
                        ChecklistTemplateEntry.builder()
                                .id(UUID.fromString("00000000-0000-0000-0000-000000000031"))
                                .template(importedTemplate)
                                .itemText("Imported trigger condition")
                                .sortOrder(0)
                                .required(true)
                                .build()
                ));

        TodaySessionChecklistUpdateRequest request = new TodaySessionChecklistUpdateRequest();
        request.setType(ChecklistTemplateType.TRIGGERS);
        request.setTemplateId(importedTemplateId);

        var response = todaySessionService.updateChecklist(request);

        assertEquals(importedTemplateId, response.getTriggerTemplateId());
        assertEquals(1, response.getTriggerChecklistItems().size());
        assertEquals("Imported trigger condition", response.getTriggerChecklistItems().get(0).getText());
    }

    @Test
    void logAutoTradeEventPersistsForSession() {
        SessionAutoTradeEventRequest request = new SessionAutoTradeEventRequest();
        request.setType(AutoTradeEventType.ENTRY_FILLED);
        request.setSide(QuoteSide.ASK);
        request.setPrice(BigDecimal.valueOf(1.08321));
        request.setNote("Entry touched by ask");

        when(sessionAutoTradeEventRepository.save(any(SessionAutoTradeEvent.class)))
                .thenAnswer(invocation -> {
                    SessionAutoTradeEvent event = invocation.getArgument(0);
                    event.setId(UUID.randomUUID());
                    event.setCreatedAtUtc(OffsetDateTime.now());
                    return event;
                });

        var response = todaySessionService.logAutoTradeEvent(session.getId(), request);

        assertEquals(AutoTradeEventType.ENTRY_FILLED, response.getType());
        assertEquals(QuoteSide.ASK, response.getSide());
        assertEquals(BigDecimal.valueOf(1.08321000).setScale(8), response.getPrice());
        assertEquals("Entry touched by ask", response.getNote());
        assertEquals(session.getId(), response.getSessionId());
    }

    @Test
    void listAutoTradeEventsReturnsNewestFirst() {
        OffsetDateTime now = OffsetDateTime.now();
        SessionAutoTradeEvent newer = SessionAutoTradeEvent.builder()
                .id(UUID.randomUUID())
                .todaySession(session)
                .user(user)
                .eventType(AutoTradeEventType.TP_HIT)
                .priceSide(QuoteSide.BID)
                .price(BigDecimal.valueOf(1.086))
                .note("TP touched")
                .createdAtUtc(now)
                .build();
        SessionAutoTradeEvent older = SessionAutoTradeEvent.builder()
                .id(UUID.randomUUID())
                .todaySession(session)
                .user(user)
                .eventType(AutoTradeEventType.ARMED)
                .createdAtUtc(now.minusMinutes(5))
                .build();
        when(sessionAutoTradeEventRepository.findByTodaySession_IdAndUser_IdOrderByCreatedAtUtcDesc(session.getId(), user.getId()))
                .thenReturn(List.of(newer, older));

        var response = todaySessionService.listAutoTradeEvents(session.getId());

        assertEquals(2, response.size());
        assertEquals(AutoTradeEventType.TP_HIT, response.get(0).getType());
        assertEquals(AutoTradeEventType.ARMED, response.get(1).getType());
    }

    @Test
    void getTodaySessionSyncsChecklistWithLatestAnalyticsTemplateItems() throws Exception {
        UUID existingId = UUID.randomUUID();
        UUID newId = UUID.randomUUID();

        session.setChecklistTemplate(null);
        session.setPrereqsTemplate(null);
        session.setPrereqsStateJson(null);
        session.setChecklistStateJson(objectMapper.writeValueAsString(List.of(
                SessionChecklistItemDto.builder()
                        .id(existingId.toString())
                        .text("Old wording")
                        .completed(true)
                        .build(),
                SessionChecklistItemDto.builder()
                        .id("removed-id")
                        .text("Removed item")
                        .completed(true)
                        .build()
        )));

        ChecklistTemplateItem existing = ChecklistTemplateItem.builder()
                .id(existingId)
                .user(user)
                .text("Updated wording")
                .sortOrder(0)
                .isEnabled(true)
                .build();
        ChecklistTemplateItem added = ChecklistTemplateItem.builder()
                .id(newId)
                .user(user)
                .text("New checklist item")
                .sortOrder(1)
                .isEnabled(true)
                .build();

        when(checklistTemplateItemRepository.findByUser_IdAndIsEnabledTrueOrderBySortOrderAscCreatedAtAsc(user.getId()))
                .thenReturn(List.of(existing, added));

        var response = todaySessionService.getTodaySession();

        assertEquals(2, response.getChecklistItems().size());
        assertEquals(existingId.toString(), response.getChecklistItems().get(0).getId());
        assertEquals("Updated wording", response.getChecklistItems().get(0).getText());
        assertEquals(true, response.getChecklistItems().get(0).isCompleted());
        assertEquals(newId.toString(), response.getChecklistItems().get(1).getId());
        assertEquals(false, response.getChecklistItems().get(1).isCompleted());
    }

    @Test
    void getTodaySessionKeepsCompletionWhenLegacyChecklistItemsOnlyMatchByText() throws Exception {
        UUID templateId = UUID.randomUUID();

        session.setChecklistTemplate(null);
        session.setPrereqsTemplate(null);
        session.setPrereqsStateJson(null);
        session.setChecklistStateJson(objectMapper.writeValueAsString(List.of(
                SessionChecklistItemDto.builder()
                        .id("item-1")
                        .text("Review market structure")
                        .completed(true)
                        .build()
        )));

        ChecklistTemplateItem templateItem = ChecklistTemplateItem.builder()
                .id(templateId)
                .user(user)
                .text("Review market structure")
                .sortOrder(0)
                .isEnabled(true)
                .build();

        when(checklistTemplateItemRepository.findByUser_IdAndIsEnabledTrueOrderBySortOrderAscCreatedAtAsc(user.getId()))
                .thenReturn(List.of(templateItem));

        var response = todaySessionService.getTodaySession();

        assertEquals(1, response.getChecklistItems().size());
        assertEquals(templateId.toString(), response.getChecklistItems().get(0).getId());
        assertEquals(true, response.getChecklistItems().get(0).isCompleted());
    }

    private void wireSessionLevelRepositoryStore() {
        when(sessionLevelRepository.findByTodaySession_IdAndUser_IdOrderByCreatedAtAsc(session.getId(), user.getId()))
                .thenAnswer(invocation -> new ArrayList<>(levelsStore));

        when(sessionLevelRepository.findByTodaySession_IdAndUser_IdAndSymbolIgnoreCaseOrderByCreatedAtAsc(
                eq(session.getId()), eq(user.getId()), any(String.class)))
                .thenAnswer(invocation -> {
                    String symbol = invocation.getArgument(2, String.class);
                    return levelsStore.stream()
                            .filter(level -> level.getSymbol() != null && level.getSymbol().equalsIgnoreCase(symbol))
                            .toList();
                });

        when(sessionLevelRepository.findByIdAndTodaySession_IdAndUser_Id(any(UUID.class), eq(session.getId()), eq(user.getId())))
                .thenAnswer(invocation -> {
                    UUID id = invocation.getArgument(0, UUID.class);
                    return levelsStore.stream().filter(level -> level.getId().equals(id)).findFirst();
                });

        when(sessionLevelRepository.findByTodaySession_IdAndUser_IdAndSymbolIgnoreCaseAndSweepRoleTrue(
                eq(session.getId()), eq(user.getId()), any(String.class)))
                .thenAnswer(invocation -> {
                    String symbol = invocation.getArgument(2, String.class);
                    return levelsStore.stream()
                            .filter(level -> level.getSymbol() != null && level.getSymbol().equalsIgnoreCase(symbol))
                            .filter(SessionLevel::isSweepRole)
                            .findFirst();
                });

        when(sessionLevelRepository.findByTodaySession_IdAndUser_IdAndSymbolIgnoreCaseAndEntryRoleTrue(
                eq(session.getId()), eq(user.getId()), any(String.class)))
                .thenAnswer(invocation -> {
                    String symbol = invocation.getArgument(2, String.class);
                    return levelsStore.stream()
                            .filter(level -> level.getSymbol() != null && level.getSymbol().equalsIgnoreCase(symbol))
                            .filter(SessionLevel::isEntryRole)
                            .findFirst();
                });

        when(sessionLevelRepository.findByTodaySession_IdAndUser_IdAndSymbolIgnoreCaseAndSlRoleTrue(
                eq(session.getId()), eq(user.getId()), any(String.class)))
                .thenAnswer(invocation -> {
                    String symbol = invocation.getArgument(2, String.class);
                    return levelsStore.stream()
                            .filter(level -> level.getSymbol() != null && level.getSymbol().equalsIgnoreCase(symbol))
                            .filter(SessionLevel::isSlRole)
                            .findFirst();
                });

        when(sessionLevelRepository.findByTodaySession_IdAndUser_IdAndSymbolIgnoreCaseAndTpRoleTrue(
                eq(session.getId()), eq(user.getId()), any(String.class)))
                .thenAnswer(invocation -> {
                    String symbol = invocation.getArgument(2, String.class);
                    return levelsStore.stream()
                            .filter(level -> level.getSymbol() != null && level.getSymbol().equalsIgnoreCase(symbol))
                            .filter(SessionLevel::isTpRole)
                            .findFirst();
                });

        when(sessionLevelRepository.save(any(SessionLevel.class))).thenAnswer(invocation -> {
            SessionLevel level = invocation.getArgument(0);
            if (level.getId() == null) {
                level.setId(UUID.randomUUID());
            }
            int index = -1;
            for (int i = 0; i < levelsStore.size(); i++) {
                if (levelsStore.get(i).getId().equals(level.getId())) {
                    index = i;
                    break;
                }
            }
            if (index >= 0) {
                levelsStore.set(index, level);
            } else {
                levelsStore.add(level);
            }
            return level;
        });

        when(sessionLevelRepository.saveAll(any(Iterable.class))).thenAnswer(invocation -> {
            Iterable<SessionLevel> levels = invocation.getArgument(0);
            List<SessionLevel> saved = new ArrayList<>();
            for (SessionLevel level : levels) {
                saved.add(sessionLevelRepository.save(level));
            }
            return saved;
        });

        Mockito.doAnswer(invocation -> {
            UUID id = invocation.getArgument(0);
            levelsStore.removeIf(level -> level.getId().equals(id));
            return null;
        }).when(sessionLevelRepository).deleteByIdAndTodaySession_IdAndUser_Id(any(UUID.class), eq(session.getId()), eq(user.getId()));
    }

    private void wirePoolRepositoryStore() {
        when(liquidityPoolRepository.findByTodaySession_IdAndUser_IdOrderByCreatedAtUtcAsc(session.getId(), user.getId()))
                .thenAnswer(invocation -> new ArrayList<>(poolsStore));

        when(liquidityPoolRepository.findByTodaySession_IdAndUser_IdAndSymbolIgnoreCaseOrderByCreatedAtUtcAsc(
                eq(session.getId()), eq(user.getId()), any(String.class)))
                .thenAnswer(invocation -> {
                    String symbol = invocation.getArgument(2, String.class);
                    return poolsStore.stream()
                            .filter(pool -> pool.getSymbol() != null && pool.getSymbol().equalsIgnoreCase(symbol))
                            .toList();
                });

        when(liquidityPoolRepository.findByIdAndTodaySession_IdAndUser_Id(any(UUID.class), eq(session.getId()), eq(user.getId())))
                .thenAnswer(invocation -> {
                    UUID id = invocation.getArgument(0, UUID.class);
                    return poolsStore.stream().filter(pool -> pool.getId().equals(id)).findFirst();
                });

        when(liquidityPoolRepository.save(any(LiquidityPool.class))).thenAnswer(invocation -> {
            LiquidityPool pool = invocation.getArgument(0);
            if (pool.getId() == null) {
                pool.setId(UUID.randomUUID());
            }
            poolsStore.removeIf(item -> item.getId().equals(pool.getId()));
            poolsStore.add(pool);
            return pool;
        });

        when(liquidityPoolRepository.saveAll(any(Iterable.class))).thenAnswer(invocation -> {
            Iterable<LiquidityPool> pools = invocation.getArgument(0);
            List<LiquidityPool> saved = new ArrayList<>();
            for (LiquidityPool pool : pools) {
                saved.add(liquidityPoolRepository.save(pool));
            }
            return saved;
        });

        when(liquidityPoolRepository.findByTodaySession_IdAndUser_IdAndSymbolIgnoreCaseAndSweepRoleTrue(
                eq(session.getId()), eq(user.getId()), any(String.class)))
                .thenAnswer(invocation -> {
                    String symbol = invocation.getArgument(2, String.class);
                    return poolsStore.stream()
                            .filter(pool -> pool.getSymbol() != null && pool.getSymbol().equalsIgnoreCase(symbol))
                            .filter(LiquidityPool::isSweepRole)
                            .findFirst();
                });
    }

    private void wireNarrativeRepositoryStore() {
        when(sessionNarrativeRepository.findBySessionIdAndUser_Id(session.getId(), user.getId()))
                .thenAnswer(invocation -> Optional.ofNullable(narrativeStore));
        when(sessionNarrativeRepository.findByTodaySession_IdAndUser_Id(session.getId(), user.getId()))
                .thenAnswer(invocation -> Optional.ofNullable(narrativeStore));
        when(sessionNarrativeRepository.save(any(SessionNarrative.class))).thenAnswer(invocation -> {
            narrativeStore = invocation.getArgument(0);
            if (narrativeStore.getSessionId() == null) {
                narrativeStore.setSessionId(session.getId());
            }
            return narrativeStore;
        });
        when(sessionNarrativeRepository.saveAndFlush(any(SessionNarrative.class))).thenAnswer(invocation -> {
            narrativeStore = invocation.getArgument(0);
            if (narrativeStore.getSessionId() == null && narrativeStore.getTodaySession() != null) {
                narrativeStore.setSessionId(narrativeStore.getTodaySession().getId());
            }
            return narrativeStore;
        });
    }

    private SessionLevel baseLevel(String label,
                                   LevelType type,
                                   boolean sweep,
                                   boolean entry,
                                   boolean sl,
                                   boolean tp) {
        return SessionLevel.builder()
                .id(UUID.randomUUID())
                .todaySession(session)
                .user(user)
                .label(label)
                .symbol("EURUSD")
                .levelType(type)
                .timeframe(LevelTimeframe.M15)
                .price(BigDecimal.valueOf(1.0820))
                .status(LevelStatus.FRESH)
                .strengthScore((short) 3)
                .touchedCount(0)
                .createdBy(LevelCreatedBy.USER)
                .category(SessionLevelCategory.LIQUIDITY)
                .notes(null)
                .sweepRole(sweep)
                .entryRole(entry)
                .slRole(sl)
                .tpRole(tp)
                .build();
    }

    private List<SessionChecklistItemDto> completedPrereqs() {
        return List.of(
                SessionChecklistItemDto.builder().id("pr-news").text("News check done").required(true).completed(true).build(),
                SessionChecklistItemDto.builder().id("pr-levels").text("Key levels marked").required(true).completed(true).build()
        );
    }

    private List<SessionChecklistItemDto> completedTriggers() {
        return List.of(
                SessionChecklistItemDto.builder().id("tr-sweep").text("Liquidity sweep confirmed").required(true).completed(true).build(),
                SessionChecklistItemDto.builder().id("tr-displacement").text("Displacement close (M5) away from sweep").required(true).completed(true).build(),
                SessionChecklistItemDto.builder().id("tr-mss").text("MSS confirmed on close").required(true).completed(true).build()
        );
    }

    private void verifySessionMarkedCompleted() {
        ArgumentCaptor<TodaySession> captor = ArgumentCaptor.forClass(TodaySession.class);
        verify(todaySessionRepository).save(captor.capture());
        assertEquals(TodaySessionStatus.COMPLETED, captor.getValue().getStatus());
    }

    private StartSessionTradeRequest validStartRequest() {
        StartSessionTradeRequest request = new StartSessionTradeRequest();
        request.setSymbol("EURUSD");
        request.setDirection(Direction.LONG);
        request.setQuantity(BigDecimal.ONE);
        request.setEntryPrice(BigDecimal.valueOf(1.0812));
        request.setTakeProfitPrice(BigDecimal.valueOf(1.0848));
        request.setStopLossPrice(BigDecimal.valueOf(1.0790));
        request.setSession(TradeSession.LONDON);
        request.setFeeling("Focused");
        request.setSetupGrade(TradeGrade.A);
        request.setStrategyTag("Sweep -> MSS -> FVG Retest");
        request.setEntryJournalText("M5 displacement after sweep");
        request.setEntryInvalidation("I'm wrong if M5 closes below sweep origin.");
        request.setEntryScreenshotAssetIds(new LinkedHashSet<>());
        return request;
    }
}
