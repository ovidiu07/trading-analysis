package com.tradevault.controller;

import com.tradevault.service.CurrentUserService;
import com.tradevault.service.NotebookNoteService;
import com.tradevault.service.today.SessionReviewService;
import com.tradevault.dto.notebook.NotebookNoteRequest;
import com.tradevault.dto.notebook.NotebookNoteResponse;
import com.tradevault.domain.enums.NotebookNoteType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.*;
import java.util.*;

@RestController
@RequestMapping("/api/today/journals")
@RequiredArgsConstructor
public class PreparationJournalController {
    private final SessionReviewService reviews;
    private final NotebookNoteService notes;
    private final CurrentUserService users;
    private final JdbcTemplate jdbc;
    private final com.fasterxml.jackson.databind.ObjectMapper mapper;
    public record Update(OffsetDateTime updatedAt, @Size(max=50000) String body) {}

    @PostMapping("/{accountId}/{date}")
    @Transactional
    public NotebookNoteResponse open(@PathVariable UUID accountId, @PathVariable LocalDate date,
                                      @RequestParam(defaultValue="DAY") String session) {
        reviews.get(accountId, date, session);
        UUID userId = users.getCurrentUser().getId();
        jdbc.queryForObject("SELECT id FROM accounts WHERE id=? AND user_id=? FOR UPDATE", UUID.class, accountId, userId);
        var ids = jdbc.queryForList("SELECT note_id FROM preparation_journals WHERE user_id=? AND account_id=? AND session_date=? AND session_key=?", UUID.class, userId, accountId, date, session);
        if (!ids.isEmpty()) return notes.get(ids.get(0));
        var request = new NotebookNoteRequest();
        request.setType(NotebookNoteType.DAILY_LOG);
        request.setTitle(date + " · " + session + " · " + jdbc.queryForObject("SELECT name FROM accounts WHERE id=? AND user_id=?",String.class,accountId,userId));
        request.setDateKey(date);
        request.setBody("");
        var note = notes.create(request);
        jdbc.update("INSERT INTO preparation_journals(user_id,account_id,session_date,session_key,note_id) VALUES (?,?,?,?,?)", userId, accountId, date, session, note.getId());
        return note;
    }

    @PutMapping("/{accountId}/{date}")
    @Transactional
    public NotebookNoteResponse save(@PathVariable UUID accountId, @PathVariable LocalDate date,
        @RequestParam(defaultValue="DAY") String session, @Valid @RequestBody Update update) {
        var note = open(accountId, date, session);
        jdbc.queryForObject("SELECT id FROM notebook_note WHERE id=? FOR UPDATE", UUID.class, note.getId());
        // JDBC sees committed Notebook edits even when an entity was already loaded earlier in this transaction.
        var timestamps = jdbc.queryForList("SELECT updated_at FROM notebook_note WHERE id=? AND is_deleted=false", OffsetDateTime.class, note.getId());
        if (timestamps.isEmpty() || update.updatedAt() == null || !timestamps.get(0).toInstant().equals(update.updatedAt().toInstant()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Journal changed or deleted; retain local text and reload");
        var request = new NotebookNoteRequest();
        String html = update.body() == null ? "" : org.jsoup.nodes.Entities.escape(update.body()).replace("\n", "<br>");
        request.setBody(html);
        request.setBodyJson(mapper.createObjectNode().put("format", "html").put("content", html).toString());
        return notes.update(note.getId(), request);
    }
}
