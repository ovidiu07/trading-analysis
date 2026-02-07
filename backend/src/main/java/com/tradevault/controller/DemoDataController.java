package com.tradevault.controller;

import com.tradevault.dto.demo.DemoRemovalResponse;
import com.tradevault.dto.demo.DemoStatusResponse;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.DemoDataService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class DemoDataController {

    private final DemoDataService demoDataService;
    private final CurrentUserService currentUserService;

    @GetMapping("/demo-status")
    public ResponseEntity<DemoStatusResponse> demoStatus() {
        UUID userId = currentUserService.getCurrentUser().getId();
        return ResponseEntity.ok(demoDataService.getDemoStatusForUser(userId));
    }

    @PostMapping("/demo/remove")
    public ResponseEntity<DemoRemovalResponse> removeDemoData() {
        UUID userId = currentUserService.getCurrentUser().getId();
        return ResponseEntity.ok(demoDataService.removeDemoDataForUser(userId));
    }
}
