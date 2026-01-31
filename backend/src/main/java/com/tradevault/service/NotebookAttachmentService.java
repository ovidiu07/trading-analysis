package com.tradevault.service;

import com.tradevault.domain.entity.NotebookAttachment;
import com.tradevault.domain.entity.NotebookNote;
import com.tradevault.domain.entity.User;
import com.tradevault.dto.notebook.NotebookAttachmentResponse;
import com.tradevault.repository.NotebookAttachmentRepository;
import com.tradevault.repository.NotebookNoteRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotebookAttachmentService {
    private final NotebookAttachmentRepository attachmentRepository;
    private final NotebookNoteRepository noteRepository;
    private final CurrentUserService currentUserService;

    @Value("${app.upload-dir:uploads}")
    private String uploadDir;

    @Transactional
    public NotebookAttachmentResponse upload(UUID noteId, MultipartFile file) throws IOException {
        User user = currentUserService.getCurrentUser();
        NotebookNote note = noteRepository.findByIdAndUserId(noteId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Note not found"));

        String original = StringUtils.cleanPath(file.getOriginalFilename() == null ? "attachment" : file.getOriginalFilename());
        String fileName = UUID.randomUUID() + "-" + original.replaceAll("[\\\\/]", "_");
        Path directory = Paths.get(uploadDir, "notebook", user.getId().toString(), note.getId().toString());
        Files.createDirectories(directory);
        Path destination = directory.resolve(fileName);
        Files.copy(file.getInputStream(), destination);

        NotebookAttachment attachment = NotebookAttachment.builder()
                .user(user)
                .note(note)
                .fileName(original)
                .mimeType(file.getContentType())
                .sizeBytes(file.getSize())
                .storageKey(directory.resolve(fileName).toString())
                .build();
        NotebookAttachment saved = attachmentRepository.save(attachment);
        return toResponse(saved);
    }

    public NotebookAttachment getAttachment(UUID id) {
        User user = currentUserService.getCurrentUser();
        return attachmentRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Attachment not found"));
    }

    public Resource download(UUID id) {
        NotebookAttachment attachment = getAttachment(id);
        return new FileSystemResource(attachment.getStorageKey());
    }

    public List<NotebookAttachmentResponse> listByNote(UUID noteId) {
        User user = currentUserService.getCurrentUser();
        NotebookNote note = noteRepository.findByIdAndUserId(noteId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Note not found"));
        return attachmentRepository.findByNoteId(note.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void delete(UUID id) throws IOException {
        User user = currentUserService.getCurrentUser();
        NotebookAttachment attachment = attachmentRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Attachment not found"));
        Path path = Paths.get(attachment.getStorageKey());
        attachmentRepository.delete(attachment);
        Files.deleteIfExists(path);
    }

    private NotebookAttachmentResponse toResponse(NotebookAttachment attachment) {
        return NotebookAttachmentResponse.builder()
                .id(attachment.getId())
                .noteId(attachment.getNote().getId())
                .fileName(attachment.getFileName())
                .mimeType(attachment.getMimeType())
                .sizeBytes(attachment.getSizeBytes())
                .downloadUrl("/api/notebook/attachments/" + attachment.getId())
                .createdAt(attachment.getCreatedAt())
                .build();
    }
}
