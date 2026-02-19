package com.tradevault.service.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementCallback;
import org.springframework.jdbc.core.PreparedStatementCreator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationDispatchLockService {
    private final JdbcTemplate jdbcTemplate;
    private final TransactionTemplate transactionTemplate;

    @Value("${notifications.dispatch.pg-lock-key:92100420260213}")
    private long advisoryLockKey;

    @Value("${notifications.dispatch.lock-query-timeout-seconds:3}")
    private int lockQueryTimeoutSeconds;

    @Value("${notifications.dispatch.lock-statement-timeout-ms:3000}")
    private int lockStatementTimeoutMillis;

    public boolean tryAcquireDistributedLock() {
        return executeAdvisoryLockQuery("SELECT pg_try_advisory_lock(?)", "acquire");
    }

    public boolean releaseDistributedLock() {
        return executeAdvisoryLockQuery("SELECT pg_advisory_unlock(?)", "release");
    }

    private boolean executeAdvisoryLockQuery(String sql, String operation) {
        int safeStatementTimeoutMillis = Math.max(500, lockStatementTimeoutMillis);
        int safeQueryTimeoutSeconds = Math.max(1, lockQueryTimeoutSeconds);
        Boolean result = transactionTemplate.execute(status -> {
            jdbcTemplate.execute("SET LOCAL statement_timeout = " + safeStatementTimeoutMillis);
            return jdbcTemplate.execute(
                    (PreparedStatementCreator) connection -> {
                        var preparedStatement = connection.prepareStatement(sql);
                        preparedStatement.setQueryTimeout(safeQueryTimeoutSeconds);
                        preparedStatement.setLong(1, advisoryLockKey);
                        return preparedStatement;
                    },
                    (PreparedStatementCallback<Boolean>) preparedStatement -> {
                        try (var resultSet = preparedStatement.executeQuery()) {
                            if (!resultSet.next()) {
                                return false;
                            }
                            return resultSet.getBoolean(1);
                        }
                    }
            );
        });

        boolean applied = Boolean.TRUE.equals(result);
        log.debug(
                "Notification advisory lock operation={} applied={} key={} statementTimeoutMs={} queryTimeoutSeconds={}",
                operation,
                applied,
                advisoryLockKey,
                safeStatementTimeoutMillis,
                safeQueryTimeoutSeconds
        );
        return applied;
    }
}
