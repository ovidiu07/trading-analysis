package com.tradevault.controller;

import com.tradevault.domain.enums.ChartProfileScope;
import com.tradevault.dto.chartprofile.ChartProfileRequest;
import com.tradevault.dto.chartprofile.ChartProfileResponse;
import com.tradevault.dto.chartprofile.ChartProfileUpdateRequest;
import com.tradevault.service.ChartProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/chart-profiles")
@RequiredArgsConstructor
public class ChartProfileController {
    private final ChartProfileService chartProfileService;

    @GetMapping
    public List<ChartProfileResponse> list(@RequestParam(name = "scope", required = false) ChartProfileScope scope) {
        return chartProfileService.listProfiles(scope);
    }

    @PostMapping
    public ResponseEntity<ChartProfileResponse> create(@Valid @RequestBody ChartProfileRequest request) {
        return ResponseEntity.ok(chartProfileService.createProfile(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ChartProfileResponse> update(@PathVariable UUID id,
                                                       @RequestBody ChartProfileUpdateRequest request) {
        return ResponseEntity.ok(chartProfileService.updateProfile(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        chartProfileService.deleteProfile(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/set-default")
    public ResponseEntity<ChartProfileResponse> setDefault(@PathVariable UUID id) {
        return ResponseEntity.ok(chartProfileService.setDefault(id));
    }
}
