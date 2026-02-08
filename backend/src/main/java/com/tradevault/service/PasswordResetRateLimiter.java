package com.tradevault.service;

import com.tradevault.exception.RateLimitExceededException;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class PasswordResetRateLimiter {
    private static final int MAX_ATTEMPTS = 5;
    private static final Duration WINDOW = Duration.ofMinutes(10);

    private final Map<String, AttemptWindow> attempts = new ConcurrentHashMap<>();

    public void assertAllowed(String identifier) {
        String key = identifier == null || identifier.isBlank() ? "unknown" : identifier;
        AttemptWindow window = attempts.computeIfAbsent(key, value -> new AttemptWindow());
        synchronized (window) {
            Instant now = Instant.now();
            if (window.windowStart.plus(WINDOW).isBefore(now)) {
                window.windowStart = now;
                window.count = 0;
            }
            window.count += 1;
            if (window.count > MAX_ATTEMPTS) {
                throw new RateLimitExceededException("Too many password reset requests. Please try again later.");
            }
        }
    }

    private static class AttemptWindow {
        private Instant windowStart = Instant.now();
        private int count = 0;
    }
}
