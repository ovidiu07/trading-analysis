package com.tradevault.service.today;

import com.tradevault.domain.entity.SessionAutoTradeEvent;
import com.tradevault.domain.entity.TodaySession;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.AutoJournalState;
import com.tradevault.domain.enums.AutoTradeEventType;
import com.tradevault.domain.enums.Direction;
import com.tradevault.dto.session.LiveQuoteResponse;
import com.tradevault.dto.session.QuoteAvailabilityReason;
import com.tradevault.dto.session.SessionAutoJournalArmRequest;
import com.tradevault.repository.SessionAutoTradeEventRepository;
import com.tradevault.repository.TodaySessionRepository;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.QuoteService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SessionAutoJournalServiceTest {
    private TodaySessionRepository todaySessionRepository;
    private SessionAutoTradeEventRepository sessionAutoTradeEventRepository;
    private CurrentUserService currentUserService;
    private QuoteService quoteService;
    private SessionAutoJournalService service;

    private User user;
    private TodaySession session;

    @BeforeEach
    void setUp() {
        todaySessionRepository = mock(TodaySessionRepository.class);
        sessionAutoTradeEventRepository = mock(SessionAutoTradeEventRepository.class);
        currentUserService = mock(CurrentUserService.class);
        quoteService = mock(QuoteService.class);

        service = new SessionAutoJournalService(
                todaySessionRepository,
                sessionAutoTradeEventRepository,
                currentUserService,
                quoteService
        );

        user = User.builder().id(UUID.randomUUID()).email("trader@example.com").build();
        session = TodaySession.builder()
                .id(UUID.randomUUID())
                .user(user)
                .sessionDate(LocalDate.of(2026, 2, 24))
                .profitTarget(BigDecimal.valueOf(200))
                .lossLimit(BigDecimal.valueOf(100))
                .maxTrades(3)
                .status(com.tradevault.domain.enums.TodaySessionStatus.ACTIVE)
                .autoJournalState(AutoJournalState.DISARMED)
                .build();

        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(todaySessionRepository.findByIdAndUser_Id(session.getId(), user.getId())).thenReturn(Optional.of(session));
        when(todaySessionRepository.save(any(TodaySession.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(sessionAutoTradeEventRepository.save(any(SessionAutoTradeEvent.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void armFailsWhenQuotesUnavailable() {
        SessionAutoJournalArmRequest request = new SessionAutoJournalArmRequest();
        request.setSymbol("OANDA:EURUSD");
        request.setSide(Direction.LONG);
        request.setEntry(BigDecimal.valueOf(1.0825));
        request.setSl(BigDecimal.valueOf(1.0810));
        request.setTp(BigDecimal.valueOf(1.0850));
        request.setTimeoutMin(30);
        request.setTolerancePips(BigDecimal.ZERO);

        when(quoteService.getLiveQuoteForUser(user.getId(), "OANDA:EURUSD"))
                .thenReturn(LiveQuoteResponse.builder()
                        .symbol("OANDA:EURUSD")
                        .source("OANDA")
                        .available(false)
                        .reason(QuoteAvailabilityReason.SYMBOL_NOT_SUPPORTED)
                        .build());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.arm(session.getId(), request));
        assertThat(ex.getMessage()).contains("Auto journal needs bid/ask quotes");
    }

    @Test
    void monitorTransitionsArmedToActiveToClosedAndLogsEvents() {
        SessionAutoJournalArmRequest request = new SessionAutoJournalArmRequest();
        request.setSymbol("OANDA:EURUSD");
        request.setSide(Direction.LONG);
        request.setEntry(BigDecimal.valueOf(1.0825));
        request.setSl(BigDecimal.valueOf(1.0810));
        request.setTp(BigDecimal.valueOf(1.0850));
        request.setTimeoutMin(30);
        request.setTolerancePips(BigDecimal.ZERO);

        when(quoteService.getLiveQuoteForUser(user.getId(), "OANDA:EURUSD"))
                .thenReturn(
                        LiveQuoteResponse.builder()
                                .symbol("OANDA:EURUSD")
                                .source("OANDA")
                                .available(true)
                                .bid(BigDecimal.valueOf(1.08240))
                                .ask(BigDecimal.valueOf(1.08252))
                                .spread(BigDecimal.valueOf(0.00012))
                                .tsUtc(OffsetDateTime.now(ZoneOffset.UTC))
                                .build(),
                        LiveQuoteResponse.builder()
                                .symbol("OANDA:EURUSD")
                                .source("OANDA")
                                .available(true)
                                .bid(BigDecimal.valueOf(1.08260))
                                .ask(BigDecimal.valueOf(1.08280))
                                .spread(BigDecimal.valueOf(0.00020))
                                .tsUtc(OffsetDateTime.now(ZoneOffset.UTC))
                                .build(),
                        LiveQuoteResponse.builder()
                                .symbol("OANDA:EURUSD")
                                .source("OANDA")
                                .available(true)
                                .bid(BigDecimal.valueOf(1.08510))
                                .ask(BigDecimal.valueOf(1.08530))
                                .spread(BigDecimal.valueOf(0.00020))
                                .tsUtc(OffsetDateTime.now(ZoneOffset.UTC))
                                .build()
                );

        service.arm(session.getId(), request);
        when(todaySessionRepository.findByAutoJournalStateIn(List.of(AutoJournalState.ARMED, AutoJournalState.ACTIVE)))
                .thenReturn(List.of(session));

        service.monitorArmedSessions();
        assertThat(session.getAutoJournalState()).isEqualTo(AutoJournalState.ACTIVE);

        service.monitorArmedSessions();
        assertThat(session.getAutoJournalState()).isEqualTo(AutoJournalState.CLOSED);

        ArgumentCaptor<SessionAutoTradeEvent> captor = ArgumentCaptor.forClass(SessionAutoTradeEvent.class);
        org.mockito.Mockito.verify(sessionAutoTradeEventRepository, org.mockito.Mockito.atLeast(3)).save(captor.capture());
        assertThat(captor.getAllValues())
                .extracting(event -> event.getEventType().name())
                .contains("ARMED", "ENTRY_FILLED", "TP_HIT");
    }

    @Test
    void monitorDisarmsOnTimeoutAndLogsTimeoutEvent() {
        session.setAutoJournalState(AutoJournalState.ARMED);
        session.setAutoJournalSymbol("OANDA:EURUSD");
        session.setAutoJournalSide(Direction.LONG);
        session.setAutoJournalEntryPrice(BigDecimal.valueOf(1.0825));
        session.setAutoJournalSlPrice(BigDecimal.valueOf(1.0810));
        session.setAutoJournalTpPrice(BigDecimal.valueOf(1.0850));
        session.setAutoJournalTolerancePips(BigDecimal.ZERO);
        session.setAutoJournalTimeoutMin(1);
        session.setAutoJournalArmedAt(OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(5));

        when(todaySessionRepository.findByAutoJournalStateIn(List.of(AutoJournalState.ARMED, AutoJournalState.ACTIVE)))
                .thenReturn(List.of(session));
        when(quoteService.getLiveQuoteForUser(user.getId(), "OANDA:EURUSD"))
                .thenReturn(LiveQuoteResponse.builder()
                        .symbol("OANDA:EURUSD")
                        .source("OANDA")
                        .available(true)
                        .bid(BigDecimal.valueOf(1.0824))
                        .ask(BigDecimal.valueOf(1.0825))
                        .spread(BigDecimal.valueOf(0.0001))
                        .tsUtc(OffsetDateTime.now(ZoneOffset.UTC))
                        .build());

        service.monitorArmedSessions();

        assertThat(session.getAutoJournalState()).isEqualTo(AutoJournalState.DISARMED);
        ArgumentCaptor<SessionAutoTradeEvent> captor = ArgumentCaptor.forClass(SessionAutoTradeEvent.class);
        org.mockito.Mockito.verify(sessionAutoTradeEventRepository, org.mockito.Mockito.atLeast(1)).save(captor.capture());
        assertThat(captor.getAllValues())
                .extracting(event -> event.getEventType())
                .contains(AutoTradeEventType.TIMEOUT);
    }
}
