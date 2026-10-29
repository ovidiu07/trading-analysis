package com.tradevault.service;

import com.tradevault.dto.backtesting.*;
import com.tradevault.repository.BacktestEvidenceLinkRepository;
import com.tradevault.service.backtesting.LiveTradeEvidenceSyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** All records are workspace/owner scoped, including excluded live evidence. */
@Service
@RequiredArgsConstructor
public class BacktestingExportService {
    private final BacktestingService workspaces;
    private final BacktestingResearchService research;
    private final BacktestEvidenceLinkRepository evidence;
    private final LiveTradeEvidenceSyncService sync;
    private final CurrentUserService currentUser;

    public record Snapshot(OffsetDateTime generatedAt, BacktestingWorkspaceResponse workspace,
            List<BacktestingTradeResponse> trades, List<BacktestingScreenshotResponse> screenshots,
            List<BacktestingEdgeLensResponse> lenses, BacktestingAnalyticsResponse analytics,
            List<BacktestingEvidenceResponse> liveEvidence) {}

    @Transactional(readOnly = true)
    public Snapshot snapshot(UUID workspaceId) {
        // Verify ownership before retrieving any related record.
        var workspace = workspaces.getWorkspace(workspaceId);
        var userId = currentUser.getCurrentUser().getId();
        var links = evidence.findByWorkspace_IdAndUser_IdOrderByUpdatedAtDesc(workspaceId, userId);
        return new Snapshot(OffsetDateTime.now(), workspace, research.listTrades(workspaceId),
                workspaces.listScreenshots(workspaceId), research.listEdgeLenses(workspaceId),
                research.analytics(workspaceId), links.stream().map(sync::toEvidenceResponse).toList());
    }
}
