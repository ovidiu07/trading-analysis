package com.tradevault.service;

import com.tradevault.config.LegalConfig;
import com.tradevault.config.MailConfig;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.TokenType;
import com.tradevault.dto.auth.RegisterRequest;
import com.tradevault.repository.UserRepository;
import com.tradevault.security.JwtTokenProvider;
import com.tradevault.service.mail.MailService;
import com.tradevault.service.mail.TemplateRenderer;
import com.tradevault.service.mail.VerificationEmailComposer;
import com.tradevault.service.mail.VerificationEmailContent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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
                demoDataService
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
}
