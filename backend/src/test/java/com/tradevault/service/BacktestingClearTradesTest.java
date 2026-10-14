package com.tradevault.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.*;
import com.tradevault.repository.*;
import com.tradevault.service.backtesting.LiveTradeEvidenceSyncService;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BacktestingClearTradesTest {
    final BacktestingWorkspaceRepository workspaces = mock(BacktestingWorkspaceRepository.class);
    final BacktestingTradeRepository trades = mock(BacktestingTradeRepository.class);
    final BacktestingScreenshotRepository screenshots = mock(BacktestingScreenshotRepository.class);
    final CurrentUserService currentUser = mock(CurrentUserService.class);
    final LiveTradeEvidenceSyncService evidence = mock(LiveTradeEvidenceSyncService.class);
    final BacktestingResearchService service = new BacktestingResearchService(workspaces, trades, screenshots, null, currentUser, new ObjectMapper(), evidence, null);
    final User user = User.builder().id(UUID.randomUUID()).build();
    final BacktestingWorkspace workspace = BacktestingWorkspace.builder().id(UUID.randomUUID()).user(user).notes("Keep notes")
            .numberOfTrades(529).winningTrades(200).losingTrades(300).breakevenTrades(29).averageR(java.math.BigDecimal.ONE).build();

    @Test void clearsOnlyOwnedWorkspaceRowsAndUnlinksScreenshotsWithoutDeletingThem() {
        when(currentUser.getCurrentUser()).thenReturn(user);
        when(workspaces.findByIdAndUser_Id(workspace.getId(), user.getId())).thenReturn(Optional.of(workspace));
        BacktestingScreenshot shot = BacktestingScreenshot.builder().id(UUID.randomUUID()).caption("Keep caption")
                .backtestingTrade(BacktestingTrade.builder().id(UUID.randomUUID()).build()).build();
        when(screenshots.findByWorkspace_IdAndUser_IdOrderBySortOrderAscCreatedAtAsc(workspace.getId(), user.getId())).thenReturn(List.of(shot));
        service.deleteWorkspaceTrades(workspace.getId());
        assertThat(shot.getBacktestingTrade()).isNull();
        assertThat(shot.getCaption()).isEqualTo("Keep caption");
        assertThat(workspace.getNotes()).isEqualTo("Keep notes");
        assertThat(workspace.getUpdatedAt()).isNotNull();
        assertThat(workspace.getNumberOfTrades()).isZero();
        assertThat(workspace.getWinningTrades()).isZero();
        assertThat(workspace.getLosingTrades()).isZero();
        assertThat(workspace.getBreakevenTrades()).isZero();
        assertThat(workspace.getAverageR()).isNull();
        verify(evidence).excludeWorkspaceTrades(workspace.getId(), user.getId());
        verify(trades).deleteWorkspaceTrades(workspace.getId(), user.getId());
        verify(workspaces, never()).delete(any());
        verify(screenshots, never()).delete(any());
    }

    @Test void rejectsAnUnownedWorkspaceBeforeAnyMutation() {
        when(currentUser.getCurrentUser()).thenReturn(user);
        when(workspaces.findByIdAndUser_Id(workspace.getId(), user.getId())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.deleteWorkspaceTrades(workspace.getId())).isInstanceOf(EntityNotFoundException.class);
        verifyNoInteractions(trades, screenshots, evidence);
    }
}
