package com.tradevault.controller;

import com.tradevault.dto.signalintel.SignalIngestionResponse;
import com.tradevault.dto.signalintel.TradingViewSignalCloseRequest;
import com.tradevault.dto.signalintel.TradingViewSignalOpenRequest;
import com.tradevault.dto.signalintel.TradingViewWebhookSecretResetResponse;
import com.tradevault.dto.signalintel.TradingViewWebhookSettingsResponse;
import com.tradevault.dto.signalintel.TradingViewWebhookSettingsUpdateRequest;
import com.tradevault.service.signalintel.TradingViewSettingsService;
import com.tradevault.service.signalintel.TradingViewSignalIngestionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/integrations/tradingview")
@RequiredArgsConstructor
public class TradingViewIntegrationController {
    private final TradingViewSignalIngestionService tradingViewSignalIngestionService;
    private final TradingViewSettingsService tradingViewSettingsService;

    @PostMapping("/signals/open")
    public ResponseEntity<SignalIngestionResponse> open(@Valid @RequestBody TradingViewSignalOpenRequest request,
                                                        @RequestParam(name = "token", required = false) String token) {
        return ResponseEntity.ok(tradingViewSignalIngestionService.ingestOpen(request, token));
    }

    @PostMapping("/signals/close")
    public ResponseEntity<SignalIngestionResponse> close(@Valid @RequestBody TradingViewSignalCloseRequest request,
                                                         @RequestParam(name = "token", required = false) String token) {
        return ResponseEntity.ok(tradingViewSignalIngestionService.ingestClose(request, token));
    }

    @GetMapping("/settings")
    public ResponseEntity<TradingViewWebhookSettingsResponse> settings() {
        return ResponseEntity.ok(tradingViewSettingsService.getSettings());
    }

    @PutMapping("/settings")
    public ResponseEntity<TradingViewWebhookSettingsResponse> updateSettings(
            @Valid @RequestBody TradingViewWebhookSettingsUpdateRequest request) {
        return ResponseEntity.ok(tradingViewSettingsService.updateSettings(request));
    }

    @PostMapping("/settings/reset-secret")
    public ResponseEntity<TradingViewWebhookSecretResetResponse> resetSecret() {
        return ResponseEntity.ok(tradingViewSettingsService.resetSecret());
    }
}
