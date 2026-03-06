package com.tradevault.repository;

import com.tradevault.domain.entity.SessionSetup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SessionSetupRepository extends JpaRepository<SessionSetup, UUID> {
    List<SessionSetup> findByTodaySession_IdAndUser_IdOrderBySortOrderAscCreatedAtAsc(UUID sessionId, UUID userId);

    Optional<SessionSetup> findByIdAndTodaySession_IdAndUser_Id(UUID id, UUID sessionId, UUID userId);

    boolean existsByTodaySession_Id(UUID sessionId);

    long countByTodaySession_IdAndUser_Id(UUID sessionId, UUID userId);
}
