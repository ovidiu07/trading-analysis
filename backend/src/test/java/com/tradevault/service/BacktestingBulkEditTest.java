package com.tradevault.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.*;
import com.tradevault.domain.enums.*;
import com.tradevault.dto.backtesting.BacktestingTradeBulkUpdateRequest;
import com.tradevault.repository.*;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BacktestingBulkEditTest {
    final BacktestingWorkspaceRepository workspaces = mock(BacktestingWorkspaceRepository.class);
    final BacktestingTradeRepository repository = mock(BacktestingTradeRepository.class);
    final BacktestingScreenshotRepository screenshots = mock(BacktestingScreenshotRepository.class);
    final CurrentUserService currentUser = mock(CurrentUserService.class);
    final BacktestingResearchService service = new BacktestingResearchService(workspaces, repository, screenshots, null, currentUser, new ObjectMapper(), null, null);
    final User user = User.builder().id(UUID.randomUUID()).build();
    final BacktestingWorkspace workspace = BacktestingWorkspace.builder().id(UUID.randomUUID()).user(user).build();
    final BacktestingTrade winner = trade(BacktestingTradeResult.WIN, "11:00", "150");
    final BacktestingTrade loser = trade(BacktestingTradeResult.LOSS, "16:30", "-100");

    @BeforeEach void setup() {
        when(currentUser.getCurrentUser()).thenReturn(user);
        when(workspaces.findByIdAndUser_Id(workspace.getId(), user.getId())).thenReturn(Optional.of(workspace));
        when(repository.findAllById(any())).thenReturn(List.of(winner, loser));
    }
    BacktestingTrade trade(BacktestingTradeResult result, String time, String pnl) {
        return BacktestingTrade.builder().id(UUID.randomUUID()).workspace(workspace).user(user).date(LocalDate.of(2025, 10, 24))
                .entryTime(LocalTime.parse(time)).instrument("PEPPERSTONE:GER40F").direction(BacktestingTradeDirection.SHORT)
                .result(result).netPnl(new BigDecimal(pnl)).currency("EUR").source(BacktestingTradeSource.IMPORT)
                .tradeScope(BacktestingTradeScope.REPLAY).importFormat("TRADINGVIEW_REPLAY").importFingerprint("retained-" + time)
                .tagsJson("[\"keep\"]").notes("Keep this note").build();
    }
    BacktestingTradeBulkUpdateRequest request(String... fields) {
        var request = new BacktestingTradeBulkUpdateRequest();
        request.setTradeIds(List.of(winner.getId(), loser.getId()));
        request.setFields(Set.of(fields));
        return request;
    }
    @Test void fixedRewardRiskUsesEachOutcomeAndPreservesUnselectedFieldsAndExportIdentity() {
        var request = request("plannedRR"); request.getChanges().setPlannedRR(new BigDecimal("1.5"));
        request.setDeriveRFromPlannedRR(true); request.setRecalculateSession(true);
        var result = service.updateTrades(workspace.getId(), request);
        assertThat(result).hasSize(2);
        assertThat(winner.getPnlR()).isEqualByComparingTo("1.5"); assertThat(loser.getPnlR()).isEqualByComparingTo("-1");
        assertThat(winner.getSession()).isEqualTo("London"); assertThat(loser.getSession()).isEqualTo("New York");
        assertThat(winner.getNotes()).isEqualTo("Keep this note"); assertThat(winner.getTagsJson()).isEqualTo("[\"keep\"]");
        assertThat(winner.getNetPnl()).isEqualByComparingTo("150"); assertThat(winner.getSource()).isEqualTo(BacktestingTradeSource.IMPORT);
        assertThat(winner.getTradeScope()).isEqualTo(BacktestingTradeScope.REPLAY); assertThat(winner.getImportFingerprint()).isEqualTo("retained-11:00");
        assertThat(service.calculateMetrics(List.of(winner, loser)).getTotalR()).isEqualByComparingTo("0.5");
        verify(repository).saveAll(List.of(winner, loser));
    }
    @Test void canClearOnlyCheckedFieldsAndClassifyWithoutEditingOtherValues() {
        winner.setPlannedRR(BigDecimal.ZERO); // Legacy metadata is preserved when this field is unchecked.
        var request = request("notes"); request.setRecalculateSession(true);
        service.updateTrades(workspace.getId(), request);
        assertThat(winner.getNotes()).isNull(); assertThat(loser.getNotes()).isNull();
        assertThat(winner.getTagsJson()).isEqualTo("[\"keep\"]"); assertThat(winner.getPlannedRR()).isZero(); assertThat(winner.getPnlR()).isNull();
    }
    @Test void mixedResultsRejectOnePositiveRealizedRBeforeChangingAnyTrade() {
        var request = request("notes", "pnlR"); request.getChanges().setPnlR(new BigDecimal("1.5"));
        assertThatThrownBy(() -> service.updateTrades(workspace.getId(), request)).hasMessageContaining("match each trade's result");
        assertThat(winner.getNotes()).isEqualTo("Keep this note"); verify(repository, never()).saveAll(any());
    }
    @Test void rejectsMissingOrForeignOrLiveTradesAsOneOperation() {
        var request = request("notes");
        when(repository.findAllById(any())).thenReturn(List.of(winner));
        assertThatThrownBy(() -> service.updateTrades(workspace.getId(), request)).isInstanceOf(EntityNotFoundException.class);
        when(repository.findAllById(any())).thenReturn(List.of(winner, loser));
        loser.setUser(User.builder().id(UUID.randomUUID()).build());
        assertThatThrownBy(() -> service.updateTrades(workspace.getId(), request)).isInstanceOf(EntityNotFoundException.class);
        loser.setUser(user); loser.setWorkspace(BacktestingWorkspace.builder().id(UUID.randomUUID()).build());
        assertThatThrownBy(() -> service.updateTrades(workspace.getId(), request)).isInstanceOf(EntityNotFoundException.class);
        loser.setWorkspace(workspace); loser.setSource(BacktestingTradeSource.LIVE);
        assertThatThrownBy(() -> service.updateTrades(workspace.getId(), request)).isInstanceOf(EntityNotFoundException.class);
        assertThat(winner.getNotes()).isEqualTo("Keep this note"); verify(repository, never()).saveAll(any());
    }
    @Test void derivedRRequiresPositiveRatioAndCannotBeCombinedWithExplicitR() {
        var request = request(); request.setDeriveRFromPlannedRR(true);
        assertThatThrownBy(() -> service.updateTrades(workspace.getId(), request)).hasMessageContaining("positive planned R:R");
        request.setFields(Set.of("pnlR"));
        assertThatThrownBy(() -> service.updateTrades(workspace.getId(), request)).hasMessageContaining("either explicit R");
        verify(repository, never()).saveAll(any());
    }
    @Test void sourceTimezoneChangeReclassifiesEntryClockAndBreakevenIsZero() {
        winner.setResult(BacktestingTradeResult.BREAKEVEN);
        winner.setNetPnl(BigDecimal.ZERO);
        var request = request("plannedRR", "sourceTimezone"); request.getChanges().setPlannedRR(new BigDecimal("1.5"));
        request.getChanges().setSourceTimezone("UTC"); request.setDeriveRFromPlannedRR(true);
        service.updateTrades(workspace.getId(), request);
        assertThat(winner.getPnlR()).isZero(); assertThat(winner.getSession()).isEqualTo("London");
        assertThat(loser.getSession()).isEqualTo("New York");
    }
}
