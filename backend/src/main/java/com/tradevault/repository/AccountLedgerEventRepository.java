package com.tradevault.repository;

import com.tradevault.domain.entity.AccountLedgerEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AccountLedgerEventRepository extends JpaRepository<AccountLedgerEvent, UUID> {
    List<AccountLedgerEvent> findByAccountIdAndUserIdOrderByEventTimeAsc(UUID accountId, UUID userId);
    List<AccountLedgerEvent> findByAccountIdAndUserIdAndEventTimeBeforeOrderByEventTimeAsc(
            UUID accountId, UUID userId, OffsetDateTime before);
    Optional<AccountLedgerEvent> findByIdAndAccountIdAndUserId(UUID id, UUID accountId, UUID userId);
}
