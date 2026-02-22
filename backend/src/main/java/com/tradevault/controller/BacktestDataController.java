package com.tradevault.controller;

import com.tradevault.dto.backtest.BacktestDatasetResponse;
import com.tradevault.dto.backtest.CsvIngestRequest;
import com.tradevault.dto.backtest.CsvIngestResponse;
import com.tradevault.dto.backtest.CsvUploadResponse;
import com.tradevault.dto.backtest.OandaConnectRequest;
import com.tradevault.dto.backtest.ProviderConnectionStatusResponse;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.backtest.BacktestCsvService;
import com.tradevault.service.backtest.BacktestDatasetService;
import com.tradevault.service.backtest.BacktestDemoService;
import com.tradevault.service.backtest.BacktestProviderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/backtest")
@RequiredArgsConstructor
public class BacktestDataController {
    private final CurrentUserService currentUserService;
    private final BacktestCsvService backtestCsvService;
    private final BacktestDatasetService backtestDatasetService;
    private final BacktestProviderService backtestProviderService;
    private final BacktestDemoService backtestDemoService;

    @PostMapping("/csv/upload")
    public ResponseEntity<CsvUploadResponse> uploadCsv(@RequestParam("file") MultipartFile file) {
        var user = currentUserService.getCurrentUser();
        return ResponseEntity.ok(backtestCsvService.upload(user, file));
    }

    @PostMapping("/csv/ingest")
    public ResponseEntity<CsvIngestResponse> ingestCsv(@RequestParam("fileId") UUID fileId,
                                                       @RequestBody(required = false) CsvIngestRequest request) {
        var user = currentUserService.getCurrentUser();
        CsvIngestRequest safeRequest = request == null ? new CsvIngestRequest() : request;
        return ResponseEntity.ok(backtestCsvService.ingest(user, fileId, safeRequest));
    }

    @GetMapping("/datasets")
    public ResponseEntity<List<BacktestDatasetResponse>> listDatasets() {
        UUID userId = currentUserService.getCurrentUser().getId();
        return ResponseEntity.ok(backtestDatasetService.listDatasets(userId));
    }

    @DeleteMapping("/datasets/{id}")
    public ResponseEntity<Void> deleteDataset(@PathVariable UUID id) {
        UUID userId = currentUserService.getCurrentUser().getId();
        backtestDatasetService.deleteDataset(userId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/providers/oanda/status")
    public ResponseEntity<ProviderConnectionStatusResponse> oandaStatus() {
        UUID userId = currentUserService.getCurrentUser().getId();
        return ResponseEntity.ok(backtestProviderService.getOandaStatus(userId));
    }

    @PostMapping("/providers/oanda/test")
    public ResponseEntity<ProviderConnectionStatusResponse> testOanda(@Valid @RequestBody OandaConnectRequest request) {
        return ResponseEntity.ok(backtestProviderService.testOanda(request.getToken()));
    }

    @PostMapping("/providers/oanda/connect")
    public ResponseEntity<ProviderConnectionStatusResponse> connectOanda(@Valid @RequestBody OandaConnectRequest request) {
        var user = currentUserService.getCurrentUser();
        return ResponseEntity.ok(backtestProviderService.connectOanda(user, request.getToken()));
    }

    @DeleteMapping("/providers/oanda")
    public ResponseEntity<Void> disconnectOanda() {
        UUID userId = currentUserService.getCurrentUser().getId();
        backtestProviderService.disconnectOanda(userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/demo/load")
    public ResponseEntity<List<BacktestDatasetResponse>> loadDemo() {
        var user = currentUserService.getCurrentUser();
        return ResponseEntity.ok(backtestDemoService.ensureDemoDatasets(user));
    }

    @PostMapping("/demo/reset")
    public ResponseEntity<Void> resetDemo() {
        UUID userId = currentUserService.getCurrentUser().getId();
        backtestDemoService.resetDemo(userId);
        return ResponseEntity.noContent().build();
    }
}
