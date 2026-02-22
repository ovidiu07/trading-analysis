package com.tradevault.repository;

import com.tradevault.domain.entity.BacktestDataset;
import com.tradevault.domain.enums.BacktestCandleSource;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BacktestDatasetRepository extends JpaRepository<BacktestDataset, UUID> {
    Optional<BacktestDataset> findByIdAndUser_Id(UUID id, UUID userId);

    List<BacktestDataset> findByUser_IdOrderByCreatedAtDesc(UUID userId);

    List<BacktestDataset> findByUser_IdAndProviderOrderByCreatedAtDesc(UUID userId, BacktestCandleSource provider);

    Optional<BacktestDataset> findFirstByUser_IdAndProviderAndSourceIdOrderByCreatedAtDesc(UUID userId,
                                                                                            BacktestCandleSource provider,
                                                                                            String sourceId);

    long deleteByIdAndUser_Id(UUID id, UUID userId);

    long deleteByUser_IdAndProvider(UUID userId, BacktestCandleSource provider);
}
