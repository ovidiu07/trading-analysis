package com.tradevault.service.backtest;

import com.tradevault.exception.BacktestDomainException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class BacktestRateLimiterService {
    private final Map<UUID, WindowCounter> counters = new ConcurrentHashMap<>();

    @Value("${backtest.provider.rate-limit.max-requests-per-minute:30}")
    private int maxRequestsPerMinute;

    public void assertCanFetch(UUID userId) {
        if (userId == null) {
            return;
        }
        int max = Math.max(1, maxRequestsPerMinute);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        counters.compute(userId, (ignored, current) -> {
            WindowCounter counter = current == null ? new WindowCounter(now, 0) : current;
            if (Duration.between(counter.windowStart(), now).toMinutes() >= 1) {
                counter = new WindowCounter(now, 0);
            }
            if (counter.count() >= max) {
                throw new BacktestDomainException(
                        "RATE_LIMITED",
                        "Too many provider data requests",
                        "Wait one minute before retrying OANDA data fetches.",
                        HttpStatus.TOO_MANY_REQUESTS
                );
            }
            return new WindowCounter(counter.windowStart(), counter.count() + 1);
        });
    }

    private record WindowCounter(OffsetDateTime windowStart, int count) {
    }
}
