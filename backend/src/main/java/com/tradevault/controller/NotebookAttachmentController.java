package com.tradevault.controller;

import com.tradevault.dto.notebook.NotebookAttachmentResponse;
import com.tradevault.service.NotebookAttachmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notebook/attachments")
@RequiredArgsConstructor
public class NotebookAttachmentController {
    private final NotebookAttachmentService attachmentService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<NotebookAttachmentResponse> upload(@RequestParam("noteId") UUID noteId,
                                                             @RequestParam("file") MultipartFile file) throws IOException {
        return ResponseEntity.ok(attachmentService.upload(noteId, file));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Resource> download(@PathVariable UUID id) {
        var attachment = attachmentService.getAttachment(id);
        Resource resource = attachmentService.download(id);
        String filename = attachment.getFileName() != null ? attachment.getFileName() : "attachment";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(resource);
    }

    @GetMapping
    public List<NotebookAttachmentResponse> list(@RequestParam("noteId") UUID noteId) {
        return attachmentService.listByNote(noteId);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) throws IOException {
        attachmentService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
