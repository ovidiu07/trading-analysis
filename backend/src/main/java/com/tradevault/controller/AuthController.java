package com.tradevault.controller;

import com.tradevault.dto.auth.*;
import com.tradevault.service.AuthService;
import com.tradevault.service.UserService;
import jakarta.servlet.http.Cookie;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private static final String REFRESH_COOKIE = "tradejaudit_rt";
    private final AuthService authService;
    private final UserService userService;

    @PostMapping("/register")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request,
                                                     HttpServletRequest httpRequest) {
        String ipAddress = resolveIp(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");
        return ResponseEntity.ok(authService.register(request, ipAddress, userAgent));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request,
                                              HttpServletRequest httpRequest) {
        AuthSessionResult session = authService.login(request);
        return withRefreshCookie(session, httpRequest, false);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(HttpServletRequest request) {
        String refreshToken = resolveRefreshToken(request);
        AuthSessionResult session = authService.refresh(refreshToken);
        return withRefreshCookie(session, request, false);
    }

    @PostMapping("/logout")
    public ResponseEntity<SuccessResponse> logout(HttpServletRequest request) {
        authService.logout(resolveRefreshToken(request));
        ResponseCookie cookie = buildRefreshCookie("", request, true);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(new SuccessResponse(true));
    }

    @PostMapping("/verify-email")
    public ResponseEntity<SuccessResponse> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        return ResponseEntity.ok(authService.verifyEmail(request));
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<SuccessResponse> resendVerification(@Valid @RequestBody ResendVerificationRequest request,
                                                              HttpServletRequest httpRequest) {
        String ipAddress = resolveIp(httpRequest);
        return ResponseEntity.ok(authService.resendVerification(request, ipAddress));
    }

    @PostMapping("/change-password")
    public ResponseEntity<SuccessResponse> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        return ResponseEntity.ok(authService.changePassword(request));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<SuccessResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request,
                                                          HttpServletRequest httpRequest) {
        String ipAddress = resolveIp(httpRequest);
        return ResponseEntity.ok(authService.forgotPassword(request, ipAddress));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<SuccessResponse> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        return ResponseEntity.ok(authService.resetPassword(request));
    }

    @GetMapping("/me")
    public ResponseEntity<UserDto> me() {
        return ResponseEntity.ok(userService.getCurrentUserProfile());
    }

    private String resolveIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String resolveRefreshToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null || cookies.length == 0) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (REFRESH_COOKIE.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private ResponseEntity<AuthResponse> withRefreshCookie(AuthSessionResult session,
                                                           HttpServletRequest request,
                                                           boolean clearCookie) {
        ResponseCookie cookie = buildRefreshCookie(session == null ? "" : session.getRefreshToken(), request, clearCookie);
        AuthResponse body = session == null ? null : session.getAuth();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(body);
    }

    private ResponseCookie buildRefreshCookie(String token, HttpServletRequest request, boolean clear) {
        long maxAge = clear ? 0 : authService.refreshTokenTtl().toSeconds();
        return ResponseCookie.from(REFRESH_COOKIE, token == null ? "" : token)
                .httpOnly(true)
                .secure(request.isSecure())
                .sameSite("Lax")
                .path("/api/auth")
                .maxAge(maxAge)
                .build();
    }
}
