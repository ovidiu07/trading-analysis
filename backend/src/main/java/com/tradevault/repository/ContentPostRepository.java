package com.tradevault.repository;

import com.tradevault.domain.entity.ContentPost;
import com.tradevault.domain.enums.ContentPostStatus;
import com.tradevault.domain.enums.ContentPostType;
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
        WHERE (p.type = COALESCE(:type, p.type))
          AND (p.status = COALESCE(:status, p.status))
          AND (
            COALESCE(:query, '') = '' OR
            LOWER(p.title) LIKE LOWER(CONCAT('%', :query, '%')) OR
            LOWER(p.summary) LIKE LOWER(CONCAT('%', :query, '%')) OR
            LOWER(p.body) LIKE LOWER(CONCAT('%', :query, '%'))
          )
        """)
    Page<ContentPost> searchAdmin(@Param("type") ContentPostType type,
                                  @Param("status") ContentPostStatus status,
                                  @Param("query") String query,
                                  Pageable pageable);

    @Query("""
        SELECT p FROM ContentPost p
        WHERE p.status = :status
          AND (p.type = COALESCE(:type, p.type))
          AND (
            COALESCE(:query, '') = '' OR
            LOWER(p.title) LIKE LOWER(CONCAT('%', :query, '%')) OR
            LOWER(p.summary) LIKE LOWER(CONCAT('%', :query, '%')) OR
            LOWER(p.body) LIKE LOWER(CONCAT('%', :query, '%'))
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
                                      @Param("type") ContentPostType type,
                                      @Param("query") String query,
                                      @Param("activeOnly") boolean activeOnly,
                                      @Param("now") OffsetDateTime now);
}
