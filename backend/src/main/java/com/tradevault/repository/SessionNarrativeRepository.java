package com.tradevault.repository;

import com.tradevault.domain.entity.SessionNarrative;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SessionNarrativeRepository extends JpaRepository<SessionNarrative, UUID> {
    Optional<SessionNarrative> findBySessionIdAndUser_Id(UUID sessionId, UUID userId);

    Optional<SessionNarrative> findByTodaySession_IdAndUser_Id(UUID sessionId, UUID userId);
}
