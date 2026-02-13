package com.tradevault.controller;

import com.tradevault.domain.enums.AssetScope;
import com.tradevault.dto.asset.AssetResponse;
import com.tradevault.dto.asset.AssetUploadRequest;
import com.tradevault.service.AssetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/assets")
@RequiredArgsConstructor
public class AssetController {
    private final AssetService assetService;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AssetResponse> upload(@RequestParam("file") MultipartFile file,
                                                @RequestParam("scope") AssetScope scope,
                                                @RequestParam(value = "contentId", required = false) UUID contentId,
                                                @RequestParam(value = "noteId", required = false) UUID noteId,
                                                @RequestParam(value = "sortOrder", required = false) Integer sortOrder) {
        AssetUploadRequest request = new AssetUploadRequest();
        request.setScope(scope);
        request.setContentId(contentId);
        request.setNoteId(noteId);
        request.setSortOrder(sortOrder);
        return ResponseEntity.ok(assetService.upload(file, request));
    }

    @GetMapping("/content/{contentId}")
    public List<AssetResponse> listContentAssets(@PathVariable UUID contentId) {
        return assetService.listByContent(contentId);
    }

    @GetMapping("/notebook/{noteId}")
    public List<AssetResponse> listNotebookAssets(@PathVariable UUID noteId) {
        return assetService.listByNote(noteId);
    }

    @DeleteMapping("/{assetId}")
    public ResponseEntity<Void> deleteAsset(@PathVariable UUID assetId) {
        assetService.deleteAsset(assetId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{assetId}/download")
    public ResponseEntity<?> download(@PathVariable UUID assetId) {
        return assetService.download(assetId, false);
    }

    @GetMapping("/{assetId}/view")
    public ResponseEntity<?> view(@PathVariable UUID assetId) {
        return assetService.download(assetId, true);
    }
}
