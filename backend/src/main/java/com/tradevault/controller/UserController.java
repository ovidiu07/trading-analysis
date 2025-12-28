package com.tradevault.controller;

import com.tradevault.dto.auth.UserDto;
import com.tradevault.dto.user.UserSettingsRequest;
import com.tradevault.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<UserDto> me() {
        return ResponseEntity.ok(userService.getCurrentUserProfile());
    }

    @PutMapping("/me/settings")
    public ResponseEntity<UserDto> updateSettings(@Valid @RequestBody UserSettingsRequest request) {
        return ResponseEntity.ok(userService.updateSettings(request));
    }
}
