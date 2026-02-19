package com.tradevault.repository;

import com.tradevault.domain.entity.TodaySession;
import com.tradevault.domain.enums.TodaySessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

public interface TodaySessionRepository extends JpaRepository<TodaySession, UUID> {
    Optional<TodaySession> findByUser_IdAndSessionDate(UUID userId, LocalDate sessionDate);

    Optional<TodaySession> findByIdAndUser_Id(UUID id, UUID userId);

    long countByUser_IdAndStatus(UUID userId, TodaySessionStatus status);
}
