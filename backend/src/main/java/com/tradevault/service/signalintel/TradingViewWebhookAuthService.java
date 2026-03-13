package com.tradevault.service.signalintel;

import com.tradevault.domain.entity.User;
import com.tradevault.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;

@Service
public class TradingViewWebhookAuthService {
    private final UserRepository userRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    public TradingViewWebhookAuthService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User resolveUser(String bodyToken, String queryToken) {
        String token = resolveToken(bodyToken, queryToken);
        String hash = hashSecret(token);
        return userRepository.findByTradingviewWebhookSecretHashAndTradingviewWebhookEnabledTrue(hash)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or disabled TradingView webhook token"));
    }

    public String resolveToken(String bodyToken, String queryToken) {
        String token = firstNonBlank(queryToken, bodyToken);
        if (token == null) {
            throw new IllegalArgumentException("TradingView webhook token is required");
        }
        return token;
    }

    public String generateSecret() {
        byte[] buffer = new byte[24];
        secureRandom.nextBytes(buffer);
        return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(buffer);
    }

    public String hashSecret(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }

    public String buildHint(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        if (token.length() <= 8) {
            return token;
        }
        return token.substring(0, 4) + "..." + token.substring(token.length() - 4);
    }

    private String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first.trim();
        }
        if (second != null && !second.isBlank()) {
            return second.trim();
        }
        return null;
    }
}
