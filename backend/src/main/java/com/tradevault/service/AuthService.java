package com.tradevault.service;

import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.LegalDocumentType;
import com.tradevault.domain.enums.Role;
import com.tradevault.config.LegalConfig;
import com.tradevault.dto.auth.AuthResponse;
import com.tradevault.dto.auth.LoginRequest;
import com.tradevault.dto.auth.RegisterRequest;
import com.tradevault.dto.auth.UserDto;
import com.tradevault.exception.DuplicateEmailException;
import com.tradevault.repository.UserRepository;
import com.tradevault.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final LegalConfig legalConfig;
    private final LegalAcceptanceService legalAcceptanceService;
    private final TurnstileService turnstileService;
    private final RegistrationRateLimiter registrationRateLimiter;

    @Transactional
    public AuthResponse register(RegisterRequest request, String ipAddress, String userAgent) {
        registrationRateLimiter.assertAllowed(ipAddress);
        validateLegalAcceptance(request);
        // CAPTCHA verification removed to allow registration without it
        userRepository.findByEmail(request.getEmail())
                .ifPresent(u -> { throw new DuplicateEmailException("Email already used"); });
        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(Role.USER)
                .baseCurrency("USD")
                .timezone("Europe/Bucharest")
                .createdAt(OffsetDateTime.now())
                .build();
        userRepository.save(user);
        legalAcceptanceService.record(
                user,
                LegalDocumentType.TERMS,
                legalConfig.getTermsVersion(),
                ipAddress,
                userAgent,
                request.getLocale()
        );
        legalAcceptanceService.record(
                user,
                LegalDocumentType.PRIVACY,
                legalConfig.getPrivacyVersion(),
                ipAddress,
                userAgent,
                request.getLocale()
        );
        String token = jwtTokenProvider.createToken(user.getId(), user.getEmail());
        return new AuthResponse(token, UserDto.from(user));
    }

    public AuthResponse login(LoginRequest request) {
        Authentication auth = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));
        var user = ((org.springframework.security.core.userdetails.UserDetails) auth.getPrincipal());
        var saved = userRepository.findByEmail(user.getUsername()).orElseThrow();
        saved.setLastLoginAt(OffsetDateTime.now());
        userRepository.save(saved);
        String token = jwtTokenProvider.createToken(saved.getId(), saved.getEmail());
        return new AuthResponse(token, UserDto.from(saved));
    }

    private void validateLegalAcceptance(RegisterRequest request) {
        if (!Boolean.TRUE.equals(request.getTermsAccepted())) {
            throw new IllegalArgumentException("Terms acceptance is required");
        }
        if (!Boolean.TRUE.equals(request.getPrivacyAccepted())) {
            throw new IllegalArgumentException("Privacy acknowledgment is required");
        }
        if (legalConfig.getTermsVersion() == null || !legalConfig.getTermsVersion().equals(request.getTermsVersion())) {
            throw new IllegalArgumentException("Terms version mismatch");
        }
        if (legalConfig.getPrivacyVersion() == null || !legalConfig.getPrivacyVersion().equals(request.getPrivacyVersion())) {
            throw new IllegalArgumentException("Privacy version mismatch");
        }
    }
}
