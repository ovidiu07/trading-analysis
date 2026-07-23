package com.tradevault.repository;

import com.tradevault.domain.entity.ImportedTradeOrder;
import com.tradevault.domain.enums.TradeSource;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ImportedTradeOrderRepository extends JpaRepository<ImportedTradeOrder, UUID> {
    Optional<ImportedTradeOrder> findByUserIdAndSourceAndBrokerServerIgnoreCaseAndExternalAccountIdAndExternalOrderId(
            UUID userId, TradeSource source, String brokerServer, String externalAccountId, String externalOrderId);
}
