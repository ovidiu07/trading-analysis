package com.tradevault.controller;

import com.tradevault.dto.backtesting.BacktestingListResponse;
import com.tradevault.dto.backtesting.BacktestingAnalyticsResponse;
import com.tradevault.dto.backtesting.BacktestingEdgeLensRequest;
import com.tradevault.dto.backtesting.BacktestingEdgeLensResponse;
import com.tradevault.dto.backtesting.BacktestingImportResponse;
import com.tradevault.dto.backtesting.BacktestingScreenshotRequest;
import com.tradevault.dto.backtesting.BacktestingScreenshotResponse;
import com.tradevault.dto.backtesting.BacktestingTradeRequest;
import com.tradevault.dto.backtesting.BacktestingTradeResponse;
import com.tradevault.dto.backtesting.BacktestingWorkspaceRequest;
import com.tradevault.dto.backtesting.BacktestingWorkspaceResponse;
import com.tradevault.dto.backtesting.BacktestingEvidenceResponse;
import com.tradevault.dto.backtesting.BacktestingEvidenceUpdateRequest;
import com.tradevault.dto.backtesting.BacktestingResearchInboxResponse;
import com.tradevault.service.BacktestingResearchService;
import com.tradevault.service.BacktestingService;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.backtesting.LiveTradeEvidenceSyncService;
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
    private final BacktestingResearchService researchService;
    private final LiveTradeEvidenceSyncService evidenceSyncService;
    private final CurrentUserService currentUserService;

    @GetMapping("/workspaces")
    public BacktestingListResponse listWorkspaces(
            @RequestParam(value = "includeArchived", defaultValue = "false") boolean includeArchived) {
        return backtestingService.listWorkspaces(includeArchived);
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

    @PostMapping("/workspaces/{workspaceId}/restore")
    public BacktestingWorkspaceResponse restoreWorkspace(@PathVariable UUID workspaceId) {
        return backtestingService.restoreWorkspace(workspaceId);
    }

    @GetMapping("/research-inbox")
    public BacktestingResearchInboxResponse researchInbox() {
        return evidenceSyncService.researchInbox(currentUserService.getCurrentUser().getId());
    }

    @PatchMapping("/evidence/{evidenceId}")
    public BacktestingEvidenceResponse updateEvidence(@PathVariable UUID evidenceId,
                                                      @RequestBody BacktestingEvidenceUpdateRequest request) {
        return evidenceSyncService.updateEvidence(evidenceId, currentUserService.getCurrentUser().getId(), request);
    }

    @PostMapping("/evidence/{evidenceId}/retry")
    public BacktestingEvidenceResponse retryEvidence(@PathVariable UUID evidenceId) {
        return evidenceSyncService.retry(evidenceId, currentUserService.getCurrentUser().getId());
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

    @GetMapping("/workspaces/{workspaceId}/trades")
    public List<BacktestingTradeResponse> listTrades(@PathVariable UUID workspaceId) {
        return researchService.listTrades(workspaceId);
    }

    @PostMapping("/workspaces/{workspaceId}/trades")
    public BacktestingTradeResponse createTrade(@PathVariable UUID workspaceId,
                                                @Valid @RequestBody BacktestingTradeRequest request) {
        return researchService.createTrade(workspaceId, request);
    }

    @PatchMapping("/trades/{tradeId}")
    public BacktestingTradeResponse updateTrade(@PathVariable UUID tradeId,
                                                @Valid @RequestBody BacktestingTradeRequest request) {
        return researchService.updateTrade(tradeId, request);
    }

    @DeleteMapping("/trades/{tradeId}")
    public ResponseEntity<Void> deleteTrade(@PathVariable UUID tradeId) {
        researchService.deleteTrade(tradeId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/workspaces/{workspaceId}/trades/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public BacktestingImportResponse importTrades(@PathVariable UUID workspaceId,
                                                  @RequestParam("file") MultipartFile file) {
        return researchService.importCsv(workspaceId, file);
    }

    @GetMapping("/workspaces/{workspaceId}/analytics")
    public BacktestingAnalyticsResponse analytics(@PathVariable UUID workspaceId) {
        return researchService.analytics(workspaceId);
    }

    @GetMapping("/workspaces/{workspaceId}/edge-lenses")
    public List<BacktestingEdgeLensResponse> listEdgeLenses(@PathVariable UUID workspaceId) {
        return researchService.listEdgeLenses(workspaceId);
    }

    @PostMapping("/workspaces/{workspaceId}/edge-lenses")
    public BacktestingEdgeLensResponse createEdgeLens(@PathVariable UUID workspaceId,
                                                      @Valid @RequestBody BacktestingEdgeLensRequest request) {
        return researchService.createEdgeLens(workspaceId, request);
    }

    @PatchMapping("/edge-lenses/{lensId}")
    public BacktestingEdgeLensResponse updateEdgeLens(@PathVariable UUID lensId,
                                                      @Valid @RequestBody BacktestingEdgeLensRequest request) {
        return researchService.updateEdgeLens(lensId, request);
    }

    @PostMapping("/edge-lenses/{lensId}/recalculate")
    public BacktestingEdgeLensResponse recalculateEdgeLens(@PathVariable UUID lensId) {
        return researchService.recalculateEdgeLens(lensId);
    }

    @DeleteMapping("/edge-lenses/{lensId}")
    public ResponseEntity<Void> deleteEdgeLens(@PathVariable UUID lensId) {
        researchService.deleteEdgeLens(lensId);
        return ResponseEntity.noContent().build();
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

    @PostMapping("/screenshots/{screenshotId}/detach-trade")
    public BacktestingScreenshotResponse detachScreenshotTrade(@PathVariable UUID screenshotId) {
        return backtestingService.detachScreenshotTrade(screenshotId);
    }

    @DeleteMapping("/screenshots/{screenshotId}")
    public ResponseEntity<Void> deleteScreenshot(@PathVariable UUID screenshotId) {
        backtestingService.deleteScreenshot(screenshotId);
        return ResponseEntity.noContent().build();
    }
}
