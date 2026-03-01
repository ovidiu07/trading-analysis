package com.tradevault.controller;

import com.tradevault.dto.backtest.BacktestDatasetFileResponse;
import com.tradevault.dto.backtest.BacktestDatasetSetCreateRequest;
import com.tradevault.dto.backtest.BacktestDatasetSetDatasetsResponse;
import com.tradevault.dto.backtest.BacktestDatasetSetResponse;
import com.tradevault.dto.backtest.BacktestLabRunRequest;
import com.tradevault.dto.backtest.BacktestLabRunResponse;
import com.tradevault.dto.backtest.BacktestLabRunResultsResponse;
import com.tradevault.dto.backtest.BacktestCandidateReviewRequest;
import com.tradevault.dto.backtest.BacktestCandidateReviewResponse;
import com.tradevault.dto.backtest.BacktestCandidateSetupResponse;
import com.tradevault.dto.backtest.BacktestOptimizerRunRequest;
import com.tradevault.dto.backtest.BacktestOptimizerRunResponse;
import com.tradevault.dto.backtest.BacktestPlaybookResponse;
import com.tradevault.dto.backtest.BacktestPromotePlaybookRequest;
import com.tradevault.dto.backtest.BacktestRunReportResponse;
import com.tradevault.dto.backtest.BacktestStrategyConfigResponse;
import com.tradevault.dto.backtest.BacktestStrategyConfigUpsertRequest;
import com.tradevault.service.backtest.BacktestLabService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;
import java.util.List;

@RestController
@RequestMapping("/api/backtest")
@RequiredArgsConstructor
public class BacktestLabController {
    private final BacktestLabService backtestLabService;

    @PostMapping("/dataset-sets")
    public ResponseEntity<BacktestDatasetSetResponse> createDatasetSet(@RequestBody(required = false) BacktestDatasetSetCreateRequest request) {
        return ResponseEntity.ok(backtestLabService.createDatasetSet(request));
    }

    @PostMapping("/dataset-sets/{id}/upload-csv")
    public ResponseEntity<BacktestDatasetFileResponse> uploadCsvToSet(@PathVariable UUID id,
                                                                       @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(backtestLabService.uploadCsv(id, file));
    }

    @GetMapping("/dataset-sets/{id}/datasets")
    public ResponseEntity<BacktestDatasetSetDatasetsResponse> listDatasetSetFiles(@PathVariable UUID id) {
        return ResponseEntity.ok(backtestLabService.listDatasets(id));
    }

    @PostMapping("/dataset-sets/{id}/strategy-configs")
    public ResponseEntity<BacktestStrategyConfigResponse> saveStrategyConfig(@PathVariable UUID id,
                                                                             @RequestBody(required = false) BacktestStrategyConfigUpsertRequest request) {
        return ResponseEntity.ok(backtestLabService.saveStrategyConfig(id, request));
    }

    @GetMapping("/strategy-configs/{id}")
    public ResponseEntity<BacktestStrategyConfigResponse> getStrategyConfig(@PathVariable UUID id) {
        return ResponseEntity.ok(backtestLabService.getStrategyConfig(id));
    }

    @PostMapping("/dataset-sets/{id}/runs")
    public ResponseEntity<BacktestLabRunResponse> runDatasetSetBacktest(@PathVariable UUID id,
                                                                         @RequestBody(required = false) BacktestLabRunRequest request) {
        return ResponseEntity.ok(backtestLabService.run(id, request));
    }

    @PostMapping("/dataset-sets/{id}/optimizer/runs")
    public ResponseEntity<BacktestOptimizerRunResponse> runOptimizer(@PathVariable UUID id,
                                                                      @RequestBody(required = false) BacktestOptimizerRunRequest request) {
        return ResponseEntity.ok(backtestLabService.runOptimizer(id, request));
    }

    @GetMapping("/optimizer/runs/{optimizerRunId}")
    public ResponseEntity<BacktestOptimizerRunResponse> getOptimizerRun(@PathVariable UUID optimizerRunId) {
        return ResponseEntity.ok(backtestLabService.getOptimizerRun(optimizerRunId));
    }

    @GetMapping("/runs/{runId}/results")
    public ResponseEntity<BacktestLabRunResultsResponse> getRunResults(@PathVariable UUID runId) {
        return ResponseEntity.ok(backtestLabService.getRunResults(runId));
    }

    @GetMapping("/runs/{runId}/candidates")
    public ResponseEntity<List<BacktestCandidateSetupResponse>> getRunCandidates(@PathVariable UUID runId) {
        return ResponseEntity.ok(backtestLabService.getRunCandidates(runId));
    }

    @PatchMapping("/candidates/{candidateId}/review")
    public ResponseEntity<BacktestCandidateReviewResponse> reviewCandidate(@PathVariable UUID candidateId,
                                                                           @RequestBody(required = false) BacktestCandidateReviewRequest request) {
        return ResponseEntity.ok(backtestLabService.reviewCandidate(candidateId, request));
    }

    @PostMapping("/runs/{runId}/playbook")
    public ResponseEntity<BacktestPlaybookResponse> promoteRunToPlaybook(@PathVariable UUID runId,
                                                                          @RequestBody(required = false) BacktestPromotePlaybookRequest request) {
        return ResponseEntity.ok(backtestLabService.promoteRunToPlaybook(runId, request));
    }

    @GetMapping("/playbooks")
    public ResponseEntity<List<BacktestPlaybookResponse>> listPlaybooks() {
        return ResponseEntity.ok(backtestLabService.listPlaybooks());
    }

    @GetMapping("/playbooks/{playbookId}")
    public ResponseEntity<BacktestPlaybookResponse> getPlaybook(@PathVariable UUID playbookId) {
        return ResponseEntity.ok(backtestLabService.getPlaybook(playbookId));
    }

    @GetMapping("/runs/{runId}/report")
    public ResponseEntity<BacktestRunReportResponse> getRunReport(@PathVariable UUID runId) {
        return ResponseEntity.ok(backtestLabService.getRunReport(runId));
    }
}
