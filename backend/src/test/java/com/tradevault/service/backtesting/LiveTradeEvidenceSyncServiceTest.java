package com.tradevault.service.backtesting;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.BacktestEvidenceLink;
import com.tradevault.domain.entity.BacktestingWorkspace;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.entity.UserStrategy;
import com.tradevault.domain.enums.BacktestingAutoImportMode;
import com.tradevault.domain.enums.BacktestingClassificationStatus;
import com.tradevault.domain.enums.BacktestingEvidenceSource;
import com.tradevault.domain.enums.BacktestingSyncStatus;
import com.tradevault.domain.enums.BacktestingWorkspaceStatus;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeSession;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.repository.BacktestEvidenceLinkRepository;
import com.tradevault.repository.BacktestingWorkspaceRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.repository.UserStrategyRepository;
import com.tradevault.dto.backtesting.BacktestingEvidenceLinkRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LiveTradeEvidenceSyncServiceTest {
    @Mock BacktestEvidenceLinkRepository evidenceRepository;
    @Mock BacktestingWorkspaceRepository workspaceRepository;
    @Mock TradeRepository tradeRepository;
    @Mock UserStrategyRepository strategyRepository;

    private LiveTradeEvidenceSyncService service;
    private InstrumentAliasService instrumentAliasService;
    private BacktestingWorkspaceCompatibilityService compatibilityService;
    private User user;
    private UserStrategy strategy;

    @BeforeEach
    void setUp() {
        instrumentAliasService = new InstrumentAliasService();
        compatibilityService = new BacktestingWorkspaceCompatibilityService(instrumentAliasService);
        service = new LiveTradeEvidenceSyncService(
                evidenceRepository, workspaceRepository, tradeRepository, strategyRepository, new ObjectMapper(),
                instrumentAliasService, compatibilityService);
        user = User.builder().id(UUID.randomUUID()).build();
        strategy = UserStrategy.builder().id(UUID.randomUUID()).user(user).name("Liquidity Sweep").build();
        lenient().when(evidenceRepository.save(any(BacktestEvidenceLink.class))).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(strategyRepository.findByIdAndUser_Id(strategy.getId(), user.getId())).thenReturn(Optional.of(strategy));
    }

    @Test
    void exactMatchSynchronizesClosedTradeAndIncludesItInAnalytics() {
        Trade trade = closedTrade();
        BacktestingWorkspace workspace = workspace(BacktestingAutoImportMode.EXACT_MATCH, "NQ", "New York AM", "5 minutes");
        when(evidenceRepository.findByLiveTradeIdAndUser_Id(trade.getId(), user.getId())).thenReturn(Optional.empty());
        when(workspaceRepository.findByUser_IdAndStatusAndStrategy_IdOrderByUpdatedAtDesc(
                user.getId(), BacktestingWorkspaceStatus.ACTIVE, strategy.getId())).thenReturn(List.of(workspace));

        BacktestEvidenceLink link = service.synchronize(trade);

        assertThat(link.getWorkspace()).isSameAs(workspace);
        assertThat(link.getSyncStatus()).isEqualTo(BacktestingSyncStatus.SYNCED);
        assertThat(link.isIncludedInAnalytics()).isTrue();
        assertThat(link.getRealizedR()).isEqualByComparingTo("1.5");
    }

    @Test
    void daxAliasSynchronizesGer40TradeWithoutChangingItsDisplaySymbol() {
        Trade trade = closedTrade();
        trade.setSymbol("GER40.cash");
        BacktestingWorkspace workspace = workspace(BacktestingAutoImportMode.EXACT_MATCH, "DAX", "New York AM", "5 minutes");
        when(evidenceRepository.findByLiveTradeIdAndUser_Id(trade.getId(), user.getId())).thenReturn(Optional.empty());
        when(workspaceRepository.findByUser_IdAndStatusAndStrategy_IdOrderByUpdatedAtDesc(
                user.getId(), BacktestingWorkspaceStatus.ACTIVE, strategy.getId())).thenReturn(List.of(workspace));

        BacktestEvidenceLink link = service.synchronize(trade);

        assertThat(link.getWorkspace()).isSameAs(workspace);
        assertThat(link.getInstrument()).isEqualTo("GER40.cash");
        assertThat(link.isIncludedInAnalytics()).isTrue();
    }

    @Test
    void multipleAutomaticMatchesGoToReviewWithoutSilentDuplication() {
        Trade trade = closedTrade();
        BacktestingWorkspace exact = workspace(BacktestingAutoImportMode.EXACT_MATCH, "NQ", null, null);
        BacktestingWorkspace strategyOnly = workspace(BacktestingAutoImportMode.STRATEGY_MATCH, "ES", null, null);
        when(evidenceRepository.findByLiveTradeIdAndUser_Id(trade.getId(), user.getId())).thenReturn(Optional.empty());
        when(workspaceRepository.findByUser_IdAndStatusAndStrategy_IdOrderByUpdatedAtDesc(
                user.getId(), BacktestingWorkspaceStatus.ACTIVE, strategy.getId())).thenReturn(List.of(exact, strategyOnly));

        BacktestEvidenceLink link = service.synchronize(trade);

        assertThat(link.getWorkspace()).isNull();
        assertThat(link.getSyncStatus()).isEqualTo(BacktestingSyncStatus.NEEDS_REVIEW);
        assertThat(link.getExcludedReason()).isEqualTo("AMBIGUOUS_WORKSPACE_MATCH");
        assertThat(link.isIncludedInAnalytics()).isFalse();
    }

    @Test
    void synchronizingTheSameTradeUpdatesTheExistingLinkInsteadOfCreatingAnother() {
        Trade trade = closedTrade();
        BacktestingWorkspace workspace = workspace(BacktestingAutoImportMode.STRATEGY_MATCH, "NQ", null, null);
        BacktestEvidenceLink existing = BacktestEvidenceLink.builder()
                .id(UUID.randomUUID())
                .user(user)
                .liveTradeId(trade.getId())
                .syncStatus(BacktestingSyncStatus.PENDING)
                .build();
        when(evidenceRepository.findByLiveTradeIdAndUser_Id(trade.getId(), user.getId())).thenReturn(Optional.of(existing));
        when(workspaceRepository.findByUser_IdAndStatusAndStrategy_IdOrderByUpdatedAtDesc(
                user.getId(), BacktestingWorkspaceStatus.ACTIVE, strategy.getId())).thenReturn(List.of(workspace));

        BacktestEvidenceLink result = service.synchronize(trade);

        assertThat(result).isSameAs(existing);
        assertThat(result.getWorkspace()).isSameAs(workspace);
        verify(evidenceRepository).save(existing);
    }

    @Test
    void reopenedTradeKeepsItsLinkButLeavesRealizedAnalytics() {
        Trade trade = closedTrade();
        trade.setStatus(TradeStatus.OPEN);
        BacktestEvidenceLink existing = BacktestEvidenceLink.builder()
                .id(UUID.randomUUID())
                .user(user)
                .liveTradeId(trade.getId())
                .workspace(workspace(BacktestingAutoImportMode.EXACT_MATCH, "NQ", null, null))
                .syncStatus(BacktestingSyncStatus.SYNCED)
                .includedInAnalytics(true)
                .build();
        when(evidenceRepository.findByLiveTradeIdAndUser_Id(trade.getId(), user.getId())).thenReturn(Optional.of(existing));

        BacktestEvidenceLink result = service.synchronize(trade);

        assertThat(result.getWorkspace()).isNotNull();
        assertThat(result.getSyncStatus()).isEqualTo(BacktestingSyncStatus.PENDING);
        assertThat(result.isIncludedInAnalytics()).isFalse();
        verify(workspaceRepository, never()).findByUser_IdAndStatusAndStrategy_IdOrderByUpdatedAtDesc(any(), any(), any());
    }

    @Test
    void noWorkspaceMatchCreatesAnUnlinkedInboxItem() {
        Trade trade = closedTrade();
        when(evidenceRepository.findByLiveTradeIdAndUser_Id(trade.getId(), user.getId())).thenReturn(Optional.empty());
        when(workspaceRepository.findByUser_IdAndStatusAndStrategy_IdOrderByUpdatedAtDesc(
                user.getId(), BacktestingWorkspaceStatus.ACTIVE, strategy.getId())).thenReturn(List.of());

        BacktestEvidenceLink result = service.synchronize(trade);

        assertThat(result.getSyncStatus()).isEqualTo(BacktestingSyncStatus.NOT_LINKED);
        assertThat(result.getExcludedReason()).isEqualTo("NO_MATCHING_WORKSPACE");
        assertThat(result.isIncludedInAnalytics()).isFalse();
    }

    @Test
    void strategyMatchDoesNotRequireInstrumentSessionOrTimeframeEquality() {
        Trade trade = closedTrade();
        BacktestingWorkspace workspace = workspace(BacktestingAutoImportMode.STRATEGY_MATCH, "ES", "LONDON", "1h");
        when(evidenceRepository.findByLiveTradeIdAndUser_Id(trade.getId(), user.getId())).thenReturn(Optional.empty());
        when(workspaceRepository.findByUser_IdAndStatusAndStrategy_IdOrderByUpdatedAtDesc(
                user.getId(), BacktestingWorkspaceStatus.ACTIVE, strategy.getId())).thenReturn(List.of(workspace));

        BacktestEvidenceLink result = service.synchronize(trade);

        assertThat(result.getWorkspace()).isSameAs(workspace);
        assertThat(result.getSyncStatus()).isEqualTo(BacktestingSyncStatus.SYNCED);
    }

    @Test
    void reviewBeforeImportCreatesReviewItemWithoutAffectingAnalytics() {
        Trade trade = closedTrade();
        BacktestingWorkspace workspace = workspace(BacktestingAutoImportMode.REVIEW_BEFORE_IMPORT, "NQ", null, null);
        when(evidenceRepository.findByLiveTradeIdAndUser_Id(trade.getId(), user.getId())).thenReturn(Optional.empty());
        when(workspaceRepository.findByUser_IdAndStatusAndStrategy_IdOrderByUpdatedAtDesc(
                user.getId(), BacktestingWorkspaceStatus.ACTIVE, strategy.getId())).thenReturn(List.of(workspace));

        BacktestEvidenceLink result = service.synchronize(trade);

        assertThat(result.getWorkspace()).isSameAs(workspace);
        assertThat(result.getSyncStatus()).isEqualTo(BacktestingSyncStatus.NEEDS_REVIEW);
        assertThat(result.isIncludedInAnalytics()).isFalse();
    }

    @Test
    void explicitlyExcludedEvidenceStaysExcludedWhenTheLiveTradeChanges() {
        Trade trade = closedTrade();
        BacktestEvidenceLink existing = BacktestEvidenceLink.builder()
                .id(UUID.randomUUID())
                .user(user)
                .liveTradeId(trade.getId())
                .workspace(workspace(BacktestingAutoImportMode.EXACT_MATCH, "NQ", null, null))
                .syncStatus(BacktestingSyncStatus.EXCLUDED)
                .classificationStatus(BacktestingClassificationStatus.PARTIAL)
                .includedInAnalytics(false)
                .excludedReason("USER_EXCLUDED")
                .build();
        when(evidenceRepository.findByLiveTradeIdAndUser_Id(trade.getId(), user.getId())).thenReturn(Optional.of(existing));

        BacktestEvidenceLink result = service.synchronize(trade);

        assertThat(result.getSyncStatus()).isEqualTo(BacktestingSyncStatus.EXCLUDED);
        assertThat(result.getExcludedReason()).isEqualTo("USER_EXCLUDED");
        assertThat(result.isIncludedInAnalytics()).isFalse();
        verify(workspaceRepository, never()).findByUser_IdAndStatusAndStrategy_IdOrderByUpdatedAtDesc(any(), any(), any());
    }

    @Test
    void reIncludingExcludedEvidenceClearsExclusionAndReusesTheSameLink() {
        Trade trade = closedTrade();
        BacktestingWorkspace workspace = workspace(BacktestingAutoImportMode.EXACT_MATCH, "NQ", "New York AM", "5 minutes");
        BacktestEvidenceLink existing = BacktestEvidenceLink.builder()
                .id(UUID.randomUUID())
                .user(user)
                .liveTradeId(trade.getId())
                .workspace(workspace)
                .sourceType(BacktestingEvidenceSource.LIVE)
                .syncStatus(BacktestingSyncStatus.EXCLUDED)
                .classificationStatus(BacktestingClassificationStatus.PARTIAL)
                .researchClassificationJson("{\"marketRegime\":\"trend\"}")
                .screenshotCount(2)
                .includedInAnalytics(false)
                .excludedReason("USER_EXCLUDED")
                .build();
        trade.setEntryScreenshotAssetIds(Set.of(UUID.randomUUID(), UUID.randomUUID()));
        when(evidenceRepository.findByIdAndUser_Id(existing.getId(), user.getId())).thenReturn(Optional.of(existing));
        when(evidenceRepository.findByLiveTradeIdAndUser_Id(trade.getId(), user.getId())).thenReturn(Optional.of(existing));
        when(tradeRepository.findByIdAndUserId(trade.getId(), user.getId())).thenReturn(Optional.of(trade));
        when(workspaceRepository.findByUser_IdAndStatusAndStrategy_IdOrderByUpdatedAtDesc(
                user.getId(), BacktestingWorkspaceStatus.ACTIVE, strategy.getId())).thenReturn(List.of(workspace));
        when(workspaceRepository.findByUser_IdAndStatusOrderByUpdatedAtDesc(
                user.getId(), BacktestingWorkspaceStatus.ACTIVE)).thenReturn(List.of(workspace));

        var response = service.includeInResearch(existing.getId(), user.getId());

        assertThat(existing.getSyncStatus()).isEqualTo(BacktestingSyncStatus.SYNCED);
        assertThat(existing.getExcludedReason()).isNull();
        assertThat(existing.getClassificationStatus()).isEqualTo(BacktestingClassificationStatus.PARTIAL);
        assertThat(existing.getResearchClassificationJson()).isEqualTo("{\"marketRegime\":\"trend\"}");
        assertThat(existing.getScreenshotCount()).isEqualTo(2);
        assertThat(existing.isIncludedInAnalytics()).isTrue();
        assertThat(response.getId()).isEqualTo(existing.getId());
        assertThat(response.getCanonicalInstrumentId()).isNull();
    }

    @Test
    void repeatedReInclusionIsIdempotentAndDoesNotResynchronize() {
        BacktestEvidenceLink existing = BacktestEvidenceLink.builder()
                .id(UUID.randomUUID())
                .user(user)
                .liveTradeId(UUID.randomUUID())
                .sourceType(BacktestingEvidenceSource.LIVE)
                .syncStatus(BacktestingSyncStatus.SYNCED)
                .classificationStatus(BacktestingClassificationStatus.COMPLETE)
                .includedInAnalytics(true)
                .build();
        when(evidenceRepository.findByIdAndUser_Id(existing.getId(), user.getId())).thenReturn(Optional.of(existing));
        when(workspaceRepository.findByUser_IdAndStatusOrderByUpdatedAtDesc(
                user.getId(), BacktestingWorkspaceStatus.ACTIVE)).thenReturn(List.of());

        service.includeInResearch(existing.getId(), user.getId());

        verify(tradeRepository, never()).findByIdAndUserId(any(), any());
        verify(evidenceRepository, never()).save(existing);
    }

    @Test
    void manualLinkAcceptsAliasCompatibleEvidenceWithIncompleteClassificationAndIncludesItOnce() {
        BacktestingWorkspace workspace = workspace(BacktestingAutoImportMode.EXACT_MATCH, "DAX", "London", "1m");
        BacktestEvidenceLink existing = linkableEvidence("GER40", strategy.getId());
        BacktestingEvidenceLinkRequest request = new BacktestingEvidenceLinkRequest();
        request.setWorkspaceId(workspace.getId());
        when(evidenceRepository.findByIdAndUser_Id(existing.getId(), user.getId())).thenReturn(Optional.of(existing));
        when(workspaceRepository.findByIdAndUser_IdAndStatus(
                workspace.getId(), user.getId(), BacktestingWorkspaceStatus.ACTIVE)).thenReturn(Optional.of(workspace));
        when(workspaceRepository.findByUser_IdAndStatusOrderByUpdatedAtDesc(
                user.getId(), BacktestingWorkspaceStatus.ACTIVE)).thenReturn(List.of(workspace));

        var first = service.linkToWorkspace(existing.getId(), user.getId(), request);
        var second = service.linkToWorkspace(existing.getId(), user.getId(), request);

        assertThat(first.getId()).isEqualTo(existing.getId());
        assertThat(second.getId()).isEqualTo(existing.getId());
        assertThat(existing.getWorkspace()).isSameAs(workspace);
        assertThat(existing.getSyncStatus()).isEqualTo(BacktestingSyncStatus.SYNCED);
        assertThat(existing.getClassificationStatus()).isEqualTo(BacktestingClassificationStatus.NEEDS_CLASSIFICATION);
        assertThat(existing.isIncludedInAnalytics()).isTrue();
    }

    @Test
    void manualLinkRejectsStrategyMismatchWithoutChangingTheEvidence() {
        BacktestingWorkspace workspace = workspace(BacktestingAutoImportMode.EXACT_MATCH, "DAX", "London", "1m");
        BacktestEvidenceLink existing = linkableEvidence("GER40", UUID.randomUUID());
        BacktestingEvidenceLinkRequest request = new BacktestingEvidenceLinkRequest();
        request.setWorkspaceId(workspace.getId());
        when(evidenceRepository.findByIdAndUser_Id(existing.getId(), user.getId())).thenReturn(Optional.of(existing));
        when(workspaceRepository.findByIdAndUser_IdAndStatus(
                workspace.getId(), user.getId(), BacktestingWorkspaceStatus.ACTIVE)).thenReturn(Optional.of(workspace));

        assertThatThrownBy(() -> service.linkToWorkspace(existing.getId(), user.getId(), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not compatible");
        assertThat(existing.getWorkspace()).isNull();
        assertThat(existing.isIncludedInAnalytics()).isFalse();
    }

    @Test
    void disabledWorkspacePreservesPreviouslyLinkedEvidenceButStopsRematching() {
        Trade trade = closedTrade();
        BacktestingWorkspace disabled = workspace(BacktestingAutoImportMode.DISABLED, "NQ", null, null);
        BacktestEvidenceLink existing = BacktestEvidenceLink.builder()
                .id(UUID.randomUUID())
                .user(user)
                .liveTradeId(trade.getId())
                .workspace(disabled)
                .syncStatus(BacktestingSyncStatus.SYNCED)
                .includedInAnalytics(true)
                .build();
        when(evidenceRepository.findByLiveTradeIdAndUser_Id(trade.getId(), user.getId())).thenReturn(Optional.of(existing));

        BacktestEvidenceLink result = service.synchronize(trade);

        assertThat(result.getWorkspace()).isSameAs(disabled);
        assertThat(result.getSyncStatus()).isEqualTo(BacktestingSyncStatus.SYNCED);
        assertThat(result.isIncludedInAnalytics()).isTrue();
        verify(workspaceRepository, never()).findByUser_IdAndStatusAndStrategy_IdOrderByUpdatedAtDesc(any(), any(), any());
    }

    @Test
    void deletingALiveTradeArchivesItsEvidenceSnapshot() {
        UUID tradeId = UUID.randomUUID();
        BacktestEvidenceLink existing = BacktestEvidenceLink.builder()
                .id(UUID.randomUUID())
                .user(user)
                .liveTradeId(tradeId)
                .syncStatus(BacktestingSyncStatus.SYNCED)
                .includedInAnalytics(true)
                .build();
        when(evidenceRepository.findByLiveTradeIdAndUser_Id(tradeId, user.getId())).thenReturn(Optional.of(existing));

        service.markDeleted(tradeId, user.getId());

        assertThat(existing.getSyncStatus()).isEqualTo(BacktestingSyncStatus.EXCLUDED);
        assertThat(existing.getExcludedReason()).isEqualTo("LIVE_TRADE_DELETED");
        assertThat(existing.isIncludedInAnalytics()).isFalse();
        verify(evidenceRepository).save(existing);
    }

    private Trade closedTrade() {
        return Trade.builder()
                .id(UUID.randomUUID())
                .user(user)
                .symbol("NQ")
                .direction(Direction.LONG)
                .status(TradeStatus.CLOSED)
                .openedAt(OffsetDateTime.parse("2026-07-18T09:30:00+03:00"))
                .closedAt(OffsetDateTime.parse("2026-07-18T10:00:00+03:00"))
                .timeframe("5m")
                .strategyId(strategy.getId())
                .session(TradeSession.NY_AM)
                .setup("Sweep + MSS")
                .rMultiple(new BigDecimal("1.5"))
                .pnlNet(new BigDecimal("150"))
                .riskPercent(BigDecimal.ONE)
                .build();
    }

    private BacktestingWorkspace workspace(BacktestingAutoImportMode mode, String symbol, String session, String timeframe) {
        return BacktestingWorkspace.builder()
                .id(UUID.randomUUID())
                .user(user)
                .strategy(strategy)
                .symbol(symbol)
                .session(session)
                .primaryTimeframe(timeframe)
                .autoImportMode(mode)
                .status(BacktestingWorkspaceStatus.ACTIVE)
                .build();
    }

    private BacktestEvidenceLink linkableEvidence(String instrument, UUID strategyId) {
        return BacktestEvidenceLink.builder()
                .id(UUID.randomUUID())
                .user(user)
                .liveTradeId(UUID.randomUUID())
                .sourceType(BacktestingEvidenceSource.LIVE)
                .syncStatus(BacktestingSyncStatus.NOT_LINKED)
                .classificationStatus(BacktestingClassificationStatus.NEEDS_CLASSIFICATION)
                .includedInAnalytics(false)
                .instrument(instrument)
                .strategyId(strategyId)
                .strategyNameSnapshot("Liquidity Sweep")
                .session("London")
                .timeframe("1m")
                .direction("LONG")
                .closedAt(OffsetDateTime.parse("2026-07-18T10:00:00+03:00"))
                .result("WIN")
                .realizedR(new BigDecimal("1.5"))
                .build();
    }
}
