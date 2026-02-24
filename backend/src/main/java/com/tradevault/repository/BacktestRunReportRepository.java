package com.tradevault.repository;

import com.tradevault.domain.entity.BacktestRunReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BacktestRunReportRepository extends JpaRepository<BacktestRunReport, UUID> {
    Optional<BacktestRunReport> findFirstByRun_IdOrderByCreatedAtUtcDesc(UUID runId);

    List<BacktestRunReport> findByRun_User_IdOrderByCreatedAtUtcDesc(UUID userId);
}
