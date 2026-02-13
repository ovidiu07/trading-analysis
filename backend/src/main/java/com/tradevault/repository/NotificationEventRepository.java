package com.tradevault.repository;

import com.tradevault.domain.entity.NotificationEvent;
import com.tradevault.domain.enums.NotificationDispatchStatus;
import com.tradevault.domain.enums.NotificationEventType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotificationEventRepository extends JpaRepository<NotificationEvent, UUID> {
    boolean existsByContent_IdAndTypeAndContentVersion(UUID contentId, NotificationEventType type, int contentVersion);
    long countByContent_IdAndTypeAndContentVersion(UUID contentId, NotificationEventType type, int contentVersion);
    List<NotificationEvent> findByContent_IdAndType(UUID contentId, NotificationEventType type);
    long countByStatus(NotificationDispatchStatus status);

    @Query("""
        SELECT e.id
        FROM NotificationEvent e
        WHERE e.effectiveAt <= :now
          AND (
            e.status = com.tradevault.domain.enums.NotificationDispatchStatus.PENDING
            OR e.status = com.tradevault.domain.enums.NotificationDispatchStatus.FAILED
          )
          AND (e.nextRetryAt IS NULL OR e.nextRetryAt <= :now)
        ORDER BY e.nextRetryAt ASC NULLS FIRST, e.createdAt ASC
        """)
    List<UUID> findDueEventIds(@Param("now") OffsetDateTime now, Pageable pageable);

    @Modifying
    @Query(value = """
        UPDATE notification_event
        SET status = 'PROCESSING',
            locked_at = :now,
            attempts = attempts + 1
        WHERE id = :id
          AND effective_at <= :now
          AND status IN ('PENDING', 'FAILED')
          AND (next_retry_at IS NULL OR next_retry_at <= :now)
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
    @Query(value = """
        UPDATE notification_event
        SET status = 'SENT',
            locked_at = NULL,
            last_error = NULL,
            next_retry_at = NULL,
            dispatched_at = :dispatchedAt
        WHERE id = :id
          AND status = 'PROCESSING'
        """, nativeQuery = true)
    int markSent(@Param("id") UUID id, @Param("dispatchedAt") OffsetDateTime dispatchedAt);

    @Modifying
    @Query(value = """
        UPDATE notification_event
        SET status = 'FAILED',
            locked_at = NULL,
            last_error = :lastError,
            next_retry_at = :nextRetryAt
        WHERE id = :id
          AND status = 'PROCESSING'
        """, nativeQuery = true)
    int markFailed(@Param("id") UUID id,
                   @Param("lastError") String lastError,
                   @Param("nextRetryAt") OffsetDateTime nextRetryAt);
}
