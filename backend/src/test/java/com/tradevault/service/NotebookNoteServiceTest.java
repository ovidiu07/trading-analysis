package com.tradevault.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.tradevault.domain.entity.NotebookNote;
import com.tradevault.domain.entity.User;
import com.tradevault.dto.notebook.NotebookNoteRequest;
import com.tradevault.repository.NotebookAttachmentRepository;
import com.tradevault.repository.NotebookNoteRepository;
import com.tradevault.repository.NotebookTagLinkRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

@ExtendWith(MockitoExtension.class)
class NotebookNoteServiceTest {
    @Mock NotebookNoteRepository notes;
    @Mock NotebookTagLinkRepository tags;
    @Mock NotebookAttachmentRepository attachments;
    @Mock CurrentUserService users;
    @InjectMocks NotebookNoteService service;

    private String saveBody(String html) {
        var user = User.builder().id(UUID.randomUUID()).build();
        var note = NotebookNote.builder().id(UUID.randomUUID()).user(user).body("").build();
        when(users.getCurrentUser()).thenReturn(user);
        when(notes.findForUpdate(note.getId(), user.getId())).thenReturn(Optional.of(note));
        when(notes.findByIdAndUserId(note.getId(), user.getId())).thenReturn(Optional.of(note));
        when(notes.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var request = new NotebookNoteRequest();
        request.setBody(html);
        return service.update(note.getId(), request).getBody();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "EMA 20<div>VWAP above</div><div><br></div>",
        "<p>EMA  20 </p><p><br></p><p>VWAP above</p> "
    })
    void savePreservesLineContainersAndWhitespace(String html) {
        assertThat(saveBody(html)).isEqualTo(html);
    }

    @Test
    void saveStillRemovesUnsafeMarkup() {
        assertThat(saveBody("<div onclick='bad()'>EMA 20</div><script>bad()</script>"))
                .isEqualTo("<div>EMA 20</div>");
    }
}
