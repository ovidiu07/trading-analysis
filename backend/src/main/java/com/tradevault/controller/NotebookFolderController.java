package com.tradevault.controller;

import com.tradevault.dto.notebook.NotebookFolderRequest;
import com.tradevault.dto.notebook.NotebookFolderResponse;
import com.tradevault.service.NotebookFolderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notebook/folders")
@RequiredArgsConstructor
public class NotebookFolderController {
    private final NotebookFolderService folderService;

    @GetMapping
    public List<NotebookFolderResponse> list() {
        return folderService.list();
    }

    @PostMapping
    public ResponseEntity<NotebookFolderResponse> create(@RequestBody NotebookFolderRequest request) {
        return ResponseEntity.ok(folderService.create(request));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<NotebookFolderResponse> update(@PathVariable UUID id,
                                                         @RequestBody NotebookFolderRequest request) {
        return ResponseEntity.ok(folderService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        folderService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
