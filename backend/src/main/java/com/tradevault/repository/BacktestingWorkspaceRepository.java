package com.tradevault.repository;

import com.tradevault.domain.entity.BacktestingWorkspace;
import com.tradevault.domain.enums.BacktestingWorkspaceStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BacktestingWorkspaceRepository extends JpaRepository<BacktestingWorkspace, UUID> {
    List<BacktestingWorkspace> findByUser_IdAndStatusOrderByUpdatedAtDesc(UUID userId, BacktestingWorkspaceStatus status);

    Optional<BacktestingWorkspace> findByIdAndUser_Id(UUID id, UUID userId);

    Optional<BacktestingWorkspace> findByIdAndUser_IdAndStatus(UUID id, UUID userId, BacktestingWorkspaceStatus status);
}
