package com.tradevault.repository;

import com.tradevault.domain.entity.BacktestProviderCredential;
import com.tradevault.domain.enums.BacktestCandleSource;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface BacktestProviderCredentialRepository extends JpaRepository<BacktestProviderCredential, UUID> {
    Optional<BacktestProviderCredential> findByUser_IdAndProvider(UUID userId, BacktestCandleSource provider);

    long deleteByUser_IdAndProvider(UUID userId, BacktestCandleSource provider);
}
