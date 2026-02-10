package com.tradevault.repository;

import com.tradevault.domain.entity.NotificationEvent;
import com.tradevault.domain.enums.NotificationEventType;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotificationEventRepository extends JpaRepository<NotificationEvent, UUID> {
    boolean existsByContent_IdAndTypeAndContentVersion(UUID contentId, NotificationEventType type, int contentVersion);
    long countByContent_IdAndTypeAndContentVersion(UUID contentId, NotificationEventType type, int contentVersion);

    List<NotificationEvent> findTop200ByDispatchedAtIsNullAndEffectiveAtLessThanEqualOrderByEffectiveAtAsc(OffsetDateTime now);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        SELECT e
        FROM NotificationEvent e
        JOIN FETCH e.content c
        JOIN FETCH e.category
        WHERE e.id = :id
        """)
    Optional<NotificationEvent> findByIdForUpdate(@Param("id") UUID id);
}
