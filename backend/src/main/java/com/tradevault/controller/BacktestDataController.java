package com.tradevault.controller;

import com.tradevault.dto.backtest.BacktestDatasetResponse;
import com.tradevault.dto.backtest.BacktestDatasetSummaryResponse;
import com.tradevault.dto.backtest.BacktestCandlesResponse;
import com.tradevault.dto.backtest.CsvIngestRequest;
import com.tradevault.dto.backtest.CsvIngestResponse;
import com.tradevault.dto.backtest.CsvUploadResponse;
import com.tradevault.dto.backtest.OandaConnectRequest;
import com.tradevault.dto.backtest.ProviderConnectionStatusResponse;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.backtest.BacktestService;
import com.tradevault.service.backtest.BacktestCsvService;
import com.tradevault.service.backtest.BacktestDatasetService;
import com.tradevault.service.backtest.BacktestDemoService;
import com.tradevault.service.backtest.BacktestProviderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
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
    private final BacktestService backtestService;

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

    @GetMapping("/datasets/{id}")
    public ResponseEntity<BacktestDatasetResponse> getDataset(@PathVariable UUID id) {
        UUID userId = currentUserService.getCurrentUser().getId();
        return ResponseEntity.ok(backtestDatasetService.getDataset(userId, id));
    }

    @GetMapping("/datasets/{id}/summary")
    public ResponseEntity<BacktestDatasetSummaryResponse> getDatasetSummary(@PathVariable UUID id) {
        UUID userId = currentUserService.getCurrentUser().getId();
        return ResponseEntity.ok(backtestDatasetService.getDatasetSummary(userId, id));
    }

    @GetMapping("/candles")
    public ResponseEntity<BacktestCandlesResponse> getCandles(
            @RequestParam(name = "datasetId", required = false) UUID datasetId,
            @RequestParam(name = "provider", required = false) String provider,
            @RequestParam(name = "dataSource", required = false) String dataSource,
            @RequestParam(name = "sourceId", required = false) String sourceId,
            @RequestParam(name = "symbol", required = false) String symbol,
            @RequestParam(name = "timeframe", required = false) String timeframe,
            @RequestParam(name = "fromUtc", required = false) String fromUtc,
            @RequestParam(name = "toUtc", required = false) String toUtc,
            @RequestParam(name = "from", required = false) String from,
            @RequestParam(name = "to", required = false) String to,
            @RequestParam(name = "sessionWindow", required = false) String sessionWindow,
            @RequestParam(name = "limit", required = false) Integer limit,
            @RequestParam(name = "refresh", required = false, defaultValue = "false") boolean refresh
    ) {
        String resolvedSource = dataSource != null ? dataSource : provider;
        String fromRaw = (fromUtc != null && !fromUtc.isBlank()) ? fromUtc : from;
        String toRaw = (toUtc != null && !toUtc.isBlank()) ? toUtc : to;
        OffsetDateTime parsedFromUtc = parseRangeBoundary(fromRaw, false);
        OffsetDateTime parsedToUtc = parseRangeBoundary(toRaw, true);
        return ResponseEntity.ok(backtestService.loadCandles(
                resolvedSource,
                datasetId,
                sourceId,
                symbol,
                timeframe,
                parsedFromUtc,
                parsedToUtc,
                sessionWindow,
                limit,
                refresh
        ));
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

    private OffsetDateTime parseRangeBoundary(String raw, boolean endOfDay) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String value = raw.trim();
        try {
            return OffsetDateTime.parse(value).withOffsetSameInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException ignored) {
            // continue
        }
        try {
            return LocalDateTime.parse(value).atOffset(ZoneOffset.UTC);
        } catch (DateTimeParseException ignored) {
            // continue
        }
        try {
            LocalDate parsedDate = LocalDate.parse(value);
            LocalTime boundary = endOfDay ? LocalTime.of(23, 59, 59, 999_000_000) : LocalTime.MIN;
            return parsedDate.atTime(boundary).atOffset(ZoneOffset.UTC);
        } catch (DateTimeParseException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date value: " + value);
        }
    }
}
