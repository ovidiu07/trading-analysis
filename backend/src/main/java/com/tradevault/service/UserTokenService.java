package com.tradevault.service;

import com.tradevault.domain.entity.User;
import com.tradevault.domain.entity.UserToken;
import com.tradevault.domain.enums.TokenType;
import com.tradevault.repository.UserTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;

@Service
@RequiredArgsConstructor
public class UserTokenService {
    private static final int TOKEN_BYTES = 32;

    private final UserTokenRepository userTokenRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public String issue(User user, TokenType type, Duration ttl) {
        invalidateActiveTokens(user, type);
        String rawToken = generateToken();
        String tokenHash = hashToken(rawToken);
        OffsetDateTime now = OffsetDateTime.now();
        UserToken token = UserToken.builder()
                .user(user)
                .type(type)
                .tokenHash(tokenHash)
                .expiresAt(now.plus(ttl))
                .createdAt(now)
                .build();
        userTokenRepository.save(token);
        return rawToken;
    }

    @Transactional
    public UserToken consume(User user, TokenType type, String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException("Token is required");
        }
        String tokenHash = hashToken(rawToken);
        UserToken token = userTokenRepository.findByUserIdAndTypeAndTokenHashAndUsedAtIsNull(user.getId(), type, tokenHash)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired token"));
        OffsetDateTime now = OffsetDateTime.now();
        if (token.isExpired(now)) {
            throw new IllegalArgumentException("Token has expired");
        }
        token.setUsedAt(now);
        return userTokenRepository.save(token);
    }

    @Transactional
    public void invalidateActiveTokens(User user, TokenType type) {
        OffsetDateTime now = OffsetDateTime.now();
        userTokenRepository.findAllByUserIdAndTypeAndUsedAtIsNull(user.getId(), type)
                .forEach(token -> token.setUsedAt(now));
    }

    private String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to hash token", ex);
        }
    }
}
