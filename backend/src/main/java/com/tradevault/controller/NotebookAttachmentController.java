package com.tradevault.controller;

import com.tradevault.dto.notebook.NotebookAttachmentResponse;
import com.tradevault.service.NotebookAttachmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notebook/attachments")
@RequiredArgsConstructor
public class NotebookAttachmentController {
    private final NotebookAttachmentService attachmentService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<NotebookAttachmentResponse> upload(@RequestParam("noteId") UUID noteId,
                                                             @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(attachmentService.upload(noteId, file));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> download(@PathVariable UUID id) {
        return attachmentService.download(id);
    }

    @GetMapping
    public List<NotebookAttachmentResponse> list(@RequestParam("noteId") UUID noteId) {
        return attachmentService.listByNote(noteId);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        attachmentService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
