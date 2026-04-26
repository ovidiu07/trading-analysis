package com.tradevault.controller;

import com.tradevault.dto.backtesting.BacktestingListResponse;
import com.tradevault.dto.backtesting.BacktestingScreenshotRequest;
import com.tradevault.dto.backtesting.BacktestingScreenshotResponse;
import com.tradevault.dto.backtesting.BacktestingWorkspaceRequest;
import com.tradevault.dto.backtesting.BacktestingWorkspaceResponse;
import com.tradevault.service.BacktestingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/backtesting")
@RequiredArgsConstructor
public class BacktestingController {
    private final BacktestingService backtestingService;

    @GetMapping("/workspaces")
    public BacktestingListResponse listWorkspaces() {
        return backtestingService.listActiveWorkspaces();
    }

    @PostMapping("/workspaces")
    public BacktestingWorkspaceResponse createWorkspace(@Valid @RequestBody BacktestingWorkspaceRequest request) {
        return backtestingService.createWorkspace(request);
    }

    @GetMapping("/workspaces/{workspaceId}")
    public BacktestingWorkspaceResponse getWorkspace(@PathVariable UUID workspaceId) {
        return backtestingService.getWorkspace(workspaceId);
    }

    @PatchMapping("/workspaces/{workspaceId}")
    public BacktestingWorkspaceResponse updateWorkspace(@PathVariable UUID workspaceId,
                                                        @Valid @RequestBody BacktestingWorkspaceRequest request) {
        return backtestingService.updateWorkspace(workspaceId, request);
    }

    @PostMapping("/workspaces/{workspaceId}/archive")
    public ResponseEntity<Void> archiveWorkspace(@PathVariable UUID workspaceId) {
        backtestingService.archiveWorkspace(workspaceId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/workspaces/{workspaceId}")
    public ResponseEntity<Void> deleteWorkspace(@PathVariable UUID workspaceId) {
        backtestingService.archiveWorkspace(workspaceId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/workspaces/{workspaceId}/screenshots")
    public List<BacktestingScreenshotResponse> listScreenshots(@PathVariable UUID workspaceId) {
        return backtestingService.listScreenshots(workspaceId);
    }

    @PostMapping(value = "/workspaces/{workspaceId}/screenshots", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public List<BacktestingScreenshotResponse> uploadScreenshots(@PathVariable UUID workspaceId,
                                                                 @RequestParam(value = "files", required = false) List<MultipartFile> files,
                                                                 @RequestParam(value = "file", required = false) MultipartFile file) {
        List<MultipartFile> resolved = new ArrayList<>();
        if (files != null) resolved.addAll(files);
        if (file != null) resolved.add(file);
        return backtestingService.uploadScreenshots(workspaceId, resolved);
    }

    @PatchMapping("/screenshots/{screenshotId}")
    public BacktestingScreenshotResponse updateScreenshot(@PathVariable UUID screenshotId,
                                                          @RequestBody BacktestingScreenshotRequest request) {
        return backtestingService.updateScreenshot(screenshotId, request);
    }

    @DeleteMapping("/screenshots/{screenshotId}")
    public ResponseEntity<Void> deleteScreenshot(@PathVariable UUID screenshotId) {
        backtestingService.deleteScreenshot(screenshotId);
        return ResponseEntity.noContent().build();
    }
}
