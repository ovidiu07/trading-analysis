package com.tradevault.repository;

import com.tradevault.domain.entity.BacktestingEdgeLens;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BacktestingEdgeLensRepository extends JpaRepository<BacktestingEdgeLens, UUID> {
    List<BacktestingEdgeLens> findByWorkspace_IdAndUser_IdOrderByUpdatedAtDesc(UUID workspaceId, UUID userId);

    List<BacktestingEdgeLens> findByWorkspace_IdIn(List<UUID> workspaceIds);

    Optional<BacktestingEdgeLens> findByIdAndUser_Id(UUID id, UUID userId);
}
