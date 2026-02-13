package com.tradevault.repository;

import com.tradevault.domain.entity.UserNotification;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserNotificationRepository extends JpaRepository<UserNotification, UUID> {
    long countByUser_Id(UUID userId);

    long countByEvent_Id(UUID eventId);

    @Query("""
        SELECT COUNT(un)
        FROM UserNotification un
        WHERE un.user.id = :userId
          AND un.readAt IS NULL
          AND un.dismissedAt IS NULL
        """)
    long countUnreadByUserId(@Param("userId") UUID userId);

    @Query("""
        SELECT un
        FROM UserNotification un
        JOIN FETCH un.event e
        JOIN FETCH e.content
        JOIN FETCH e.category
        WHERE un.user.id = :userId
          AND un.dismissedAt IS NULL
          AND (:unreadOnly = FALSE OR un.readAt IS NULL)
        ORDER BY un.createdAt DESC, un.id DESC
        """)
    List<UserNotification> findForFeedWithoutCursor(@Param("userId") UUID userId,
                                                    @Param("unreadOnly") boolean unreadOnly,
                                                    Pageable pageable);

    @Query("""
        SELECT un
        FROM UserNotification un
        JOIN FETCH un.event e
        JOIN FETCH e.content
        JOIN FETCH e.category
        WHERE un.user.id = :userId
          AND un.dismissedAt IS NULL
          AND (:unreadOnly = FALSE OR un.readAt IS NULL)
          AND (
            un.createdAt < :cursorCreatedAt
            OR (un.createdAt = :cursorCreatedAt AND un.id < :cursorId)
          )
        ORDER BY un.createdAt DESC, un.id DESC
        """)
    List<UserNotification> findForFeedWithCursor(@Param("userId") UUID userId,
                                                 @Param("unreadOnly") boolean unreadOnly,
                                                 @Param("cursorCreatedAt") OffsetDateTime cursorCreatedAt,
                                                 @Param("cursorId") UUID cursorId,
                                                 Pageable pageable);

    @Query("""
        SELECT un
        FROM UserNotification un
        JOIN FETCH un.event e
        JOIN FETCH e.content
        JOIN FETCH e.category
        WHERE un.id = :id
          AND un.user.id = :userId
          AND un.dismissedAt IS NULL
        """)
    Optional<UserNotification> findByIdAndUserIdWithEvent(@Param("id") UUID id, @Param("userId") UUID userId);

    @Modifying
    @Query("""
        UPDATE UserNotification un
        SET un.readAt = COALESCE(un.readAt, :now),
            un.clickedAt = COALESCE(un.clickedAt, :now)
        WHERE un.id = :id
          AND un.user.id = :userId
          AND un.dismissedAt IS NULL
        """)
    int markRead(@Param("id") UUID id, @Param("userId") UUID userId, @Param("now") OffsetDateTime now);

    @Modifying
    @Query("""
        UPDATE UserNotification un
        SET un.readAt = :now
        WHERE un.user.id = :userId
          AND un.readAt IS NULL
          AND un.dismissedAt IS NULL
        """)
    int markAllRead(@Param("userId") UUID userId, @Param("now") OffsetDateTime now);

    @Query("""
        SELECT un.id AS notificationId, un.user.id AS userId, un.createdAt AS createdAt
        FROM UserNotification un
        WHERE un.event.id = :eventId
          AND un.dismissedAt IS NULL
        """)
    List<DispatchNotificationView> findDispatchViewsByEventId(@Param("eventId") UUID eventId);

    @Query("""
        SELECT un.user.id AS userId, COUNT(un) AS unreadCount
        FROM UserNotification un
        WHERE un.user.id IN :userIds
          AND un.readAt IS NULL
          AND un.dismissedAt IS NULL
        GROUP BY un.user.id
        """)
    List<UserUnreadCountView> countUnreadByUserIds(@Param("userIds") Collection<UUID> userIds);

    @Modifying
    @Query(value = """
        INSERT INTO user_notification (id, user_id, event_id, created_at)
        SELECT uuid_generate_v4(), np.user_id, e.id, :createdAt
        FROM notification_event e
        JOIN notification_preferences np ON TRUE
        WHERE e.id = :eventId
          AND np.enabled = TRUE
          AND (
            (e.type = 'CONTENT_PUBLISHED' AND np.notify_on_new = TRUE)
            OR (e.type = 'CONTENT_UPDATED' AND np.notify_on_updates = TRUE)
          )
          AND (
            np.mode = 'ALL'
            OR (
              np.mode = 'SELECTED'
              AND (
                jsonb_exists(
                  COALESCE(np.categories_json, CAST('[]' AS jsonb)),
                  CAST(e.category_id AS text)
                )
                OR (
                  np.match_policy = 'CATEGORY_OR_TAGS_OR_SYMBOLS'
                  AND (
                    EXISTS (
                      SELECT 1
                      FROM jsonb_array_elements_text(COALESCE(np.tags_json, CAST('[]' AS jsonb))) AS pref_tag(tag_value)
                      WHERE jsonb_exists(COALESCE(e.tags, CAST('[]' AS jsonb)), pref_tag.tag_value)
                    )
                    OR EXISTS (
                      SELECT 1
                      FROM jsonb_array_elements_text(COALESCE(np.symbols_json, CAST('[]' AS jsonb))) AS pref_symbol(symbol_value)
                      WHERE jsonb_exists(COALESCE(e.symbols, CAST('[]' AS jsonb)), pref_symbol.symbol_value)
                    )
                  )
                )
              )
            )
            OR EXISTS (
              SELECT 1
              FROM follows f
              WHERE f.user_id = np.user_id
                AND (
                  (f.follow_type = 'TAG' AND jsonb_exists(COALESCE(e.tags, CAST('[]' AS jsonb)), f.value))
                  OR (f.follow_type = 'SYMBOL' AND jsonb_exists(COALESCE(e.symbols, CAST('[]' AS jsonb)), f.value))
                  OR (f.follow_type = 'STRATEGY' AND f.value = CAST(e.content_id AS text))
                )
            )
          )
        ON CONFLICT (user_id, event_id) DO NOTHING
        """, nativeQuery = true)
    int insertNotificationsForEvent(@Param("eventId") UUID eventId, @Param("createdAt") OffsetDateTime createdAt);

    interface DispatchNotificationView {
        UUID getNotificationId();
        UUID getUserId();
        OffsetDateTime getCreatedAt();
    }

    interface UserUnreadCountView {
        UUID getUserId();
        long getUnreadCount();
    }
}
