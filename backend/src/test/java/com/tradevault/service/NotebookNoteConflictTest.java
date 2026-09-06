package com.tradevault.service;
import com.tradevault.domain.entity.*;
import com.tradevault.dto.notebook.NotebookNoteRequest;
import com.tradevault.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.time.OffsetDateTime;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
@ExtendWith(MockitoExtension.class)
class NotebookNoteConflictTest {
 @Mock NotebookNoteRepository notes;
 @Mock CurrentUserService users;
 @InjectMocks NotebookNoteService service;
 @Test void staleNotebookWriterCannotOverwriteTodayJournal() {
  UUID userId=UUID.randomUUID(),noteId=UUID.randomUUID();
  var user=User.builder().id(userId).build();when(users.getCurrentUser()).thenReturn(user);
  when(notes.findForUpdate(noteId,userId)).thenReturn(Optional.of(NotebookNote.builder().id(noteId).user(user).updatedAt(OffsetDateTime.parse("2026-09-06T12:01:00Z")).body("Newer Today text").build()));
  var request=new NotebookNoteRequest();request.setExpectedUpdatedAt(OffsetDateTime.parse("2026-09-06T12:00:00Z"));request.setBody("Stale Notebook text");
  assertThatThrownBy(()->service.update(noteId,request)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class).hasMessageContaining("409");
  verify(notes,never()).save(any());
 }
}
