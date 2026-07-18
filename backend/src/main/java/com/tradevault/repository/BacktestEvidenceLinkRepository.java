package com.tradevault.repository;

import com.tradevault.domain.entity.BacktestEvidenceLink;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BacktestEvidenceLinkRepository extends JpaRepository<BacktestEvidenceLink, UUID> {
    Optional<BacktestEvidenceLink> findByLiveTradeIdAndUser_Id(UUID liveTradeId, UUID userId);

    Optional<BacktestEvidenceLink> findByIdAndUser_Id(UUID id, UUID userId);

    List<BacktestEvidenceLink> findByWorkspace_IdAndUser_IdAndIncludedInAnalyticsTrueOrderByTradeDateAscOpenedAtAscCreatedAtAsc(
            UUID workspaceId, UUID userId);

    List<BacktestEvidenceLink> findByWorkspace_IdAndUser_IdOrderByUpdatedAtDesc(UUID workspaceId, UUID userId);

    List<BacktestEvidenceLink> findByWorkspace_IdIn(List<UUID> workspaceIds);

    List<BacktestEvidenceLink> findByUser_IdOrderByUpdatedAtDesc(UUID userId);
}
