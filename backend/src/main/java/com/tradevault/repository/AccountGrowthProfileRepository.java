package com.tradevault.repository;

import com.tradevault.domain.entity.AccountGrowthProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AccountGrowthProfileRepository extends JpaRepository<AccountGrowthProfile, UUID> {
    Optional<AccountGrowthProfile> findByAccountIdAndUserId(UUID accountId, UUID userId);
    List<AccountGrowthProfile> findByUserId(UUID userId);
}
