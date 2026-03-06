package com.tradevault.service.today;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.ContextSnapshot;
import com.tradevault.domain.entity.SessionNarrative;
import com.tradevault.domain.entity.SessionSetup;
import com.tradevault.domain.entity.TodaySession;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.ContextSnapshotMode;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.SessionSetupStatus;
import com.tradevault.domain.enums.TodaySessionStatus;
import com.tradevault.domain.enums.TradeGrade;
import com.tradevault.domain.enums.TradeSession;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.trade.TradeRequest;
import com.tradevault.dto.trade.TradeResponse;
import com.tradevault.repository.SessionLevelRepository;
import com.tradevault.repository.SessionNarrativeRepository;
import com.tradevault.repository.SessionSetupRepository;
import com.tradevault.repository.TodaySessionRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.service.ContextSnapshotService;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.TradeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SessionWorkspaceServiceTest {
    private TodaySessionRepository todaySessionRepository;
    private SessionSetupRepository sessionSetupRepository;
    private SessionNarrativeRepository sessionNarrativeRepository;
    private SessionLevelRepository sessionLevelRepository;
    private TradeRepository tradeRepository;
    private CurrentUserService currentUserService;
    private TradeService tradeService;
    private ContextSnapshotService contextSnapshotService;
    private SessionWorkspaceService sessionWorkspaceService;
    private ObjectMapper objectMapper;

    private User user;
    private TodaySession session;
    private List<SessionSetup> setups;

    @BeforeEach
    void setup() {
        todaySessionRepository = mock(TodaySessionRepository.class);
        sessionSetupRepository = mock(SessionSetupRepository.class);
        sessionNarrativeRepository = mock(SessionNarrativeRepository.class);
        sessionLevelRepository = mock(SessionLevelRepository.class);
        tradeRepository = mock(TradeRepository.class);
        currentUserService = mock(CurrentUserService.class);
        tradeService = mock(TradeService.class);
        contextSnapshotService = mock(ContextSnapshotService.class);
        objectMapper = new ObjectMapper();

        sessionWorkspaceService = new SessionWorkspaceService(
                todaySessionRepository,
                sessionSetupRepository,
                sessionNarrativeRepository,
                sessionLevelRepository,
                tradeRepository,
                currentUserService,
                tradeService,
                contextSnapshotService,
                objectMapper
        );

        user = User.builder()
                .id(UUID.randomUUID())
                .email("workspace@test.com")
                .timezone("Europe/Bucharest")
                .baseCurrency("USD")
                .build();
        when(currentUserService.getCurrentUser()).thenReturn(user);

        session = TodaySession.builder()
                .id(UUID.randomUUID())
                .user(user)
                .sessionDate(LocalDate.of(2026, 3, 6))
                .profitTarget(BigDecimal.ZERO)
                .lossLimit(new BigDecimal("150"))
                .maxTrades(2)
                .status(TodaySessionStatus.ACTIVE)
                .lockInSession("LONDON")
                .lockInObjective("A_PLUS_ONLY")
                .lockInBias("LONG")
                .lockInBiasReason("PDH draw intact")
                .build();

        setups = new ArrayList<>();

        when(todaySessionRepository.findByUser_IdAndSessionDate(eq(user.getId()), any(LocalDate.class)))
                .thenReturn(Optional.of(session));
        when(todaySessionRepository.findByIdAndUser_Id(session.getId(), user.getId()))
                .thenReturn(Optional.of(session));
        when(todaySessionRepository.save(any(TodaySession.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(sessionSetupRepository.save(any(SessionSetup.class))).thenAnswer(invocation -> {
            SessionSetup saved = invocation.getArgument(0);
            if (saved.getId() == null) {
                saved.setId(UUID.randomUUID());
            }
            setups.removeIf(existing -> existing.getId().equals(saved.getId()));
            setups.add(saved);
            return saved;
        });
        when(sessionSetupRepository.findByTodaySession_IdAndUser_IdOrderBySortOrderAscCreatedAtAsc(session.getId(), user.getId()))
                .thenAnswer(invocation -> new ArrayList<>(setups));
        when(sessionSetupRepository.existsByTodaySession_Id(session.getId()))
                .thenAnswer(invocation -> !setups.isEmpty());
        when(sessionNarrativeRepository.findBySessionIdAndUser_Id(session.getId(), user.getId()))
                .thenReturn(Optional.of(SessionNarrative.builder()
                        .sessionId(session.getId())
                        .todaySession(session)
                        .user(user)
                        .notes("Wait for the London reclaim.")
                        .build()));
        when(sessionLevelRepository.findByTodaySession_IdAndUser_IdOrderByCreatedAtAsc(session.getId(), user.getId()))
                .thenReturn(List.of());
        when(tradeRepository.findByUserIdAndSessionIdOrderByOpenedAtDescCreatedAtDesc(user.getId(), session.getId()))
                .thenReturn(List.of());
        when(tradeRepository.findFirstByUser_IdAndSessionIdAndStatusOrderByOpenedAtDescCreatedAtDesc(
                user.getId(), session.getId(), TradeStatus.OPEN))
                .thenReturn(Optional.empty());
        when(tradeRepository.sumNetPnlByUserAndSessionAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED))
                .thenReturn(BigDecimal.ZERO);
    }

    @Test
    void getWorkspaceBackfillsLegacySessionIntoSingleSetup() {
        session.setPlannedTickersJson("[\"EURUSD\"]");

        var response = sessionWorkspaceService.getWorkspace();

        assertThat(response.getSetups()).hasSize(1);
        assertThat(response.getSetups().get(0).getSymbol()).isEqualTo("EURUSD");
        assertThat(response.getActiveSetupId()).isEqualTo(response.getSetups().get(0).getId());
    }

    @Test
    void startTradeLinksTradeBackToSetup() throws Exception {
        session.setLockInAt(OffsetDateTime.parse("2026-03-06T07:05:00Z"));

        SessionSetup setup = SessionSetup.builder()
                .id(UUID.randomUUID())
                .todaySession(session)
                .user(user)
                .symbol("EURUSD")
                .direction(Direction.LONG)
                .market(Market.FOREX)
                .tradeSession(TradeSession.LONDON)
                .setupTitle("London reclaim")
                .strategyLabel("London sweep")
                .contextSnapshotJson(objectMapper.readTree("""
                        {
                          "liquidityNotes": "PDH sweep",
                          "invalidationIdea": "Accepts below PDH"
                        }
                        """))
                .triggerSnapshotJson(objectMapper.readTree("""
                        {
                          "sweepIdentified": true,
                          "displacementConfirmed": true,
                          "structureConfirmed": true,
                          "confirmationModel": "M5 displacement",
                          "entryZone": "M1 FVG",
                          "rrEstimate": 2.1
                        }
                        """))
                .executionSnapshotJson(objectMapper.readTree("""
                        {
                          "entryPrice": 1.0812,
                          "stopLossPrice": 1.0798,
                          "takeProfitPrice": 1.0844,
                          "riskAmount": 75,
                          "invalidation": "Close below reclaim",
                          "initialNotes": "Execute the reclaim only."
                        }
                        """))
                .status(SessionSetupStatus.READY)
                .build();
        setups.add(setup);

        when(sessionSetupRepository.findByIdAndTodaySession_IdAndUser_Id(setup.getId(), session.getId(), user.getId()))
                .thenReturn(Optional.of(setup));
        when(contextSnapshotService.createSnapshot(
                eq(user),
                eq(ContextSnapshotMode.LIVE),
                eq(null),
                eq(null),
                any(),
                eq(null),
                any(),
                eq(null),
                any(),
                any(),
                any(BigDecimal.class),
                any()
        )).thenReturn(ContextSnapshot.builder().id(UUID.randomUUID()).strategyVersionId(UUID.randomUUID()).build());
        when(tradeService.create(any(TradeRequest.class))).thenReturn(TradeResponse.builder()
                .id(UUID.randomUUID())
                .symbol("EURUSD")
                .direction(Direction.LONG)
                .session(TradeSession.LONDON)
                .sessionId(session.getId())
                .setupId(setup.getId())
                .setupGrade(TradeGrade.A)
                .status(TradeStatus.OPEN)
                .openedAt(OffsetDateTime.parse("2026-03-06T07:15:00Z"))
                .build());

        sessionWorkspaceService.startTrade(session.getId(), setup.getId());

        ArgumentCaptor<TradeRequest> requestCaptor = ArgumentCaptor.forClass(TradeRequest.class);
        verify(tradeService).create(requestCaptor.capture());
        TradeRequest tradeRequest = requestCaptor.getValue();

        assertThat(tradeRequest.getSessionId()).isEqualTo(session.getId());
        assertThat(tradeRequest.getSetupId()).isEqualTo(setup.getId());
        assertThat(tradeRequest.getSymbol()).isEqualTo("EURUSD");
        assertThat(tradeRequest.getSetup()).isEqualTo("London reclaim");
        assertThat(tradeRequest.getInitialNotes()).isEqualTo("Execute the reclaim only.");
        assertThat(setup.getLinkedTradeId()).isNotNull();
        assertThat(setup.getStatus()).isEqualTo(SessionSetupStatus.EXECUTED);
    }
}
