package com.tradevault.controller;

import com.tradevault.dto.backtest.BacktestRunRequest;
import com.tradevault.dto.backtest.BacktestRunResponse;
import com.tradevault.dto.backtest.BacktestTradeResponse;
import com.tradevault.dto.backtest.BacktestTradeSimulateRequest;
import com.tradevault.service.backtest.BacktestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/backtest")
@RequiredArgsConstructor
public class BacktestController {
    private final BacktestService backtestService;

    @PostMapping("/runs")
    public ResponseEntity<BacktestRunResponse> createRun(@Valid @RequestBody BacktestRunRequest request) {
        return ResponseEntity.ok(backtestService.createRun(request));
    }

    @GetMapping("/runs")
    public ResponseEntity<List<BacktestRunResponse>> listRuns() {
        return ResponseEntity.ok(backtestService.listRuns());
    }

    @GetMapping("/runs/{id}")
    public ResponseEntity<BacktestRunResponse> getRun(@PathVariable UUID id) {
        return ResponseEntity.ok(backtestService.getRun(id));
    }

    @GetMapping("/runs/{id}/trades")
    public ResponseEntity<List<BacktestTradeResponse>> listTrades(@PathVariable UUID id) {
        return ResponseEntity.ok(backtestService.listRunTrades(id));
    }

    @PostMapping("/runs/{id}/trades")
    public ResponseEntity<BacktestTradeResponse> simulateTrade(@PathVariable UUID id,
                                                               @Valid @RequestBody BacktestTradeSimulateRequest request) {
        return ResponseEntity.ok(backtestService.simulateTrade(id, request));
    }
}
