package com.tradevault.repository;

import com.tradevault.domain.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AccountRepository extends JpaRepository<Account, UUID> {
    List<Account> findByUserId(UUID userId);
    Optional<Account> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByUserIdAndDemoSeedIdIsNotNull(UUID userId);

    long deleteByUserIdAndDemoSeedIdIsNotNull(UUID userId);
}
