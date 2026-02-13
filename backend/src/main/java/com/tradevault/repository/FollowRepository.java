package com.tradevault.repository;

import com.tradevault.domain.entity.Follow;
import com.tradevault.domain.enums.FollowType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FollowRepository extends JpaRepository<Follow, UUID> {
    List<Follow> findByUser_IdOrderByCreatedAtDesc(UUID userId);

    Optional<Follow> findByIdAndUser_Id(UUID id, UUID userId);

    Optional<Follow> findByUser_IdAndFollowTypeAndValue(UUID userId, FollowType followType, String value);
}
