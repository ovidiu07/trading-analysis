package com.tradevault.controller;

import com.tradevault.dto.notification.NotificationPreferencesRequest;
import com.tradevault.dto.notification.NotificationPreferencesResponse;
import com.tradevault.service.notification.NotificationPreferencesService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notification-preferences")
@RequiredArgsConstructor
public class NotificationPreferencesController {
    private final NotificationPreferencesService notificationPreferencesService;

    @GetMapping
    public ResponseEntity<NotificationPreferencesResponse> get() {
        return ResponseEntity.ok(notificationPreferencesService.getCurrentUserPreferences());
    }

    @PutMapping
    public ResponseEntity<NotificationPreferencesResponse> update(@Valid @RequestBody NotificationPreferencesRequest request) {
        return ResponseEntity.ok(notificationPreferencesService.updateCurrentUserPreferences(request));
    }
}
