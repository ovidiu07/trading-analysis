package com.tradevault.repository;

import com.tradevault.domain.entity.ContentPost;
import com.tradevault.domain.enums.ContentPostStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ContentPostRepository extends JpaRepository<ContentPost, UUID> {
    Optional<ContentPost> findBySlug(String slug);

    @Query("""
        SELECT p FROM ContentPost p
        WHERE (:contentTypeId IS NULL OR p.contentType.id = :contentTypeId)
          AND (p.status = COALESCE(:status, p.status))
          AND (
            COALESCE(:query, '') = '' OR
            EXISTS (
                SELECT 1 FROM ContentPostTranslation tr
                WHERE tr.contentPost = p
                  AND tr.locale IN (:locale, :fallbackLocale)
                  AND (
                    LOWER(tr.title) LIKE LOWER(CONCAT('%', :query, '%')) OR
                    LOWER(COALESCE(tr.summary, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR
                    LOWER(tr.bodyMarkdown) LIKE LOWER(CONCAT('%', :query, '%'))
                  )
            )
          )
        """)
    Page<ContentPost> searchAdmin(@Param("contentTypeId") UUID contentTypeId,
                                  @Param("status") ContentPostStatus status,
                                  @Param("query") String query,
                                  @Param("locale") String locale,
                                  @Param("fallbackLocale") String fallbackLocale,
                                  Pageable pageable);

    @Query("""
        SELECT p FROM ContentPost p
        WHERE p.status = :status
          AND (:contentTypeKey IS NULL OR p.contentType.key = :contentTypeKey)
          AND (
            COALESCE(:query, '') = '' OR
            EXISTS (
                SELECT 1 FROM ContentPostTranslation tr
                WHERE tr.contentPost = p
                  AND tr.locale IN (:locale, :fallbackLocale)
                  AND (
                    LOWER(tr.title) LIKE LOWER(CONCAT('%', :query, '%')) OR
                    LOWER(COALESCE(tr.summary, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR
                    LOWER(tr.bodyMarkdown) LIKE LOWER(CONCAT('%', :query, '%'))
                  )
            )
          )
          AND (
            :activeOnly = false OR
            (
              (p.visibleFrom IS NULL OR p.visibleFrom <= :now)
              AND (p.visibleUntil IS NULL OR p.visibleUntil >= :now)
            )
          )
        ORDER BY p.publishedAt DESC, p.updatedAt DESC
        """)
    List<ContentPost> searchPublished(@Param("status") ContentPostStatus status,
                                      @Param("contentTypeKey") String contentTypeKey,
                                      @Param("query") String query,
                                      @Param("locale") String locale,
                                      @Param("fallbackLocale") String fallbackLocale,
                                      @Param("activeOnly") boolean activeOnly,
                                      @Param("now") OffsetDateTime now);
}
