package com.tradevault.controller;

import com.tradevault.dto.auth.AuthResponse;
import com.tradevault.dto.auth.LoginRequest;
import com.tradevault.dto.auth.RegisterRequest;
import com.tradevault.dto.auth.UserDto;
import com.tradevault.service.AuthService;
import com.tradevault.service.CurrentUserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;
    private final CurrentUserService currentUserService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/me")
    public ResponseEntity<UserDto> me() {
        return ResponseEntity.ok(UserDto.from(currentUserService.getCurrentUser()));
    }
}
