package com.tradevault.repository;

import com.tradevault.domain.entity.ChartProfile;
import com.tradevault.domain.enums.ChartProfileScope;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChartProfileRepository extends JpaRepository<ChartProfile, UUID> {
    List<ChartProfile> findByUser_IdAndScopeOrderByUpdatedAtDesc(UUID userId, ChartProfileScope scope);

    Optional<ChartProfile> findByIdAndUser_Id(UUID id, UUID userId);

    Optional<ChartProfile> findFirstByUser_IdAndScopeAndIsDefaultTrue(UUID userId, ChartProfileScope scope);

    List<ChartProfile> findByUser_IdAndScopeAndIsDefaultTrue(UUID userId, ChartProfileScope scope);
}
