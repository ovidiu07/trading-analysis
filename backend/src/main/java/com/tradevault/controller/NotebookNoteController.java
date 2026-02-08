package com.tradevault.controller;

import com.tradevault.domain.enums.NotebookNoteType;
import com.tradevault.dto.notebook.NotebookNoteRequest;
import com.tradevault.dto.notebook.NotebookNoteResponse;
import com.tradevault.dto.notebook.NotebookNoteSummaryResponse;
import com.tradevault.service.NotebookNoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notebook/notes")
@RequiredArgsConstructor
public class NotebookNoteController {
    private final NotebookNoteService noteService;

    @GetMapping
    public List<NotebookNoteResponse> list(@RequestParam(required = false) UUID folderId,
                                           @RequestParam(required = false) NotebookNoteType type,
                                           @RequestParam(required = false) String q,
                                           @RequestParam(required = false) List<UUID> tagIds,
                                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                           @RequestParam(required = false) String sort) {
        return noteService.list(folderId, type, q, tagIds, from, to, sort);
    }

    @GetMapping("/by-date")
    public List<NotebookNoteSummaryResponse> listByDate(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return noteService.listByDate(from, to);
    }

    @GetMapping("/{id}")
    public NotebookNoteResponse get(@PathVariable UUID id) {
        return noteService.get(id);
    }

    @PostMapping
    public ResponseEntity<NotebookNoteResponse> create(@RequestBody NotebookNoteRequest request) {
        return ResponseEntity.ok(noteService.create(request));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<NotebookNoteResponse> update(@PathVariable UUID id,
                                                       @RequestBody NotebookNoteRequest request) {
        return ResponseEntity.ok(noteService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        noteService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<NotebookNoteResponse> restore(@PathVariable UUID id) {
        return ResponseEntity.ok(noteService.restore(id));
    }

    @PostMapping("/{id}/tags")
    public ResponseEntity<NotebookNoteResponse> replaceTags(@PathVariable UUID id,
                                                            @RequestBody List<UUID> tagIds) {
        return ResponseEntity.ok(noteService.updateTags(id, tagIds));
    }
}
