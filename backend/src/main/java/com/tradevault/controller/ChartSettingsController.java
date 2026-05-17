package com.tradevault.controller;

import com.tradevault.dto.chartsettings.ChartSettingsRequest;
import com.tradevault.dto.chartsettings.ChartSettingsResponse;
import com.tradevault.service.ChartSettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class ChartSettingsController {
    private final ChartSettingsService chartSettingsService;

    @GetMapping("/api/chart-settings")
    public ChartSettingsResponse getEffectiveChartSettings() {
        return chartSettingsService.getEffectiveSettings();
    }

    @GetMapping("/api/admin/chart-settings")
    @PreAuthorize("hasRole('ADMIN')")
    public ChartSettingsResponse getAdminChartSettings() {
        return chartSettingsService.getEffectiveSettings();
    }

    @PutMapping("/api/admin/chart-settings")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ChartSettingsResponse> updateAdminChartSettings(@RequestBody ChartSettingsRequest request) {
        return ResponseEntity.ok(chartSettingsService.update(request));
    }
}
