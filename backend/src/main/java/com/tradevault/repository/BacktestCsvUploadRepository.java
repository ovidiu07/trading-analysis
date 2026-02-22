package com.tradevault.repository;

import com.tradevault.domain.entity.BacktestCsvUpload;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface BacktestCsvUploadRepository extends JpaRepository<BacktestCsvUpload, UUID> {
    Optional<BacktestCsvUpload> findByIdAndUser_Id(UUID id, UUID userId);
}
