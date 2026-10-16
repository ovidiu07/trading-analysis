package com.tradevault.repository;

import com.tradevault.domain.entity.UserStrategy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserStrategyRepository extends JpaRepository<UserStrategy, UUID> {
    List<UserStrategy> findByUser_IdAndArchivedOrderByUpdatedAtDesc(UUID userId, boolean archived);

    List<UserStrategy> findByUser_IdOrderByUpdatedAtDesc(UUID userId);

    Optional<UserStrategy> findByIdAndUser_Id(UUID id, UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from UserStrategy s where s.id = :id and s.user.id = :userId")
    Optional<UserStrategy> lockOwned(UUID id, UUID userId);

    List<UserStrategy> findByIdInAndUser_Id(Collection<UUID> ids, UUID userId);
}
