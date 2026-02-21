package com.tradevault.service.today;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.ChecklistTemplateItem;
import com.tradevault.domain.entity.TodaySession;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TodaySessionStatus;
import com.tradevault.domain.enums.TradeGrade;
import com.tradevault.domain.enums.TradeSession;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.session.CloseSessionTradeRequest;
import com.tradevault.dto.session.SessionChecklistItemDto;
import com.tradevault.dto.session.StartSessionTradeRequest;
import com.tradevault.dto.trade.TradeRequest;
import com.tradevault.dto.trade.TradeResponse;
import com.tradevault.repository.ChecklistTemplateEntryRepository;
import com.tradevault.repository.ChecklistTemplateItemRepository;
import com.tradevault.repository.ChecklistTemplateRepository;
import com.tradevault.repository.SessionLevelRepository;
import com.tradevault.repository.TodaySessionRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.TradeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
    private SessionLevelRepository sessionLevelRepository;
    private CurrentUserService currentUserService;
    private TradeService tradeService;
    private TodaySessionService todaySessionService;
    private ObjectMapper objectMapper;
    private User user;
    private TodaySession session;

    @BeforeEach
    void setup() {
        todaySessionRepository = Mockito.mock(TodaySessionRepository.class);
        tradeRepository = Mockito.mock(TradeRepository.class);
        checklistTemplateRepository = Mockito.mock(ChecklistTemplateRepository.class);
        checklistTemplateEntryRepository = Mockito.mock(ChecklistTemplateEntryRepository.class);
        checklistTemplateItemRepository = Mockito.mock(ChecklistTemplateItemRepository.class);
        sessionLevelRepository = Mockito.mock(SessionLevelRepository.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        tradeService = Mockito.mock(TradeService.class);

        objectMapper = new ObjectMapper();
        todaySessionService = new TodaySessionService(
                todaySessionRepository,
                tradeRepository,
                checklistTemplateRepository,
                checklistTemplateEntryRepository,
                checklistTemplateItemRepository,
                sessionLevelRepository,
                currentUserService,
                tradeService,
                objectMapper
        );

        user = User.builder()
                .id(UUID.randomUUID())
                .email("trader@example.com")
                .timezone("Europe/Bucharest")
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
                .build();

        when(todaySessionRepository.findByUser_IdAndSessionDate(eq(user.getId()), any(LocalDate.class)))
                .thenReturn(Optional.of(session));
        when(todaySessionRepository.save(any(TodaySession.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(tradeRepository.findFirstByUser_IdAndSessionIdAndStatusOrderByOpenedAtDescCreatedAtDesc(
                eq(user.getId()), eq(session.getId()), eq(TradeStatus.OPEN)))
                .thenReturn(Optional.empty());
    }

    @Test
    void startTradeIsBlockedWhenMaxTradesReached() {
        when(tradeRepository.countByUser_IdAndSessionIdAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED))
                .thenReturn(3L);
        when(tradeRepository.sumNetPnlByUserAndSessionAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED))
                .thenReturn(BigDecimal.ZERO);

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
    void startTradePassesWhenGuardrailsAreNotReached() {
        when(tradeRepository.countByUser_IdAndSessionIdAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED))
                .thenReturn(1L);
        when(tradeRepository.sumNetPnlByUserAndSessionAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED))
                .thenReturn(BigDecimal.valueOf(35));

        TradeResponse expected = TradeResponse.builder()
                .id(UUID.randomUUID())
                .status(TradeStatus.OPEN)
                .openedAt(OffsetDateTime.now())
                .build();
        when(tradeService.create(any())).thenReturn(expected);

        TradeResponse response = todaySessionService.startTrade(validStartRequest());

        assertEquals(expected.getId(), response.getId());
        verify(tradeService).create(any());
    }

    @Test
    void startTradeMapsPlannerNotesToInitialNotes() {
        when(tradeRepository.countByUser_IdAndSessionIdAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED))
                .thenReturn(0L);
        when(tradeRepository.sumNetPnlByUserAndSessionAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED))
                .thenReturn(BigDecimal.ZERO);
        when(tradeService.create(any())).thenReturn(TradeResponse.builder()
                .id(UUID.randomUUID())
                .status(TradeStatus.OPEN)
                .build());

        StartSessionTradeRequest request = validStartRequest();
        request.setInitialNotes("Wait for MSS confirmation only");

        todaySessionService.startTrade(request);

        ArgumentCaptor<TradeRequest> tradeRequestCaptor = ArgumentCaptor.forClass(TradeRequest.class);
        verify(tradeService).create(tradeRequestCaptor.capture());
        assertEquals("Wait for MSS confirmation only", tradeRequestCaptor.getValue().getInitialNotes());
        assertEquals(null, tradeRequestCaptor.getValue().getNotes());
    }

    @Test
    void startTradeMapsEntryJournalFieldsAndScreenshotAssetIds() {
        when(tradeRepository.countByUser_IdAndSessionIdAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED))
                .thenReturn(0L);
        when(tradeRepository.sumNetPnlByUserAndSessionAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED))
                .thenReturn(BigDecimal.ZERO);
        when(tradeService.create(any())).thenReturn(TradeResponse.builder()
                .id(UUID.randomUUID())
                .status(TradeStatus.OPEN)
                .build());

        UUID assetA = UUID.randomUUID();
        UUID assetB = UUID.randomUUID();
        StartSessionTradeRequest request = validStartRequest();
        request.setEntryJournalText("M5 displacement after sweep");
        request.setEntryInvalidation("I'm wrong if M5 closes below sweep origin.");
        request.setEntryScreenshotAssetIds(Set.of(assetA, assetB));

        todaySessionService.startTrade(request);

        ArgumentCaptor<TradeRequest> tradeRequestCaptor = ArgumentCaptor.forClass(TradeRequest.class);
        verify(tradeService).create(tradeRequestCaptor.capture());
        assertEquals("M5 displacement after sweep", tradeRequestCaptor.getValue().getEntryJournalText());
        assertEquals("I'm wrong if M5 closes below sweep origin.", tradeRequestCaptor.getValue().getEntryInvalidation());
        assertEquals(Set.of(assetA, assetB), tradeRequestCaptor.getValue().getEntryScreenshotAssetIds());
    }

    @Test
    void closeTradePreservesInitialNotesAndStoresPostTradeNotesSeparately() {
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
                .session(TradeSession.LONDON)
                .setupGrade(TradeGrade.A)
                .initialNotes("Initial thesis before entry")
                .build();

        when(tradeRepository.findByIdAndUserId(existing.getId(), user.getId())).thenReturn(Optional.of(existing));
        when(tradeService.update(eq(existing.getId()), any())).thenReturn(TradeResponse.builder()
                .id(existing.getId())
                .status(TradeStatus.CLOSED)
                .initialNotes("Initial thesis before entry")
                .notes("Closed after target hit")
                .build());
        when(tradeRepository.countByUser_IdAndSessionIdAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED))
                .thenReturn(1L);
        when(tradeRepository.sumNetPnlByUserAndSessionAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED))
                .thenReturn(BigDecimal.valueOf(50));

        CloseSessionTradeRequest request = new CloseSessionTradeRequest();
        request.setExitPrice(BigDecimal.valueOf(1.083));
        request.setPostTradeNotes("Closed after target hit");

        todaySessionService.closeTrade(existing.getId(), request);

        ArgumentCaptor<TradeRequest> updateCaptor = ArgumentCaptor.forClass(TradeRequest.class);
        verify(tradeService).update(eq(existing.getId()), updateCaptor.capture());
        assertEquals("Initial thesis before entry", updateCaptor.getValue().getInitialNotes());
        assertEquals("Closed after target hit", updateCaptor.getValue().getNotes());
    }

    @Test
    void getTodaySessionSyncsChecklistWithLatestAnalyticsTemplateItems() throws Exception {
        UUID existingId = UUID.randomUUID();
        UUID newId = UUID.randomUUID();

        session.setChecklistTemplate(null);
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
        request.setTakeProfitPrice(BigDecimal.valueOf(1.0840));
        request.setStopLossPrice(BigDecimal.valueOf(1.0790));
        request.setSession(TradeSession.LONDON);
        request.setFeeling("Focused");
        request.setSetupGrade(TradeGrade.A);
        request.setStrategyTag("Sweep -> MSS -> FVG Retest");
        return request;
    }
}
