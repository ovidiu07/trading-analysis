package com.tradevault.repository;

import com.tradevault.domain.entity.TradeImportRow;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface TradeImportRowRepository extends JpaRepository<TradeImportRow, UUID> {
    boolean existsByUserIdAndTransactionId(UUID userId, String transactionId);

    List<TradeImportRow> findAllByUserIdAndTransactionIdIn(UUID userId, Collection<String> transactionIds);
}
