package com.tradevault.controller;

import com.tradevault.dto.notebook.NotebookTagRequest;
import com.tradevault.dto.notebook.NotebookTagResponse;
import com.tradevault.service.NotebookTagService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notebook/tags")
@RequiredArgsConstructor
public class NotebookTagController {
    private final NotebookTagService tagService;

    @GetMapping
    public List<NotebookTagResponse> list() {
        return tagService.list();
    }

    @PostMapping
    public ResponseEntity<NotebookTagResponse> create(@RequestBody NotebookTagRequest request) {
        return ResponseEntity.ok(tagService.create(request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        tagService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
