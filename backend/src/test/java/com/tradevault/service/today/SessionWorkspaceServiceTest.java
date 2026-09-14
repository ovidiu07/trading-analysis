package com.tradevault.service.today;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.ContextSnapshot;
import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.NotebookFolder;
import com.tradevault.domain.entity.NotebookNote;
import com.tradevault.domain.entity.Plan;
import com.tradevault.domain.entity.SessionNarrative;
import com.tradevault.domain.entity.SessionSetup;
import com.tradevault.domain.entity.TodaySession;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.ContextSnapshotMode;
import com.tradevault.domain.enums.AccountStatus;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.NotebookNoteType;
import com.tradevault.domain.enums.PlanScope;
import com.tradevault.domain.enums.PlanSource;
import com.tradevault.domain.enums.SessionSetupStatus;
import com.tradevault.domain.enums.TodaySessionStatus;
import com.tradevault.domain.enums.TradeGrade;
import com.tradevault.domain.enums.TradeSession;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.session.UpsertSessionSetupRequest;
import com.tradevault.dto.session.UpdateSessionWorkspaceRequest;
import com.tradevault.dto.session.UpsertSessionPlanRequest;
import com.tradevault.dto.trade.TradeRequest;
import com.tradevault.dto.trade.TradeResponse;
import com.tradevault.repository.SessionLevelRepository;
import com.tradevault.repository.AccountRepository;
import com.tradevault.repository.SessionNarrativeRepository;
import com.tradevault.repository.SessionSetupRepository;
import com.tradevault.repository.TodaySessionRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.repository.NotebookFolderRepository;
import com.tradevault.repository.NotebookNoteRepository;
import com.tradevault.repository.PlanRepository;
import com.tradevault.repository.PlanAssetRepository;
import com.tradevault.service.AssetService;
import com.tradevault.service.ContextSnapshotService;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.TimezoneService;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SessionWorkspaceServiceTest {
    private TodaySessionRepository todaySessionRepository;
    private SessionSetupRepository sessionSetupRepository;
    private AccountRepository accountRepository;
    private SessionNarrativeRepository sessionNarrativeRepository;
    private SessionLevelRepository sessionLevelRepository;
    private TradeRepository tradeRepository;
    private PlanRepository planRepository;
    private PlanAssetRepository planAssetRepository;
    private NotebookNoteRepository notebookNoteRepository;
    private NotebookFolderRepository notebookFolderRepository;
    private CurrentUserService currentUserService;
    private TimezoneService timezoneService;
    private TradeService tradeService;
    private ContextSnapshotService contextSnapshotService;
    private AssetService assetService;
    private SessionWorkspaceService sessionWorkspaceService;
    private ObjectMapper objectMapper;

    private User user;
    private Account account;
    private TodaySession session;
    private List<SessionSetup> setups;

    @BeforeEach
    void setup() {
        todaySessionRepository = mock(TodaySessionRepository.class);
        sessionSetupRepository = mock(SessionSetupRepository.class);
        accountRepository = mock(AccountRepository.class);
        sessionNarrativeRepository = mock(SessionNarrativeRepository.class);
        sessionLevelRepository = mock(SessionLevelRepository.class);
        tradeRepository = mock(TradeRepository.class);
        planRepository = mock(PlanRepository.class);
        planAssetRepository = mock(PlanAssetRepository.class);
        notebookNoteRepository = mock(NotebookNoteRepository.class);
        notebookFolderRepository = mock(NotebookFolderRepository.class);
        currentUserService = mock(CurrentUserService.class);
        timezoneService = mock(TimezoneService.class);
        tradeService = mock(TradeService.class);
        contextSnapshotService = mock(ContextSnapshotService.class);
        assetService = mock(AssetService.class);
        objectMapper = new ObjectMapper().findAndRegisterModules();

        sessionWorkspaceService = new SessionWorkspaceService(
                todaySessionRepository,
                sessionSetupRepository,
                accountRepository,
                sessionNarrativeRepository,
                sessionLevelRepository,
                tradeRepository,
                planRepository,
                planAssetRepository,
                notebookNoteRepository,
                notebookFolderRepository,
                currentUserService,
                timezoneService,
                tradeService,
                contextSnapshotService,
                assetService,
                objectMapper
        );

        user = User.builder()
                .id(UUID.randomUUID())
                .email("workspace@test.com")
                .timezone("Europe/Bucharest")
                .baseCurrency("USD")
                .build();
        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(timezoneService.resolveZone(null, user)).thenReturn(java.time.ZoneId.of("Europe/Bucharest"));

        account = Account.builder()
                .id(UUID.randomUUID())
                .user(user)
                .name("Primary")
                .accountCurrency("USD")
                .status(AccountStatus.ACTIVE)
                .build();
        when(accountRepository.findByIdAndUserId(account.getId(), user.getId()))
                .thenReturn(Optional.of(account));

        session = TodaySession.builder()
                .id(UUID.randomUUID())
                .user(user)
                .sessionDate(LocalDate.of(2026, 3, 6))
                .profitTarget(new BigDecimal("300"))
                .lossLimit(new BigDecimal("150"))
                .riskPerTrade(new BigDecimal("75"))
                .maxTrades(2)
                .maxConsecutiveLosses(2)
                .stopAfterTargetReached(false)
                .stopAfterMaxLossReached(true)
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
        when(todaySessionRepository.save(any(TodaySession.class))).thenAnswer(invocation -> {
            TodaySession saved = invocation.getArgument(0);
            if (saved.getId() == null) {
                saved.setId(UUID.randomUUID());
            }
            return saved;
        });
        when(sessionSetupRepository.save(any(SessionSetup.class))).thenAnswer(invocation -> {
            SessionSetup saved = invocation.getArgument(0);
            if (saved.getId() == null) {
                saved.setId(UUID.randomUUID());
            }
            setups.removeIf(existing -> existing.getId().equals(saved.getId()));
            setups.add(saved);
            return saved;
        });
        when(sessionSetupRepository.findByTodaySession_IdAndUser_IdOrderBySortOrderAscCreatedAtAsc(any(UUID.class), eq(user.getId())))
                .thenAnswer(invocation -> session.getId().equals(invocation.getArgument(0)) ? new ArrayList<>(setups) : List.of());
        when(sessionSetupRepository.existsByTodaySession_Id(any(UUID.class)))
                .thenAnswer(invocation -> session.getId().equals(invocation.getArgument(0)) && !setups.isEmpty());
        when(sessionNarrativeRepository.findBySessionIdAndUser_Id(any(UUID.class), eq(user.getId())))
                .thenReturn(Optional.empty());
        when(sessionNarrativeRepository.findBySessionIdAndUser_Id(session.getId(), user.getId()))
                .thenReturn(Optional.of(SessionNarrative.builder()
                        .sessionId(session.getId())
                        .todaySession(session)
                        .user(user)
                        .notes("Wait for the London reclaim.")
                        .build()));
        when(sessionLevelRepository.findByTodaySession_IdAndUser_IdOrderByCreatedAtAsc(session.getId(), user.getId()))
                .thenReturn(List.of());
        when(tradeRepository.findByUserIdAndSessionIdOrderByOpenedAtDescCreatedAtDesc(eq(user.getId()), any(UUID.class)))
                .thenReturn(List.of());
        when(tradeRepository.findFirstByUser_IdAndSessionIdAndStatusOrderByOpenedAtDescCreatedAtDesc(
                user.getId(), session.getId(), TradeStatus.OPEN))
                .thenReturn(Optional.empty());
        when(tradeRepository.sumNetPnlByUserAndSessionAndStatus(user.getId(), session.getId(), TradeStatus.CLOSED))
                .thenReturn(BigDecimal.ZERO);
        when(planRepository.findUserActiveByWindow(any(), any(), eq(user.getId()), any(), any()))
                .thenReturn(List.of());
        when(planAssetRepository.findByTodaySession_IdOrderBySortOrderAscCreatedAtAsc(any(UUID.class)))
                .thenReturn(List.of());
        when(notebookNoteRepository.findFirstByUserIdAndRelatedSession_IdAndRelatedSetup_IdAndTypeAndIsDeletedFalseOrderByUpdatedAtDescCreatedAtDesc(
                eq(user.getId()), any(UUID.class), any(UUID.class), eq(NotebookNoteType.SESSION_RECAP)))
                .thenReturn(Optional.empty());
        when(notebookFolderRepository.findByUserIdAndSystemKey(eq(user.getId()), any()))
                .thenReturn(Optional.of(NotebookFolder.builder()
                        .id(UUID.randomUUID())
                        .user(user)
                        .name("Sessions recap")
                        .systemKey("SESSIONS_RECAP")
                        .sortOrder(4)
                        .build()));
        when(notebookNoteRepository.save(any(NotebookNote.class))).thenAnswer(invocation -> {
            NotebookNote saved = invocation.getArgument(0);
            if (saved.getId() == null) {
                saved.setId(UUID.randomUUID());
            }
            return saved;
        });
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
    void createSetupDefaultsToUndecidedDirectionAndKeepsSetupEditable() {
        UpsertSessionSetupRequest request = new UpsertSessionSetupRequest();
        request.setSymbol("EURUSD");
        request.setSetupTitle("London context build");

        var response = sessionWorkspaceService.createSetup(session.getId(), request);

        assertThat(response.getSetups()).hasSize(1);
        assertThat(response.getSetups().get(0).getDirection()).isEqualTo(Direction.UNDECIDED);
        assertThat(response.getSetups().get(0).getReadiness().getBlockers()).contains("direction");
        assertThat(setups).singleElement().satisfies(saved -> assertThat(saved.getDirection()).isEqualTo(Direction.UNDECIDED));
    }

    @Test
    void workspaceReturnsActiveWeeklyAndMonthlyPlansForUser() {
        session.setPlannedTickersJson("[\"EURUSD\"]");
        Plan weekly = Plan.builder()
                .id(UUID.randomUUID())
                .scope(PlanScope.WEEKLY)
                .source(PlanSource.USER)
                .authorUserId(user.getId())
                .title("Weekly prep")
                .content("""
                        {"title":"Weekly prep","bias":"Long EUR","focusSymbols":["EURUSD"],"objectives":"Only A+ London trades","maxLoss":300}
                        """)
                .activeFrom(OffsetDateTime.parse("2026-03-02T00:00:00+02:00"))
                .activeTo(OffsetDateTime.parse("2026-03-08T23:59:59+02:00"))
                .createdAt(OffsetDateTime.parse("2026-03-02T06:00:00Z"))
                .updatedAt(OffsetDateTime.parse("2026-03-02T06:00:00Z"))
                .build();
        Plan monthly = Plan.builder()
                .id(UUID.randomUUID())
                .scope(PlanScope.MONTHLY)
                .source(PlanSource.USER)
                .authorUserId(user.getId())
                .title("March context")
                .content("""
                        {"title":"March context","bias":"Risk-on dollar weakness","focusSymbols":["EURUSD","GBPUSD"],"objectives":"Protect consistency","target":900}
                        """)
                .activeFrom(OffsetDateTime.parse("2026-03-01T00:00:00+02:00"))
                .activeTo(OffsetDateTime.parse("2026-03-31T23:59:59+03:00"))
                .createdAt(OffsetDateTime.parse("2026-03-01T06:00:00Z"))
                .updatedAt(OffsetDateTime.parse("2026-03-01T06:00:00Z"))
                .build();
        when(planRepository.findUserActiveByWindow(eq(PlanSource.USER), eq(PlanScope.WEEKLY), eq(user.getId()), any(), any()))
                .thenReturn(List.of(weekly));
        when(planRepository.findUserActiveByWindow(eq(PlanSource.USER), eq(PlanScope.MONTHLY), eq(user.getId()), any(), any()))
                .thenReturn(List.of(monthly));

        var response = sessionWorkspaceService.getWorkspace();

        assertThat(response.getPlanningContext().getWeekly().getTitle()).isEqualTo("Weekly prep");
        assertThat(response.getPlanningContext().getWeekly().getFocusSymbols()).containsExactly("EURUSD");
        assertThat(response.getPlanningContext().getMonthly().getTitle()).isEqualTo("March context");
        assertThat(response.getPlanningContext().getMonthly().getFocusSymbols()).containsExactly("EURUSD", "GBPUSD");
        assertThat(response.getPlanningContext().getToday().getExists()).isTrue();
    }

    @Test
    void removeTodayPlanSoftRemovesPlanAndHidesActivePlanningData() throws Exception {
        SessionSetup setup = lockableSetup(true);
        setups.add(setup);
        session.setActiveSetupId(setup.getId());
        when(todaySessionRepository.findByIdAndUser_Id(session.getId(), user.getId()))
                .thenReturn(Optional.of(session));

        var response = sessionWorkspaceService.removePlan(PlanScope.DAILY, session.getId());

        assertThat(session.getPlanRemovedAt()).isNotNull();
        assertThat(session.getPlanRemovedByUserId()).isEqualTo(user.getId());
        assertThat(session.getActiveSetupId()).isNull();
        assertThat(response.getPlanningContext().getToday().getExists()).isFalse();
        assertThat(response.getPlanningContext().getToday().getImages()).isEmpty();
        assertThat(response.getSetups()).isEmpty();
        assertThat(response.getActiveSetupId()).isNull();
    }

    @Test
    void upsertDailyPlanCreatesTodayPlanWhenNoSessionExistsForUserDate() {
        when(todaySessionRepository.findByUser_IdAndSessionDate(eq(user.getId()), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        var response = sessionWorkspaceService.upsertPeriodPlan(PlanScope.DAILY, new UpsertSessionPlanRequest());

        assertThat(response.getPlanningContext().getToday().getExists()).isTrue();
        assertThat(response.getPlanningContext().getToday().getScope()).isEqualTo(PlanScope.DAILY);
        assertThat(response.getPlanningContext().getToday().getId()).isNotNull();
        assertThat(response.getSetups()).isEmpty();
    }

    @Test
    void upsertDailyPlanRestoresRemovedTodayPlanAndActiveSetups() throws Exception {
        SessionSetup setup = lockableSetup(true);
        setups.add(setup);
        session.setPlanRemovedAt(OffsetDateTime.parse("2026-03-06T08:00:00Z"));
        session.setPlanRemovedByUserId(user.getId());
        session.setActiveSetupId(null);

        var response = sessionWorkspaceService.upsertPeriodPlan(PlanScope.DAILY, new UpsertSessionPlanRequest());

        assertThat(session.getPlanRemovedAt()).isNull();
        assertThat(session.getPlanRemovedByUserId()).isNull();
        assertThat(session.getStatus()).isEqualTo(TodaySessionStatus.ACTIVE);
        assertThat(response.getPlanningContext().getToday().getExists()).isTrue();
        assertThat(response.getSetups()).singleElement().satisfies(item -> assertThat(item.getSetupTitle()).isEqualTo("London reclaim"));
        assertThat(response.getActiveSetupId()).isEqualTo(setup.getId());
    }

    @Test
    void removeWeeklyPlanSoftRemovesOwnedPlanAndReturnsWorkspaceWithoutPinnedWeeklyPlan() {
        Plan weekly = Plan.builder()
                .id(UUID.randomUUID())
                .scope(PlanScope.WEEKLY)
                .source(PlanSource.USER)
                .authorUserId(user.getId())
                .title("Weekly prep")
                .content("{\"title\":\"Weekly prep\"}")
                .activeFrom(OffsetDateTime.parse("2026-03-02T00:00:00+02:00"))
                .activeTo(OffsetDateTime.parse("2026-03-08T23:59:59+02:00"))
                .createdAt(OffsetDateTime.parse("2026-03-02T06:00:00Z"))
                .updatedAt(OffsetDateTime.parse("2026-03-02T06:00:00Z"))
                .build();
        when(planRepository.findByIdAndSourceAndAuthorUserId(weekly.getId(), PlanSource.USER, user.getId()))
                .thenReturn(Optional.of(weekly));
        when(planRepository.save(any(Plan.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = sessionWorkspaceService.removePlan(PlanScope.WEEKLY, weekly.getId());

        assertThat(weekly.getRemovedAt()).isNotNull();
        assertThat(weekly.getRemovedByUserId()).isEqualTo(user.getId());
        assertThat(response.getPlanningContext().getWeekly().getExists()).isFalse();
        assertThat(response.getPlanningContext().getWeekly().getImages()).isEmpty();
    }

    @Test
    void lockDeniedWhenRequiredConfluencesAreMissing() throws Exception {
        SessionSetup setup = lockableSetup(false);
        setups.add(setup);
        session.setActiveSetupId(setup.getId());
        when(sessionSetupRepository.findByIdAndTodaySession_IdAndUser_Id(setup.getId(), session.getId(), user.getId()))
                .thenReturn(Optional.of(setup));

        UpdateSessionWorkspaceRequest request = new UpdateSessionWorkspaceRequest();
        request.setLockSession(true);

        assertThatThrownBy(() -> sessionWorkspaceService.updateSession(session.getId(), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Sweep confirmed");
    }

    @Test
    void lockAllowedWhenRiskAndRequiredConfluencesAreComplete() throws Exception {
        SessionSetup setup = lockableSetup(true);
        setups.add(setup);
        session.setActiveSetupId(setup.getId());
        when(sessionSetupRepository.findByIdAndTodaySession_IdAndUser_Id(setup.getId(), session.getId(), user.getId()))
                .thenReturn(Optional.of(setup));

        UpdateSessionWorkspaceRequest request = new UpdateSessionWorkspaceRequest();
        request.setLockSession(true);

        var response = sessionWorkspaceService.updateSession(session.getId(), request);

        assertThat(response.getSession().getLockedInAt()).isNotNull();
        assertThat(response.getSession().getReadiness().getBlockers()).isEmpty();
    }

    @Test
    void startTradeLinksTradeBackToSetup() throws Exception {
        session.setLockInAt(OffsetDateTime.parse("2026-03-06T07:05:00Z"));

        SessionSetup setup = SessionSetup.builder()
                .id(UUID.randomUUID())
                .todaySession(session)
                .user(user)
                .account(account)
                .symbol("ESZ6")
                .direction(Direction.LONG)
                .market(Market.FUTURES)
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
                          "activeExecutionId": "exec-1",
                          "tickets": [{
                            "id": "exec-1",
                            "label": "Prepared execution",
                            "status": "DRAFT",
                            "entryPrice": 6000,
                            "stopLossPrice": 5995,
                            "takeProfitPrice": 6010,
                            "riskAmount": 250,
                            "quantity": 1,
                            "contractMultiplier": 50,
                            "tradeCurrency": "USD",
                            "profileCurrency": "USD",
                            "fxRateTradeToProfile": 1,
                            "fxRateSource": "IDENTITY",
                            "invalidation": "Close below reclaim",
                            "initialNotes": "Execute the reclaim only."
                          }]
                        }
                        """))
                .confluencesJson(objectMapper.readTree("""
                        [
                          { "id": "c1", "label": "Sweep confirmed", "checked": true, "required": true, "source": "CUSTOM" },
                          { "id": "c2", "label": "Risk configured", "checked": false, "required": true, "source": "DEFAULT" }
                        ]
                        """))
                .manualSetupMode(true)
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
                .symbol("ESZ6")
                .direction(Direction.LONG)
                .session(TradeSession.LONDON)
                .sessionId(session.getId())
                .setupId(setup.getId())
                .setupGrade(TradeGrade.A)
                .status(TradeStatus.OPEN)
                .openedAt(OffsetDateTime.parse("2026-03-06T07:15:00Z"))
                .build());

        sessionWorkspaceService.startTrade(session.getId(), setup.getId(), null);

        ArgumentCaptor<TradeRequest> requestCaptor = ArgumentCaptor.forClass(TradeRequest.class);
        verify(tradeService).create(requestCaptor.capture());
        TradeRequest tradeRequest = requestCaptor.getValue();

        assertThat(tradeRequest.getSessionId()).isEqualTo(session.getId());
        assertThat(tradeRequest.getSetupId()).isEqualTo(setup.getId());
        assertThat(tradeRequest.getAccountRefId()).isEqualTo(account.getId());
        assertThat(tradeRequest.getSymbol()).isEqualTo("ESZ6");
        assertThat(tradeRequest.getSetup()).isEqualTo("London reclaim");
        assertThat(tradeRequest.getInitialNotes()).isEqualTo("Execute the reclaim only.");
        assertThat(tradeRequest.getQuantity()).isEqualByComparingTo("1");
        assertThat(tradeRequest.getContractMultiplier()).isEqualByComparingTo("50");
        assertThat(tradeRequest.getTradeCurrency()).isEqualTo("USD");
        assertThat(tradeRequest.getProfileCurrency()).isEqualTo("USD");
        assertThat(tradeRequest.getFxRateTradeToProfile()).isEqualByComparingTo("1");
        assertThat(setup.getLinkedTradeId()).isNotNull();
        assertThat(setup.getStatus()).isEqualTo(SessionSetupStatus.EXECUTED);
    }

    @Test
    void saveAnalysisNoteUpsertsSessionRecapForNonExecutedSetup() throws Exception {
        SessionSetup setup = lockableSetup(true);
        setup.setContextSnapshotJson(objectMapper.readTree("""
                {
                  "liquidityNotes": "PDH sweep",
                  "invalidationIdea": "Accepts below PDH",
                  "notes": "Waited but no entry."
                }
                """));
        setup.setTriggerSnapshotJson(objectMapper.readTree("""
                {
                  "entryZone": "M1 FVG",
                  "notes": "No displacement follow-through."
                }
                """));
        setup.setReviewSnapshotJson(objectMapper.readTree("""
                {
                  "liveNotes": "Skipped the late trigger.",
                  "timeline": [
                    { "id": "evt-1", "type": "setup_skipped", "title": "Skipped", "body": "Late entry", "occurredAt": "2026-03-06T08:30:00Z" }
                  ]
                }
                """));
        setups.add(setup);
        session.setActiveSetupId(setup.getId());
        when(sessionSetupRepository.findByIdAndTodaySession_IdAndUser_Id(setup.getId(), session.getId(), user.getId()))
                .thenReturn(Optional.of(setup));

        sessionWorkspaceService.saveAnalysisNote(session.getId(), setup.getId());

        ArgumentCaptor<NotebookNote> noteCaptor = ArgumentCaptor.forClass(NotebookNote.class);
        verify(notebookNoteRepository).save(noteCaptor.capture());
        NotebookNote note = noteCaptor.getValue();
        assertThat(note.getType()).isEqualTo(NotebookNoteType.SESSION_RECAP);
        assertThat(note.getRelatedSession()).isEqualTo(session);
        assertThat(note.getRelatedSetup()).isEqualTo(setup);
        assertThat(note.getRelatedTrade()).isNull();
        assertThat(note.getBody()).contains("Waited but no entry.", "Skipped the late trigger.");
    }

    @Test
    void startTradeIsIdempotentWhenSetupAlreadyHasLinkedTrade() throws Exception {
        session.setLockInAt(OffsetDateTime.parse("2026-03-06T07:05:00Z"));
        SessionSetup setup = lockableSetup(true);
        setup.setLinkedTradeId(UUID.randomUUID());
        setups.add(setup);
        when(sessionSetupRepository.findByIdAndTodaySession_IdAndUser_Id(setup.getId(), session.getId(), user.getId()))
                .thenReturn(Optional.of(setup));

        sessionWorkspaceService.startTrade(session.getId(), setup.getId(), null);

        verify(tradeService, never()).create(any(TradeRequest.class));
    }

    @Test
    void preparedRiskDraftCreatesOneAccountScopedSetupAndIsIdempotent() {
        UpsertSessionSetupRequest request = preparedDraftRequest("today-risk-draft-1", Direction.LONG);

        var first = sessionWorkspaceService.createSetup(session.getId(), request);
        SessionSetup saved = setups.get(0);
        when(sessionSetupRepository.findByUser_IdAndSourceDraftId(user.getId(), "today-risk-draft-1"))
                .thenReturn(Optional.of(saved));
        when(sessionSetupRepository.findByIdAndTodaySession_IdAndUser_Id(saved.getId(), session.getId(), user.getId()))
                .thenReturn(Optional.of(saved));

        var second = sessionWorkspaceService.createSetup(session.getId(), request);

        assertThat(setups).hasSize(1);
        assertThat(first.getSetups()).hasSize(1);
        assertThat(second.getSetups()).hasSize(1);
        assertThat(saved.getAccount()).isEqualTo(account);
        assertThat(saved.getSourceDraftId()).isEqualTo("today-risk-draft-1");
        assertThat(saved.getExecutionSnapshotJson().at("/tickets/0/plannedRr").decimalValue())
                .isEqualByComparingTo("2.00");
    }

    @Test
    void preparedRiskDraftRejectsAnAccountOutsideTheCurrentUser() {
        UpsertSessionSetupRequest request = preparedDraftRequest("today-risk-foreign", Direction.LONG);
        request.setAccountRefId(UUID.randomUUID());

        assertThatThrownBy(() -> sessionWorkspaceService.createSetup(session.getId(), request))
                .isInstanceOf(jakarta.persistence.EntityNotFoundException.class)
                .hasMessageContaining("Trading account not found");
    }

    @Test
    void preparedRiskDraftRejectsDirectionallyInvalidPrices() {
        UpsertSessionSetupRequest request = preparedDraftRequest("today-risk-invalid", Direction.SHORT);

        assertThatThrownBy(() -> sessionWorkspaceService.createSetup(session.getId(), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("invalid for the selected direction");
    }

    @Test
    void startTradeRejectsLegacySetupUntilAnAccountIsAssigned() throws Exception {
        SessionSetup setup = lockableSetup(true);
        setup.setAccount(null);
        setups.add(setup);
        when(sessionSetupRepository.findByIdAndTodaySession_IdAndUser_Id(setup.getId(), session.getId(), user.getId()))
                .thenReturn(Optional.of(setup));

        assertThatThrownBy(() -> sessionWorkspaceService.startTrade(session.getId(), setup.getId(), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Assign a TradeJAudit account");
        verify(tradeService, never()).create(any(TradeRequest.class));
    }

    private UpsertSessionSetupRequest preparedDraftRequest(String sourceDraftId, Direction direction) {
        UpsertSessionSetupRequest request = new UpsertSessionSetupRequest();
        request.setAccountRefId(account.getId());
        request.setSourceDraftId(sourceDraftId);
        request.setSymbol("ESZ6");
        request.setDirection(direction);
        request.setMarket(Market.FUTURES);
        request.setSetupTitle("Prepared ES risk");

        UpsertSessionSetupRequest.Ticket ticket = new UpsertSessionSetupRequest.Ticket();
        ticket.setId("risk-primary");
        ticket.setLabel("Prepared execution");
        ticket.setStatus("DRAFT");
        ticket.setEntryPrice(new BigDecimal("6000"));
        ticket.setStopLossPrice(new BigDecimal("5995"));
        ticket.setTakeProfitPrice(new BigDecimal("6010"));
        ticket.setRiskAmount(new BigDecimal("250"));
        ticket.setQuantity(BigDecimal.ONE);
        ticket.setContractMultiplier(new BigDecimal("50"));
        ticket.setTradeCurrency("USD");
        ticket.setProfileCurrency("USD");
        ticket.setFxRateTradeToProfile(BigDecimal.ONE);
        ticket.setInvalidation("Acceptance below 5995");

        UpsertSessionSetupRequest.Execution execution = new UpsertSessionSetupRequest.Execution();
        execution.setActiveExecutionId(ticket.getId());
        execution.setTickets(List.of(ticket));
        request.setExecution(execution);
        return request;
    }

    private SessionSetup lockableSetup(boolean checked) throws Exception {
        return SessionSetup.builder()
                .id(UUID.randomUUID())
                .todaySession(session)
                .user(user)
                .account(account)
                .symbol("EURUSD")
                .direction(Direction.LONG)
                .market(Market.FOREX)
                .tradeSession(TradeSession.LONDON)
                .setupTitle("London reclaim")
                .manualSetupMode(true)
                .confluencesJson(objectMapper.readTree("""
                        [
                          { "id": "c1", "label": "Sweep confirmed", "checked": %s, "required": true, "source": "CUSTOM" },
                          { "id": "c2", "label": "Risk configured", "checked": false, "required": true, "source": "DEFAULT" }
                        ]
                        """.formatted(checked)))
                .status(SessionSetupStatus.DRAFT)
                .build();
    }
}
