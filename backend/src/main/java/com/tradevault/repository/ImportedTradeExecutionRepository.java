package com.tradevault.repository;

import com.tradevault.domain.entity.ImportedTradeExecution;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ImportedTradeExecutionRepository extends JpaRepository<ImportedTradeExecution, UUID> {
    Optional<ImportedTradeExecution> findBySourceAndBrokerServerIgnoreCaseAndExternalAccountIdAndExternalDealId(
            com.tradevault.domain.enums.TradeSource source, String brokerServer, String externalAccountId, String externalDealId);
    long countByTradeId(UUID tradeId);
}
