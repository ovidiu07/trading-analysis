package com.tradevault.controller;

import com.tradevault.dto.diagnostics.DiagnosticsStrategiesResponse;
import com.tradevault.dto.diagnostics.DiagnosticsStrategyDetailResponse;
import com.tradevault.dto.diagnostics.DiagnosticsReportsResponse;
import com.tradevault.dto.diagnostics.LiveDiagnosticsSummaryResponse;
import com.tradevault.service.DiagnosticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/diagnostics")
@RequiredArgsConstructor
public class DiagnosticsController {
    private final DiagnosticsService diagnosticsService;

    @GetMapping("/strategies")
    public DiagnosticsStrategiesResponse listStrategies() {
        return diagnosticsService.listStrategies();
    }

    @GetMapping("/strategy/{id}")
    public DiagnosticsStrategyDetailResponse strategyDetail(
            @PathVariable UUID id,
            @RequestParam(required = false) String mode,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String symbol,
            @RequestParam(name = "sessionWindow", required = false) String sessionWindow,
            @RequestParam(name = "backtestSource", required = false) String backtestSource
    ) {
        return diagnosticsService.getStrategyDetail(id, mode, from, to, symbol, sessionWindow, backtestSource);
    }

    @GetMapping("/reports")
    public DiagnosticsReportsResponse listReports(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String instrument,
            @RequestParam(required = false) String strategyName
    ) {
        return diagnosticsService.listReports(from, to, instrument, strategyName);
    }

    @GetMapping("/live-summary")
    public LiveDiagnosticsSummaryResponse liveSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String symbol,
            @RequestParam(name = "sessionWindow", required = false) String sessionWindow
    ) {
        return diagnosticsService.getLiveSummary(from, to, symbol, sessionWindow);
    }
}
