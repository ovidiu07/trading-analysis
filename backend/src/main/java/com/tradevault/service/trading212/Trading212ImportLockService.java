package com.tradevault.service.trading212;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.PreparedStatement;
import java.util.Collection;
import java.util.Comparator;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class Trading212ImportLockService {
    private final JdbcTemplate jdbcTemplate;

    public void lockAll(UUID accountId, Collection<String> externalTradeIds) {
        if (externalTradeIds == null || externalTradeIds.isEmpty()) {
            return;
        }
        jdbcTemplate.execute((ConnectionCallback<Void>) connection -> {
            if (!connection.getMetaData().getDatabaseProductName().toLowerCase().contains("postgres")) {
                return null;
            }
            try (PreparedStatement statement = connection.prepareStatement("SELECT pg_advisory_xact_lock(?)")) {
                externalTradeIds.stream()
                        .distinct()
                        .sorted(Comparator.naturalOrder())
                        .map(identity -> lockKey(accountId, identity))
                        .forEach(key -> {
                            try {
                                statement.setLong(1, key);
                                statement.execute();
                            } catch (Exception ex) {
                                throw new IllegalStateException("Could not acquire Trading 212 import lock", ex);
                            }
                        });
            }
            return null;
        });
    }

    private static long lockKey(UUID accountId, String externalTradeId) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest((accountId + "|" + externalTradeId).getBytes(StandardCharsets.UTF_8));
            return ByteBuffer.wrap(digest).getLong();
        } catch (Exception ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }
}
