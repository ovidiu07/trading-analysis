package com.tradevault.service;

import com.tradevault.config.MaintenanceProperties;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Role;
import com.tradevault.dto.maintenance.DatabaseResetRequest;
import com.tradevault.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DatabaseResetServiceTest {
    @Mock
    private JdbcTemplate jdbcTemplate;
    @Mock
    private Environment environment;
    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordEncoder passwordEncoder;

    private MaintenanceProperties properties;
    private DatabaseResetService service;
    private User user;

    @BeforeEach
    void setUp() {
        properties = new MaintenanceProperties();
        properties.setDatabaseResetConfirmation("RESET_TRADEJAUDIT_DATABASE_DATA");
        service = new DatabaseResetService(
                jdbcTemplate,
                properties,
                environment,
                userRepository,
                passwordEncoder,
                new DatabaseResetRateLimiter()
        );
        user = User.builder()
                .id(UUID.randomUUID())
                .email("super-admin@example.com")
                .passwordHash("hash")
                .role(Role.SUPER_ADMIN)
                .build();
    }

    @Test
    void resetDataIsTransactional() throws Exception {
        Method method = DatabaseResetService.class.getMethod("resetData", DatabaseResetRequest.class, Authentication.class);
        assertThat(method.getAnnotation(Transactional.class)).isNotNull();
    }

    @Test
    void disabledConfigRejectsBeforeDeleting() {
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.resetData(validRequest(), superAdminAuth()))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("disabled");

        verify(jdbcTemplate, never()).update(anyString());
    }

    @Test
    void productionProfileRequiresSeparateProductionOverride() {
        properties.setDatabaseResetEnabled(true);
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(environment.getActiveProfiles()).thenReturn(new String[]{"prod"});

        assertThatThrownBy(() -> service.resetData(validRequest(), superAdminAuth()))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("production");

        verify(jdbcTemplate, never()).update(anyString());
    }

    @Test
    void wrongConfirmationIsRejectedBeforeDeleting() {
        properties.setDatabaseResetEnabled(true);
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(environment.getActiveProfiles()).thenReturn(new String[]{"dev"});

        DatabaseResetRequest request = validRequest();
        request.setConfirmation("WRONG");

        assertThatThrownBy(() -> service.resetData(request, superAdminAuth()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("confirmation");

        verify(jdbcTemplate, never()).update(anyString());
    }

    @Test
    void passwordMustBeVerifiedAgain() {
        properties.setDatabaseResetEnabled(true);
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(environment.getActiveProfiles()).thenReturn(new String[]{"dev"});
        when(passwordEncoder.matches("Password1!", "hash")).thenReturn(false);

        assertThatThrownBy(() -> service.resetData(validRequest(), superAdminAuth()))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessageContaining("Password verification failed");

        verify(jdbcTemplate, never()).update(anyString());
    }

    @Test
    void deletesOnlyAllowlistedTablesAndReturnsCounts() {
        properties.setDatabaseResetEnabled(true);
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(environment.getActiveProfiles()).thenReturn(new String[]{"dev"});
        when(passwordEncoder.matches("Password1!", "hash")).thenReturn(true);
        when(jdbcTemplate.update(anyString())).thenReturn(0);
        when(jdbcTemplate.update("DELETE FROM trades")).thenReturn(4);
        when(jdbcTemplate.update("DELETE FROM backtest_trades")).thenReturn(2);
        when(jdbcTemplate.update("DELETE FROM notebook_note")).thenReturn(3);
        when(jdbcTemplate.update("DELETE FROM today_sessions")).thenReturn(1);

        var response = service.resetData(validRequest(), superAdminAuth());

        assertThat(response.getStatus()).isEqualTo("SUCCESS");
        assertThat(response.getDeletedRows()).containsEntry("trades", 4);
        assertThat(response.getDeletedRows()).containsEntry("backtest_trades", 2);
        assertThat(response.getDeletedRows()).containsEntry("notebook_note", 3);
        assertThat(response.getDeletedRows()).containsEntry("today_sessions", 1);
        assertThat(response.getDeletedRows()).doesNotContainKeys("users", "accounts", "user_tokens");
        assertThat(response.getPreserved()).contains(
                "users",
                "accounts",
                "user_tokens",
                "notification_preferences",
                "backtest_provider_credentials"
        );

        verify(jdbcTemplate, never()).update("DELETE FROM users");
        verify(jdbcTemplate, never()).update("DELETE FROM accounts");
        verify(jdbcTemplate, never()).update("DELETE FROM user_tokens");
    }

    @Test
    void deletesChildTablesBeforeParents() {
        properties.setDatabaseResetEnabled(true);
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(environment.getActiveProfiles()).thenReturn(new String[]{"dev"});
        when(passwordEncoder.matches("Password1!", "hash")).thenReturn(true);
        when(jdbcTemplate.update(anyString())).thenReturn(0);

        service.resetData(validRequest(), superAdminAuth());

        InOrder order = inOrder(jdbcTemplate);
        order.verify(jdbcTemplate).update("DELETE FROM trade_tags");
        order.verify(jdbcTemplate).update("DELETE FROM trade_plans");
        order.verify(jdbcTemplate).update("DELETE FROM plan_asset");
        order.verify(jdbcTemplate).update("DELETE FROM content_asset");
        order.verify(jdbcTemplate).update("DELETE FROM strategy_asset");
        order.verify(jdbcTemplate).update("DELETE FROM notebook_attachment");
        order.verify(jdbcTemplate).update("DELETE FROM notebook_tag_link");
        order.verify(jdbcTemplate).update("DELETE FROM backtesting_screenshots");
        order.verify(jdbcTemplate).update("DELETE FROM backtesting_edge_lenses");
        order.verify(jdbcTemplate).update("DELETE FROM backtesting_trades");
        order.verify(jdbcTemplate).update("DELETE FROM backtesting_workspaces");
        order.verify(jdbcTemplate).update("DELETE FROM backtest_trades");
        order.verify(jdbcTemplate).update("DELETE FROM backtest_setups");
        order.verify(jdbcTemplate).update("DELETE FROM backtest_runs");
        order.verify(jdbcTemplate).update("DELETE FROM session_auto_trade_events");
        order.verify(jdbcTemplate).update("DELETE FROM pool_levels");
        order.verify(jdbcTemplate).update("DELETE FROM session_narratives");
        order.verify(jdbcTemplate).update("DELETE FROM liquidity_pools");
        order.verify(jdbcTemplate).update("DELETE FROM session_levels");
        order.verify(jdbcTemplate).update("DELETE FROM session_setups");
        order.verify(jdbcTemplate).update("DELETE FROM today_sessions");
        order.verify(jdbcTemplate).update("DELETE FROM notebook_note");
        order.verify(jdbcTemplate).update("DELETE FROM notebook_template");
        order.verify(jdbcTemplate).update("DELETE FROM notebook_tag");
        order.verify(jdbcTemplate).update("DELETE FROM notebook_folder");
        order.verify(jdbcTemplate).update("DELETE FROM plans");
        order.verify(jdbcTemplate).update("DELETE FROM asset");
        order.verify(jdbcTemplate).update("DELETE FROM tags");
        order.verify(jdbcTemplate).update("DELETE FROM trades");
    }

    @Test
    void deleteFailurePropagatesForTransactionalRollback() {
        properties.setDatabaseResetEnabled(true);
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(environment.getActiveProfiles()).thenReturn(new String[]{"dev"});
        when(passwordEncoder.matches("Password1!", "hash")).thenReturn(true);
        when(jdbcTemplate.update(anyString())).thenReturn(0);
        when(jdbcTemplate.update("DELETE FROM backtest_trades")).thenThrow(new RuntimeException("delete failed"));

        assertThatThrownBy(() -> service.resetData(validRequest(), superAdminAuth()))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("delete failed");

        verify(jdbcTemplate, never()).update("DELETE FROM backtest_runs");
    }

    private DatabaseResetRequest validRequest() {
        DatabaseResetRequest request = new DatabaseResetRequest();
        request.setConfirmation("RESET_TRADEJAUDIT_DATABASE_DATA");
        request.setPreserveUsers(true);
        request.setPassword("Password1!");
        return request;
    }

    private Authentication superAdminAuth() {
        return new TestingAuthenticationToken(user.getEmail(), "n/a", "ROLE_SUPER_ADMIN");
    }
}
