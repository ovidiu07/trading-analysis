package com.tradevault.service;

import com.tradevault.config.MaintenanceProperties;
import com.tradevault.domain.entity.User;
import com.tradevault.dto.maintenance.DatabaseResetRequest;
import com.tradevault.dto.maintenance.DatabaseResetResponse;
import com.tradevault.repository.UserRepository;
import com.tradevault.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DatabaseResetService {
    private static final List<String> RESETTABLE_TABLES = List.of(
            "user_notification",
            "notification_event",
            "signal_feature_snapshots",
            "signal_outcomes",
            "signal_profile_recommendations",
            "signal_performance_aggregates",
            "signal_events",
            "trade_entry_screenshot_assets",
            "trade_content_links",
            "trade_rule_breaks",
            "trade_tags",
            "trade_plans",
            "plan_asset",
            "content_asset",
            "strategy_asset",
            "notebook_attachment",
            "notebook_tag_link",
            "backtest_evidence_links",
            "backtesting_screenshots",
            "backtesting_edge_lenses",
            "backtesting_trades",
            "backtesting_workspaces",
            "backtest_candidate_reviews",
            "backtest_run_reports",
            "backtest_trades",
            "backtest_setups",
            "backtest_optimizer_runs",
            "strategy_playbooks",
            "backtest_runs",
            "backtest_strategy_configs",
            "backtest_datasets",
            "candle_chunks",
            "backtest_csv_mappings",
            "backtest_csv_uploads",
            "backtest_dataset_sets",
            "session_auto_trade_events",
            "pool_levels",
            "session_narratives",
            "liquidity_pools",
            "session_levels",
            "session_setups",
            "today_sessions",
            "checklist_item_completions",
            "checklist_template_versions",
            "checklist_template_entries",
            "checklist_templates",
            "checklist_template_items",
            "checklist_template_state",
            "context_snapshots",
            "strategy_versions",
            "user_strategies",
            "notebook_note",
            "notebook_template",
            "notebook_tag",
            "notebook_folder",
            "plans",
            "trade_import_rows",
            "content_post_translation",
            "content_post",
            "asset",
            "tags",
            "trades",
            "candle_cache"
    );

    private static final List<String> PRESERVED_TABLES = List.of(
            "users",
            "accounts",
            "user_tokens",
            "legal_acceptance",
            "notification_preferences",
            "backtest_provider_credentials",
            "chart_profiles",
            "chart_settings",
            "content_type",
            "content_type_translation",
            "follows"
    );

    private final JdbcTemplate jdbcTemplate;
    private final MaintenanceProperties maintenanceProperties;
    private final Environment environment;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final DatabaseResetRateLimiter rateLimiter;

    @Transactional
    public DatabaseResetResponse resetData(DatabaseResetRequest request, Authentication authentication) {
        User user = resolveAuthenticatedUser(authentication);
        rateLimiter.assertAllowed(user.getId().toString());
        validateRequest(request, authentication, user);

        OffsetDateTime startedAt = OffsetDateTime.now();
        List<String> profiles = activeProfiles();
        log.info("Database reset requested userId={} userEmail={} timestamp={} profiles={} resettableTables={}",
                user.getId(), user.getEmail(), startedAt, profiles, RESETTABLE_TABLES);

        Map<String, Integer> deletedRows = new LinkedHashMap<>();
        try {
            for (String table : RESETTABLE_TABLES) {
                int deleted = jdbcTemplate.update("DELETE FROM " + table);
                deletedRows.put(table, deleted);
            }
            log.info("Database reset completed userId={} userEmail={} timestamp={} profiles={} success=true deletedRows={}",
                    user.getId(), user.getEmail(), OffsetDateTime.now(), profiles, deletedRows);
            return DatabaseResetResponse.builder()
                    .status("SUCCESS")
                    .deletedRows(deletedRows)
                    .preserved(PRESERVED_TABLES)
                    .build();
        } catch (RuntimeException ex) {
            log.error("Database reset failed userId={} userEmail={} timestamp={} profiles={} success=false deletedRows={}",
                    user.getId(), user.getEmail(), OffsetDateTime.now(), profiles, deletedRows, ex);
            throw ex;
        }
    }

    private void validateRequest(DatabaseResetRequest request, Authentication authentication, User user) {
        if (!maintenanceProperties.isDatabaseResetEnabled()) {
            throw new AccessDeniedException("Database reset is disabled");
        }
        if (isProductionProfile() && !maintenanceProperties.isDatabaseResetAllowedInProduction()) {
            throw new AccessDeniedException("Database reset is not allowed in production");
        }
        if (!hasResetAuthority(authentication)) {
            throw new AccessDeniedException("Database reset permission is required");
        }
        if (!maintenanceProperties.getDatabaseResetConfirmation().equals(request.getConfirmation())) {
            throw new IllegalArgumentException("Invalid database reset confirmation");
        }
        if (!request.isPreserveUsers()) {
            throw new IllegalArgumentException("preserveUsers must be true");
        }
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("Password verification failed");
        }
    }

    private User resolveAuthenticatedUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AccessDeniedException("Authentication is required");
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof CustomUserDetails details) {
            return details.getUser();
        }
        String username = authentication.getName();
        return userRepository.findByEmail(username)
                .orElseThrow(() -> new AccessDeniedException("Authenticated user was not found"));
    }

    private boolean hasResetAuthority(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_SUPER_ADMIN".equals(authority.getAuthority())
                        || "PERMISSION_DATABASE_RESET".equals(authority.getAuthority()));
    }

    private List<String> activeProfiles() {
        return Arrays.asList(environment.getActiveProfiles());
    }

    private boolean isProductionProfile() {
        return activeProfiles().stream()
                .anyMatch(profile -> "prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile));
    }

    public List<String> resettableTablesForTesting() {
        return RESETTABLE_TABLES;
    }

    public List<String> preservedTablesForTesting() {
        return PRESERVED_TABLES;
    }
}
