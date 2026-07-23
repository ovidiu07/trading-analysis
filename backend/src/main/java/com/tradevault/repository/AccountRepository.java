package com.tradevault.repository;

import com.tradevault.domain.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AccountRepository extends JpaRepository<Account, UUID> {
    List<Account> findByUserId(UUID userId);
    List<Account> findByUserIdOrderByNameAsc(UUID userId);
    Optional<Account> findByIdAndUserId(UUID id, UUID userId);
    Optional<Account> findFirstByUserIdAndExternalAccountIdAndBrokerServerIgnoreCase(UUID userId, String externalAccountId, String brokerServer);
    List<Account> findByUserIdAndExternalAccountIdAndBrokerServerIgnoreCase(UUID userId, String externalAccountId, String brokerServer);

    boolean existsByUserIdAndDemoSeedIdIsNotNull(UUID userId);

    long deleteByUserIdAndDemoSeedIdIsNotNull(UUID userId);
}
