package com.tradevault.repository;

import com.tradevault.domain.entity.NotebookNote;
import com.tradevault.domain.enums.NotebookNoteType;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotebookNoteRepository extends JpaRepository<NotebookNote, UUID> {
    Optional<NotebookNote> findByIdAndUserId(UUID id, UUID userId);

    List<NotebookNote> findByUserIdAndIsDeletedFalse(UUID userId);

    boolean existsByUserIdAndDemoSeedIdIsNotNull(UUID userId);

    boolean existsByUserIdAndDemoSeedIdIsNull(UUID userId);

    long deleteByUserIdAndDemoSeedIdIsNotNull(UUID userId);

    @Query("""
        SELECT n FROM NotebookNote n
        WHERE n.user.id = :userId
          AND n.type = COALESCE(:type, n.type)
          AND (
                :folderId IS NULL
                OR (n.folder IS NOT NULL AND n.folder.id = :folderId)
          )
          AND (:fromDate IS NULL OR n.dateKey >= :fromDate)
          AND (:toDate IS NULL OR n.dateKey <= :toDate)
          AND n.isDeleted = COALESCE(:isDeleted, n.isDeleted)
          AND (
            COALESCE(:query, '') = '' OR
            LOWER(n.title) LIKE LOWER(CONCAT('%', :query, '%')) OR
            LOWER(n.body)  LIKE LOWER(CONCAT('%', :query, '%'))
          )
        """)
    List<NotebookNote> searchNotes(@Param("userId") UUID userId,
                                   @Param("type") NotebookNoteType type,
                                   @Param("folderId") UUID folderId,
                                   @Param("fromDate") LocalDate fromDate,
                                   @Param("toDate") LocalDate toDate,
                                   @Param("isDeleted") Boolean isDeleted,
                                   @Param("query") String query,
                                   Sort sort);

    @Query("""
        SELECT DISTINCT n FROM NotebookNote n
        JOIN NotebookTagLink l ON l.note.id = n.id
        WHERE n.user.id = :userId
          AND n.type = COALESCE(:type, n.type)
          AND (
                :folderId IS NULL
                OR (n.folder IS NOT NULL AND n.folder.id = :folderId)
          )
          AND (:fromDate IS NULL OR n.dateKey >= :fromDate)
          AND (:toDate IS NULL OR n.dateKey <= :toDate)
          AND n.isDeleted = COALESCE(:isDeleted, n.isDeleted)
          AND l.tag.id IN :tagIds
          AND (
            COALESCE(:query, '') = '' OR
            LOWER(n.title) LIKE LOWER(CONCAT('%', :query, '%')) OR
            LOWER(n.body)  LIKE LOWER(CONCAT('%', :query, '%'))
          )
        """)
    List<NotebookNote> searchNotesByTags(@Param("userId") UUID userId,
                                         @Param("type") NotebookNoteType type,
                                         @Param("folderId") UUID folderId,
                                         @Param("fromDate") LocalDate fromDate,
                                         @Param("toDate") LocalDate toDate,
                                         @Param("isDeleted") Boolean isDeleted,
                                         @Param("query") String query,
                                         @Param("tagIds") List<UUID> tagIds,
                                         Sort sort);
}
