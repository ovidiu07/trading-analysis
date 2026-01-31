package com.tradevault.controller;

import com.tradevault.domain.enums.NotebookNoteType;
import com.tradevault.dto.notebook.NotebookTemplateRequest;
import com.tradevault.dto.notebook.NotebookTemplateResponse;
import com.tradevault.service.NotebookTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notebook/templates")
@RequiredArgsConstructor
public class NotebookTemplateController {
    private final NotebookTemplateService templateService;

    @GetMapping
    public List<NotebookTemplateResponse> list(@RequestParam(required = false) NotebookNoteType type) {
        return templateService.list(type);
    }

    @PostMapping
    public ResponseEntity<NotebookTemplateResponse> create(@RequestBody NotebookTemplateRequest request) {
        return ResponseEntity.ok(templateService.create(request));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<NotebookTemplateResponse> update(@PathVariable UUID id,
                                                           @RequestBody NotebookTemplateRequest request) {
        return ResponseEntity.ok(templateService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        templateService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
