package com.tradevault.repository;

import com.tradevault.domain.entity.Account;
import com.tradevault.domain.enums.AccountStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

public interface AccountRepository extends JpaRepository<Account, UUID> {
    List<Account> findByUserId(UUID userId);
    List<Account> findByUserIdOrderByNameAsc(UUID userId);
    List<Account> findByUserIdAndIdIn(UUID userId, Collection<UUID> ids);
    List<Account> findByUserIdAndStatusOrderByNameAsc(UUID userId, AccountStatus status);
    Optional<Account> findByIdAndUserId(UUID id, UUID userId);
    Optional<Account> findFirstByUserIdAndExternalAccountIdAndBrokerServerIgnoreCase(UUID userId, String externalAccountId, String brokerServer);
    List<Account> findByUserIdAndExternalAccountIdIgnoreCase(UUID userId, String externalAccountId);
    List<Account> findByUserIdAndExternalAccountIdAndBrokerServerIgnoreCase(UUID userId, String externalAccountId, String brokerServer);
    boolean existsByUserIdAndStatus(UUID userId, AccountStatus status);

    @Modifying
    @Query("update Account account set account.isDefault = false where account.user.id = :userId and account.isDefault = true")
    void clearDefaultForUser(@Param("userId") UUID userId);

    boolean existsByUserIdAndDemoSeedIdIsNotNull(UUID userId);

    long deleteByUserIdAndDemoSeedIdIsNotNull(UUID userId);
}
