package com.tradevault.config;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

@Component("dbHealthIndicator")
public class DatabaseConnectivityHealthIndicator implements HealthIndicator {
    private final DatabaseConnectivityProbe databaseConnectivityProbe;

    public DatabaseConnectivityHealthIndicator(DatabaseConnectivityProbe databaseConnectivityProbe) {
        this.databaseConnectivityProbe = databaseConnectivityProbe;
    }

    @Override
    public Health health() {
        DatabaseConnectivityProbe.ProbeResult result = databaseConnectivityProbe.getLastResult();
        if (result.isUnknown()) {
            result = databaseConnectivityProbe.probeNow("actuator-health");
        }

        Health.Builder builder = result.available() ? Health.up() : Health.down();
        builder.withDetail("checkedAt", result.checkedAt().toString());

        if (!result.available() && result.failureDetails() != null) {
            builder.withDetail("rootCauseClass", result.failureDetails().rootCauseClass());
            builder.withDetail("rootCauseMessage", result.failureDetails().rootCauseMessage());
            if (result.failureDetails().sqlState() != null) {
                builder.withDetail("sqlState", result.failureDetails().sqlState());
            }
        }

        return builder.build();
    }
}
