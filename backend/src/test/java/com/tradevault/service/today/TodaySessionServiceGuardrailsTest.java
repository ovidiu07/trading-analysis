package com.tradevault.service.today;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.TodaySession;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TodaySessionStatus;
import com.tradevault.domain.enums.TradeGrade;
import com.tradevault.domain.enums.TradeSession;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.session.StartSessionTradeRequest;
import com.tradevault.dto.trade.TradeResponse;
import com.tradevault.repository.ChecklistTemplateEntryRepository;
import com.tradevault.repository.ChecklistTemplateItemRepository;
import com.tradevault.repository.ChecklistTemplateRepository;
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
import java.util.Optional;
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
    private CurrentUserService currentUserService;
    private TradeService tradeService;
    private TodaySessionService todaySessionService;
    private User user;
    private TodaySession session;

    @BeforeEach
    void setup() {
        todaySessionRepository = Mockito.mock(TodaySessionRepository.class);
        tradeRepository = Mockito.mock(TradeRepository.class);
        checklistTemplateRepository = Mockito.mock(ChecklistTemplateRepository.class);
        checklistTemplateEntryRepository = Mockito.mock(ChecklistTemplateEntryRepository.class);
        checklistTemplateItemRepository = Mockito.mock(ChecklistTemplateItemRepository.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        tradeService = Mockito.mock(TradeService.class);

        todaySessionService = new TodaySessionService(
                todaySessionRepository,
                tradeRepository,
                checklistTemplateRepository,
                checklistTemplateEntryRepository,
                checklistTemplateItemRepository,
                currentUserService,
                tradeService,
                new ObjectMapper()
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
