package com.tradevault.repository;

import com.tradevault.domain.entity.NotificationEvent;
import com.tradevault.domain.enums.NotificationDispatchStatus;
import com.tradevault.domain.enums.NotificationEventType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotificationEventRepository extends JpaRepository<NotificationEvent, UUID> {
    boolean existsByContent_IdAndTypeAndContentVersion(UUID contentId, NotificationEventType type, int contentVersion);
    long countByContent_IdAndTypeAndContentVersion(UUID contentId, NotificationEventType type, int contentVersion);
    List<NotificationEvent> findByContent_IdAndType(UUID contentId, NotificationEventType type);

    @Query("""
        SELECT e.id
        FROM NotificationEvent e
        WHERE e.effectiveAt <= :now
          AND (
            e.status = com.tradevault.domain.enums.NotificationDispatchStatus.PENDING
            OR (
              e.status = com.tradevault.domain.enums.NotificationDispatchStatus.FAILED
              AND (e.nextRetryAt IS NULL OR e.nextRetryAt <= :now)
            )
          )
        ORDER BY e.effectiveAt ASC, e.createdAt ASC
        """)
    List<UUID> findDueEventIds(@Param("now") OffsetDateTime now, Pageable pageable);

    @Modifying
    @Query(value = """
        UPDATE notification_event
        SET status = 'PROCESSING',
            locked_at = :now,
            attempts = attempts + 1,
            last_error = NULL
        WHERE id = :id
          AND effective_at <= :now
          AND (
            status = 'PENDING'
            OR (
              status = 'FAILED'
              AND (next_retry_at IS NULL OR next_retry_at <= :now)
            )
          )
        """, nativeQuery = true)
    int claimEvent(@Param("id") UUID id, @Param("now") OffsetDateTime now);

    @Query("""
        SELECT e
        FROM NotificationEvent e
        JOIN FETCH e.content c
        JOIN FETCH e.category
        WHERE e.id = :id
        """)
    Optional<NotificationEvent> findByIdWithContentAndCategory(@Param("id") UUID id);

    @Modifying
    @Query("""
        UPDATE NotificationEvent e
        SET e.status = :status,
            e.lockedAt = NULL,
            e.lastError = NULL,
            e.nextRetryAt = NULL,
            e.dispatchedAt = :dispatchedAt
        WHERE e.id = :id
          AND e.status = com.tradevault.domain.enums.NotificationDispatchStatus.PROCESSING
        """)
    int markSent(@Param("id") UUID id,
                 @Param("status") NotificationDispatchStatus status,
                 @Param("dispatchedAt") OffsetDateTime dispatchedAt);

    @Modifying
    @Query("""
        UPDATE NotificationEvent e
        SET e.status = :status,
            e.lockedAt = NULL,
            e.lastError = :lastError,
            e.nextRetryAt = :nextRetryAt
        WHERE e.id = :id
          AND e.status = com.tradevault.domain.enums.NotificationDispatchStatus.PROCESSING
        """)
    int markFailed(@Param("id") UUID id,
                   @Param("status") NotificationDispatchStatus status,
                   @Param("lastError") String lastError,
                   @Param("nextRetryAt") OffsetDateTime nextRetryAt);
}
