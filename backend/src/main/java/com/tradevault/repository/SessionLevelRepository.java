package com.tradevault.repository;

import com.tradevault.domain.entity.SessionLevel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SessionLevelRepository extends JpaRepository<SessionLevel, UUID> {
    List<SessionLevel> findByTodaySession_IdAndUser_IdOrderByCreatedAtAsc(UUID todaySessionId, UUID userId);

    List<SessionLevel> findByTodaySession_IdAndUser_IdAndSymbolIgnoreCaseOrderByCreatedAtAsc(UUID todaySessionId,
                                                                                              UUID userId,
                                                                                              String symbol);

    Optional<SessionLevel> findByIdAndTodaySession_IdAndUser_Id(UUID id, UUID todaySessionId, UUID userId);

    Optional<SessionLevel> findByTodaySession_IdAndUser_IdAndSymbolIgnoreCaseAndSweepRoleTrue(UUID todaySessionId,
                                                                                                UUID userId,
                                                                                                String symbol);

    Optional<SessionLevel> findByTodaySession_IdAndUser_IdAndSymbolIgnoreCaseAndEntryRoleTrue(UUID todaySessionId,
                                                                                                UUID userId,
                                                                                                String symbol);

    Optional<SessionLevel> findByTodaySession_IdAndUser_IdAndSymbolIgnoreCaseAndSlRoleTrue(UUID todaySessionId,
                                                                                             UUID userId,
                                                                                             String symbol);

    Optional<SessionLevel> findByTodaySession_IdAndUser_IdAndSymbolIgnoreCaseAndTpRoleTrue(UUID todaySessionId,
                                                                                             UUID userId,
                                                                                             String symbol);

    void deleteByIdAndTodaySession_IdAndUser_Id(UUID id, UUID todaySessionId, UUID userId);
}
