package com.tradevault.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Arrays;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@Slf4j
public class DatasourceStartupDiagnostics {
    private static final Pattern PASSWORD_QUERY_PATTERN = Pattern.compile("(?i)(password=)([^&]+)");
    private static final Pattern USER_QUERY_PATTERN = Pattern.compile("(?i)(user=)([^&]+)");
    private static final Pattern AUTHORITY_CREDENTIAL_PATTERN = Pattern.compile("(jdbc:[^:]+://)([^/@]+)@");

    private final Environment environment;
    private final DataSourceProperties dataSourceProperties;

    public DatasourceStartupDiagnostics(Environment environment, DataSourceProperties dataSourceProperties) {
        this.environment = environment;
        this.dataSourceProperties = dataSourceProperties;
    }

    @PostConstruct
    public void logDatasourceSetup() {
        String[] activeProfiles = environment.getActiveProfiles();
        if (activeProfiles.length == 0) {
            log.info("Spring active profiles: [default]");
        } else {
            log.info("Spring active profiles: {}", Arrays.toString(activeProfiles));
        }

        String url = dataSourceProperties.getUrl();
        if (url == null || url.isBlank()) {
            throw new IllegalStateException("Missing datasource URL. Set spring.datasource.url or DB_URL.");
        }

        JdbcTarget jdbcTarget = parseJdbcTarget(url);
        boolean usernamePresent = dataSourceProperties.getUsername() != null && !dataSourceProperties.getUsername().isBlank();
        boolean passwordPresent = dataSourceProperties.getPassword() != null && !dataSourceProperties.getPassword().isBlank();

        log.info(
                "Datasource config urlPresent=true usernamePresent={} passwordPresent={} targetHost={} targetPort={} database={} sslMode={} url={}",
                usernamePresent,
                passwordPresent,
                jdbcTarget.host(),
                jdbcTarget.port(),
                jdbcTarget.database(),
                jdbcTarget.sslMode(),
                sanitizeJdbcUrl(url)
        );
    }

    private JdbcTarget parseJdbcTarget(String url) {
        try {
            if (!url.startsWith("jdbc:")) {
                return JdbcTarget.unknown();
            }

            URI uri = URI.create(url.substring("jdbc:".length()));
            String database = uri.getPath() != null && uri.getPath().length() > 1 ? uri.getPath().substring(1) : "unknown";
            String sslMode = extractQueryParam(uri.getQuery(), "sslmode");
            int port = uri.getPort() > 0 ? uri.getPort() : 5432;
            String host = uri.getHost() != null ? uri.getHost() : "unknown";
            return new JdbcTarget(host, port, database, sslMode != null ? sslMode : "default");
        } catch (Exception exception) {
            log.warn("Failed to parse datasource URL target from {}", sanitizeJdbcUrl(url), exception);
            return JdbcTarget.unknown();
        }
    }

    private String sanitizeJdbcUrl(String jdbcUrl) {
        String sanitized = jdbcUrl;

        Matcher authorityMatcher = AUTHORITY_CREDENTIAL_PATTERN.matcher(sanitized);
        if (authorityMatcher.find()) {
            sanitized = authorityMatcher.replaceFirst("$1****@");
        }

        Matcher passwordMatcher = PASSWORD_QUERY_PATTERN.matcher(sanitized);
        if (passwordMatcher.find()) {
            sanitized = passwordMatcher.replaceAll("$1****");
        }

        Matcher userMatcher = USER_QUERY_PATTERN.matcher(sanitized);
        if (userMatcher.find()) {
            sanitized = userMatcher.replaceAll("$1****");
        }

        return sanitized;
    }

    private String extractQueryParam(String query, String key) {
        if (query == null || query.isBlank()) {
            return null;
        }
        String expectedPrefix = key + "=";
        for (String token : query.split("&")) {
            if (token.regionMatches(true, 0, expectedPrefix, 0, expectedPrefix.length())) {
                return token.substring(expectedPrefix.length());
            }
        }
        return null;
    }

    private record JdbcTarget(String host, int port, String database, String sslMode) {
        private static JdbcTarget unknown() {
            return new JdbcTarget("unknown", -1, "unknown", "unknown");
        }
    }
}
