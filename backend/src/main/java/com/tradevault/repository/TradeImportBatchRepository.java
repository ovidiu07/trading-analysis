package com.tradevault.repository;

import com.tradevault.domain.entity.TradeImportBatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TradeImportBatchRepository extends JpaRepository<TradeImportBatch, UUID> {
    Optional<TradeImportBatch> findByIdAndUserId(UUID id, UUID userId);
}
