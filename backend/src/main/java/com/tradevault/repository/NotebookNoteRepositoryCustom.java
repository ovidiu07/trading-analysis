package com.tradevault.repository;

import com.tradevault.domain.entity.NotebookNote;
import com.tradevault.domain.enums.NotebookNoteType;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;

public interface NotebookNoteRepositoryCustom {

  List<NotebookNote> searchNotes(UUID userId,
      NotebookNoteType type,
      UUID folderId,
      LocalDate fromDate,
      LocalDate toDate,
      Boolean isDeleted,
      String query,
      Sort sort);

  List<NotebookNote> searchNotesByTags(UUID userId,
      NotebookNoteType type,
      UUID folderId,
      LocalDate fromDate,
      LocalDate toDate,
      Boolean isDeleted,
      String query,
      List<UUID> tagIds,
      Sort sort);
}
