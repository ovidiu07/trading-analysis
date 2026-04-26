package com.tradevault.controller;

import com.tradevault.domain.enums.PlanScope;
import com.tradevault.dto.plan.PlanImageResponse;
import com.tradevault.service.PlanImageService;
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

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/today/session/plans/{scope}/images")
@RequiredArgsConstructor
public class PlanImageController {
    private final PlanImageService planImageService;

    @GetMapping
    public List<PlanImageResponse> listImages(@PathVariable PlanScope scope) {
        return planImageService.listImages(scope);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public List<PlanImageResponse> uploadImages(@PathVariable PlanScope scope,
                                                @RequestParam(value = "files", required = false) List<MultipartFile> files,
                                                @RequestParam(value = "file", required = false) MultipartFile file) {
        List<MultipartFile> resolved = new ArrayList<>();
        if (files != null) {
            resolved.addAll(files);
        }
        if (file != null) {
            resolved.add(file);
        }
        return planImageService.uploadImages(scope, resolved);
    }

    @DeleteMapping("/{imageId}")
    public ResponseEntity<Void> deleteImage(@PathVariable PlanScope scope,
                                            @PathVariable UUID imageId) {
        planImageService.deleteImage(scope, imageId);
        return ResponseEntity.noContent().build();
    }
}
