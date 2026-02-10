package com.tradevault.service;

import com.tradevault.domain.enums.AssetScope;
import com.tradevault.dto.asset.AssetUploadRequest;
import com.tradevault.dto.notebook.NotebookAttachmentResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotebookAttachmentService {
    private final AssetService assetService;

    @Transactional
    public NotebookAttachmentResponse upload(UUID noteId, MultipartFile file) {
        AssetUploadRequest request = new AssetUploadRequest();
        request.setScope(AssetScope.NOTEBOOK);
        request.setNoteId(noteId);
        var asset = assetService.upload(file, request);
        return toResponse(asset);
    }

    public ResponseEntity<?> download(UUID id) {
        return assetService.download(id, false);
    }

    public List<NotebookAttachmentResponse> listByNote(UUID noteId) {
        return assetService.listByNote(noteId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void delete(UUID id) {
        assetService.deleteAsset(id);
    }

    private NotebookAttachmentResponse toResponse(com.tradevault.dto.asset.AssetResponse asset) {
        return NotebookAttachmentResponse.builder()
                .id(asset.getId())
                .noteId(asset.getNoteId())
                .fileName(asset.getOriginalFileName())
                .mimeType(asset.getContentType())
                .sizeBytes(asset.getSizeBytes())
                .url(asset.getUrl())
                .downloadUrl(asset.getDownloadUrl())
                .viewUrl(asset.getViewUrl())
                .thumbnailUrl(asset.getThumbnailUrl())
                .image(asset.isImage())
                .createdAt(asset.getCreatedAt())
                .build();
    }

}
