package com.tradevault.repository;

import com.tradevault.domain.entity.UserStrategy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserStrategyRepository extends JpaRepository<UserStrategy, UUID> {
    List<UserStrategy> findByUser_IdAndArchivedOrderByUpdatedAtDesc(UUID userId, boolean archived);

    List<UserStrategy> findByUser_IdOrderByUpdatedAtDesc(UUID userId);

    Optional<UserStrategy> findByIdAndUser_Id(UUID id, UUID userId);
}
