package com.tradevault.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.sql.SQLException;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

@Component
@Slf4j
public class DatabaseConnectivityProbe {
    private static final String PROBE_SQL = "SELECT 1";

    private final JdbcTemplate jdbcTemplate;
    private final AtomicReference<ProbeResult> lastResult = new AtomicReference<>(ProbeResult.unknown());
    private final AtomicLong nextFailureLogEpochMillis = new AtomicLong(0L);

    @Value("${database.connectivity.probe-query-timeout-seconds:3}")
    private int probeQueryTimeoutSeconds;

    @Value("${database.connectivity.failure-log-window-ms:120000}")
    private long failureLogWindowMillis;

    public DatabaseConnectivityProbe(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void probeAtStartup() {
        probeNow("startup");
    }

    @Scheduled(
            fixedDelayString = "${database.connectivity.probe-interval-ms:30000}",
            initialDelayString = "${database.connectivity.probe-initial-delay-ms:15000}"
    )
    public void probeOnSchedule() {
        probeNow("scheduled");
    }

    public ProbeResult getLastResult() {
        return lastResult.get();
    }

    public ProbeResult probeNow(String reason) {
        Instant checkedAt = Instant.now();
        try {
            Integer result = jdbcTemplate.execute((ConnectionCallback<Integer>) connection -> {
                try (var statement = connection.prepareStatement(PROBE_SQL)) {
                    statement.setQueryTimeout(Math.max(1, probeQueryTimeoutSeconds));
                    try (var resultSet = statement.executeQuery()) {
                        if (!resultSet.next()) {
                            return null;
                        }
                        return resultSet.getInt(1);
                    }
                }
            });

            if (!Integer.valueOf(1).equals(result)) {
                throw new IllegalStateException("Unexpected DB probe response value=" + result);
            }

            ProbeResult previous = lastResult.getAndSet(ProbeResult.up(checkedAt));
            if (!previous.available()) {
                log.info("Database connectivity probe recovered checkedAt={} reason={}", checkedAt, reason);
            } else {
                log.debug("Database connectivity probe succeeded checkedAt={} reason={}", checkedAt, reason);
            }
            return lastResult.get();
        } catch (DataAccessException ex) {
            return registerFailure(checkedAt, reason, ex);
        } catch (Exception ex) {
            return registerFailure(checkedAt, reason, ex);
        }
    }

    private ProbeResult registerFailure(Instant checkedAt, String reason, Exception exception) {
        FailureDetails failure = extractFailure(exception);
        ProbeResult down = ProbeResult.down(checkedAt, failure);
        lastResult.set(down);

        long nowEpochMillis = System.currentTimeMillis();
        long safeWindowMillis = Math.max(1_000L, failureLogWindowMillis);
        if (nowEpochMillis >= nextFailureLogEpochMillis.get()) {
            nextFailureLogEpochMillis.set(nowEpochMillis + safeWindowMillis);
            log.warn(
                    "Database connectivity probe failed checkedAt={} reason={} rootCause={} message=\"{}\" sqlState={} nextLogWindowMs={}",
                    checkedAt,
                    reason,
                    failure.rootCauseClass(),
                    failure.rootCauseMessage(),
                    failure.sqlState(),
                    safeWindowMillis,
                    exception
            );
        } else {
            log.debug(
                    "Database connectivity probe failed checkedAt={} reason={} rootCause={} message=\"{}\" sqlState={}",
                    checkedAt,
                    reason,
                    failure.rootCauseClass(),
                    failure.rootCauseMessage(),
                    failure.sqlState()
            );
        }
        return down;
    }

    public static FailureDetails extractFailure(Throwable throwable) {
        Throwable root = throwable;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }

        String sqlState = null;
        Throwable cursor = throwable;
        while (cursor != null) {
            if (cursor instanceof SQLException sqlException && sqlException.getSQLState() != null && !sqlException.getSQLState().isBlank()) {
                sqlState = sqlException.getSQLState();
                break;
            }
            cursor = cursor.getCause();
        }

        String rootMessage = root.getMessage();
        if (rootMessage == null || rootMessage.isBlank()) {
            rootMessage = "No message";
        }
        if (rootMessage.length() > 400) {
            rootMessage = rootMessage.substring(0, 400);
        }

        return new FailureDetails(root.getClass().getName(), rootMessage, sqlState);
    }

    public record ProbeResult(Instant checkedAt, boolean available, FailureDetails failureDetails) {
        public static ProbeResult unknown() {
            return new ProbeResult(Instant.EPOCH, false, new FailureDetails("N/A", "Probe has not run yet", null));
        }

        public static ProbeResult up(Instant checkedAt) {
            return new ProbeResult(checkedAt, true, null);
        }

        public static ProbeResult down(Instant checkedAt, FailureDetails failureDetails) {
            return new ProbeResult(checkedAt, false, failureDetails);
        }

        public boolean isUnknown() {
            return !available && checkedAt.equals(Instant.EPOCH);
        }

        public String failureSummary() {
            if (failureDetails == null) {
                return "N/A";
            }
            return failureDetails.summary();
        }
    }

    public record FailureDetails(String rootCauseClass, String rootCauseMessage, String sqlState) {
        public String summary() {
            if (sqlState == null || sqlState.isBlank()) {
                return rootCauseClass + ": " + rootCauseMessage;
            }
            return rootCauseClass + ": " + rootCauseMessage + " (sqlState=" + sqlState + ")";
        }
    }
}
