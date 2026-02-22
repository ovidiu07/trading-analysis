package com.tradevault.service;

import com.tradevault.config.LegalConfig;
import com.tradevault.config.MailConfig;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.entity.UserToken;
import com.tradevault.domain.enums.TokenType;
import com.tradevault.dto.auth.AuthSessionResult;
import com.tradevault.dto.auth.LoginRequest;
import com.tradevault.dto.auth.RegisterRequest;
import com.tradevault.repository.UserRepository;
import com.tradevault.security.JwtTokenProvider;
import com.tradevault.service.mail.MailService;
import com.tradevault.service.mail.TemplateRenderer;
import com.tradevault.service.mail.VerificationEmailComposer;
import com.tradevault.service.mail.VerificationEmailContent;
import com.tradevault.service.notification.NotificationPreferencesService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AuthServiceDemoDataTest {

    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;
    private AuthenticationManager authenticationManager;
    private JwtTokenProvider jwtTokenProvider;
    private LegalConfig legalConfig;
    private LegalAcceptanceService legalAcceptanceService;
    private TurnstileService turnstileService;
    private RegistrationRateLimiter registrationRateLimiter;
    private VerificationRateLimiter verificationRateLimiter;
    private PasswordResetRateLimiter passwordResetRateLimiter;
    private UserTokenService userTokenService;
    private MailService mailService;
    private TemplateRenderer templateRenderer;
    private VerificationEmailComposer verificationEmailComposer;
    private MailConfig mailConfig;
    private CurrentUserService currentUserService;
    private DemoDataService demoDataService;
    private NotificationPreferencesService notificationPreferencesService;
    private AuthService authService;

    @BeforeEach
    void setup() {
        userRepository = mock(UserRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        authenticationManager = mock(AuthenticationManager.class);
        jwtTokenProvider = mock(JwtTokenProvider.class);
        legalConfig = mock(LegalConfig.class);
        legalAcceptanceService = mock(LegalAcceptanceService.class);
        turnstileService = mock(TurnstileService.class);
        registrationRateLimiter = mock(RegistrationRateLimiter.class);
        verificationRateLimiter = mock(VerificationRateLimiter.class);
        passwordResetRateLimiter = mock(PasswordResetRateLimiter.class);
        userTokenService = mock(UserTokenService.class);
        mailService = mock(MailService.class);
        templateRenderer = mock(TemplateRenderer.class);
        verificationEmailComposer = mock(VerificationEmailComposer.class);
        mailConfig = mock(MailConfig.class);
        currentUserService = mock(CurrentUserService.class);
        demoDataService = mock(DemoDataService.class);
        notificationPreferencesService = mock(NotificationPreferencesService.class);

        authService = new AuthService(
                userRepository,
                passwordEncoder,
                authenticationManager,
                jwtTokenProvider,
                legalConfig,
                legalAcceptanceService,
                turnstileService,
                registrationRateLimiter,
                verificationRateLimiter,
                passwordResetRateLimiter,
                userTokenService,
                mailService,
                templateRenderer,
                verificationEmailComposer,
                mailConfig,
                currentUserService,
                demoDataService,
                notificationPreferencesService
        );

        ReflectionTestUtils.setField(authService, "frontendUrl", "http://localhost:5173");

        when(legalConfig.getTermsVersion()).thenReturn("2024-09-01");
        when(legalConfig.getPrivacyVersion()).thenReturn("2024-09-01");
        when(passwordEncoder.encode(anyString())).thenReturn("encoded-pass");
        when(userTokenService.issue(any(User.class), eq(TokenType.EMAIL_VERIFY), any(Duration.class))).thenReturn("verify-token");
        when(templateRenderer.render(anyString(), any(Map.class))).thenReturn("<html></html>");
        when(verificationEmailComposer.compose(anyString(), anyString(), anyString(), any(Duration.class)))
                .thenReturn(new VerificationEmailContent(
                        "en",
                        "Verify your TradeJAudit email",
                        "Preheader",
                        "<html></html>",
                        "text",
                        "no-reply@tradejaudit.com",
                        "no-reply@tradejaudit.com"
                ));
        when(mailConfig.getSupportEmail()).thenReturn("no-reply@tradejaudit.com");
    }

    @Test
    void registerTriggersDemoDataGenerationForCreatedUser() {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("demo-user@example.com");
        request.setPassword("Password1!");
        request.setTermsAccepted(true);
        request.setTermsVersion("2024-09-01");
        request.setPrivacyAccepted(true);
        request.setPrivacyVersion("2024-09-01");
        request.setLocale("en-US");

        when(userRepository.findByEmail("demo-user@example.com")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0, User.class);
            user.setId(UUID.fromString("11111111-1111-1111-1111-111111111111"));
            return user;
        });

        authService.register(request, "127.0.0.1", "JUnit");

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        assertThat(userCaptor.getValue().isDemoEnabled()).isTrue();
        verify(demoDataService).generateDemoDataForUser(UUID.fromString("11111111-1111-1111-1111-111111111111"), true);
    }

    @Test
    void loginReturnsAccessAndRefreshTokensWithConfiguredTtl() {
        ReflectionTestUtils.setField(authService, "refreshTokenValidityMs", 86_400_000L);

        User saved = User.builder()
                .id(UUID.fromString("22222222-2222-2222-2222-222222222222"))
                .email("login@example.com")
                .passwordHash("hash")
                .emailVerifiedAt(java.time.OffsetDateTime.now())
                .build();
        when(authenticationManager.authenticate(any())).thenReturn(
                new UsernamePasswordAuthenticationToken(
                        new org.springframework.security.core.userdetails.User(
                                saved.getEmail(),
                                "hash",
                                java.util.List.of(new SimpleGrantedAuthority("ROLE_USER"))
                        ),
                        null
                )
        );
        when(userRepository.findByEmail(saved.getEmail())).thenReturn(Optional.of(saved));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0, User.class));
        when(jwtTokenProvider.createAccessToken(saved.getId(), saved.getEmail())).thenReturn("access-token");
        when(userTokenService.issue(eq(saved), eq(TokenType.REFRESH_TOKEN), any(Duration.class))).thenReturn("refresh-token");

        LoginRequest request = new LoginRequest();
        request.setEmail(saved.getEmail());
        request.setPassword("Password1!");
        AuthSessionResult sessionResult = authService.login(request);

        assertThat(sessionResult.getAuth().getToken()).isEqualTo("access-token");
        assertThat(sessionResult.getRefreshToken()).isEqualTo("refresh-token");
        verify(userTokenService).issue(
                eq(saved),
                eq(TokenType.REFRESH_TOKEN),
                argThat(ttl -> ttl != null && ttl.toHours() == 24)
        );
    }

    @Test
    void refreshRotatesRefreshTokenAndReturnsNewAccessToken() {
        ReflectionTestUtils.setField(authService, "refreshTokenValidityMs", 86_400_000L);

        User saved = User.builder()
                .id(UUID.fromString("33333333-3333-3333-3333-333333333333"))
                .email("refresh@example.com")
                .passwordHash("hash")
                .emailVerifiedAt(java.time.OffsetDateTime.now())
                .build();

        when(userTokenService.consume(TokenType.REFRESH_TOKEN, "old-refresh"))
                .thenReturn(UserToken.builder().user(saved).build());
        when(userRepository.findById(saved.getId())).thenReturn(Optional.of(saved));
        when(jwtTokenProvider.createAccessToken(saved.getId(), saved.getEmail())).thenReturn("new-access");
        when(userTokenService.issue(eq(saved), eq(TokenType.REFRESH_TOKEN), any(Duration.class))).thenReturn("new-refresh");

        AuthSessionResult refreshed = authService.refresh("old-refresh");

        assertThat(refreshed.getAuth().getToken()).isEqualTo("new-access");
        assertThat(refreshed.getRefreshToken()).isEqualTo("new-refresh");
        verify(userTokenService).issue(
                eq(saved),
                eq(TokenType.REFRESH_TOKEN),
                argThat(ttl -> ttl != null && ttl.toHours() == 24)
        );
    }
}
