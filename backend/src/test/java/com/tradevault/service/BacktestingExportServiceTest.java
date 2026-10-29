package com.tradevault.service;

import com.tradevault.domain.entity.User;
import com.tradevault.dto.backtesting.BacktestingWorkspaceResponse;
import com.tradevault.repository.BacktestEvidenceLinkRepository;
import com.tradevault.service.backtesting.LiveTradeEvidenceSyncService;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class BacktestingExportServiceTest {
    private final BacktestingService workspaces = mock(BacktestingService.class);
    private final BacktestingResearchService research = mock(BacktestingResearchService.class);
    private final BacktestEvidenceLinkRepository evidence = mock(BacktestEvidenceLinkRepository.class);
    private final LiveTradeEvidenceSyncService sync = mock(LiveTradeEvidenceSyncService.class);
    private final CurrentUserService currentUser = mock(CurrentUserService.class);
    private final BacktestingExportService service = new BacktestingExportService(workspaces, research, evidence, sync, currentUser);

    @Test
    void rejectsUnownedWorkspaceBeforeReadingAnyRelatedData() {
        UUID id = UUID.randomUUID();
        when(workspaces.getWorkspace(id)).thenThrow(new EntityNotFoundException());
        assertThrows(EntityNotFoundException.class, () -> service.snapshot(id));
        verifyNoInteractions(research, evidence, sync, currentUser);
    }

    @Test
    void includesEmptyWorkspaceContextAndQueriesAllEvidenceForTheOwner() {
        UUID id = UUID.randomUUID(), userId = UUID.randomUUID();
        var workspace = BacktestingWorkspaceResponse.builder().id(id).notes("Exact notes").build();
        when(workspaces.getWorkspace(id)).thenReturn(workspace);
        when(currentUser.getCurrentUser()).thenReturn(User.builder().id(userId).build());
        when(evidence.findByWorkspace_IdAndUser_IdOrderByUpdatedAtDesc(id, userId)).thenReturn(List.of());
        var result = service.snapshot(id);
        assertSame(workspace, result.workspace());
        assertNotNull(result.generatedAt());
        assertTrue(result.liveEvidence().isEmpty());
        verify(evidence).findByWorkspace_IdAndUser_IdOrderByUpdatedAtDesc(id, userId);
        verify(research).listTrades(id);
        verify(workspaces).listScreenshots(id);
        verify(research).listEdgeLenses(id);
        verify(research).analytics(id);
    }
}
