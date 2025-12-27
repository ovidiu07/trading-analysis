package com.tradevault.service;

import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Role;
import com.tradevault.dto.auth.AuthResponse;
import com.tradevault.dto.auth.LoginRequest;
import com.tradevault.dto.auth.RegisterRequest;
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

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        userRepository.findByEmail(request.getEmail()).ifPresent(u -> { throw new IllegalArgumentException("Email already used"); });
        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(Role.USER)
                .createdAt(OffsetDateTime.now())
                .build();
        userRepository.save(user);
        String token = jwtTokenProvider.createToken(user.getId(), user.getEmail());
        return new AuthResponse(token);
    }

    public AuthResponse login(LoginRequest request) {
        Authentication auth = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));
        var user = ((org.springframework.security.core.userdetails.UserDetails) auth.getPrincipal());
        var saved = userRepository.findByEmail(user.getUsername()).orElseThrow();
        saved.setLastLoginAt(OffsetDateTime.now());
        userRepository.save(saved);
        String token = jwtTokenProvider.createToken(saved.getId(), saved.getEmail());
        return new AuthResponse(token);
    }
}
