package com.tradevault.service;

import com.tradevault.config.LegalConfig;
import com.tradevault.config.MailConfig;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.LegalDocumentType;
import com.tradevault.domain.enums.Role;
import com.tradevault.domain.enums.TokenType;
import com.tradevault.dto.auth.*;
import com.tradevault.exception.DuplicateEmailException;
import com.tradevault.exception.EmailNotVerifiedException;
import com.tradevault.repository.UserRepository;
import com.tradevault.security.JwtTokenProvider;
import com.tradevault.service.mail.EmailMessage;
import com.tradevault.service.mail.MailService;
import com.tradevault.service.mail.TemplateRenderer;
import com.tradevault.service.mail.VerificationEmailComposer;
import com.tradevault.service.mail.VerificationEmailContent;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {
    private static final Duration VERIFICATION_TTL = Duration.ofHours(24);
    private static final Duration RESET_TTL = Duration.ofMinutes(60);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final LegalConfig legalConfig;
    private final LegalAcceptanceService legalAcceptanceService;
    private final TurnstileService turnstileService;
    private final RegistrationRateLimiter registrationRateLimiter;
    private final VerificationRateLimiter verificationRateLimiter;
    private final PasswordResetRateLimiter passwordResetRateLimiter;
    private final UserTokenService userTokenService;
    private final MailService mailService;
    private final TemplateRenderer templateRenderer;
    private final VerificationEmailComposer verificationEmailComposer;
    private final MailConfig mailConfig;
    private final CurrentUserService currentUserService;
    private final DemoDataService demoDataService;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Transactional
    public RegisterResponse register(RegisterRequest request, String ipAddress, String userAgent) {
        registrationRateLimiter.assertAllowed(ipAddress);
        validateLegalAcceptance(request);
        // CAPTCHA verification removed to allow registration without it
        userRepository.findByEmail(request.getEmail())
                .ifPresent(u -> { throw new DuplicateEmailException("Email already used"); });
        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(Role.USER)
                .baseCurrency("USD")
                .timezone("Europe/Bucharest")
                .createdAt(OffsetDateTime.now())
                .demoEnabled(true)
                .build();
        userRepository.save(user);
        demoDataService.generateDemoDataForUser(user.getId(), true);
        legalAcceptanceService.record(
                user,
                LegalDocumentType.TERMS,
                legalConfig.getTermsVersion(),
                ipAddress,
                userAgent,
                request.getLocale()
        );
        legalAcceptanceService.record(
                user,
                LegalDocumentType.PRIVACY,
                legalConfig.getPrivacyVersion(),
                ipAddress,
                userAgent,
                request.getLocale()
        );
        String token = userTokenService.issue(user, TokenType.EMAIL_VERIFY, VERIFICATION_TTL);
        sendVerificationEmail(user, token, request.getLocale());
        return new RegisterResponse(true, true);
    }

    public AuthResponse login(LoginRequest request) {
        Authentication auth = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));
        var user = ((org.springframework.security.core.userdetails.UserDetails) auth.getPrincipal());
        var saved = userRepository.findByEmail(user.getUsername()).orElseThrow();
        if (!saved.isVerified()) {
            throw new EmailNotVerifiedException("Email not verified. Please check your inbox or resend the verification email.");
        }
        demoDataService.ensureDemoDataForLogin(saved.getId());
        saved.setLastLoginAt(OffsetDateTime.now());
        userRepository.save(saved);
        String token = jwtTokenProvider.createToken(saved.getId(), saved.getEmail());
        return new AuthResponse(token, UserDto.from(saved));
    }

    @Transactional
    public SuccessResponse verifyEmail(VerifyEmailRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Invalid verification link"));
        if (user.isVerified()) {
            return new SuccessResponse(true);
        }
        userTokenService.consume(user, TokenType.EMAIL_VERIFY, request.getToken());
        user.setEmailVerifiedAt(OffsetDateTime.now());
        userRepository.save(user);
        return new SuccessResponse(true);
    }

    @Transactional
    public SuccessResponse resendVerification(ResendVerificationRequest request, String ipAddress) {
        verificationRateLimiter.assertAllowed(rateKey(ipAddress, request.getEmail()));
        var maybeUser = userRepository.findByEmail(request.getEmail());
        if (maybeUser.isEmpty()) {
            return new SuccessResponse(true);
        }
        User user = maybeUser.get();
        if (user.isVerified()) {
            return new SuccessResponse(true);
        }
        String token = userTokenService.issue(user, TokenType.EMAIL_VERIFY, VERIFICATION_TTL);
        sendVerificationEmail(user, token, request.getLocale());
        return new SuccessResponse(true);
    }

    @Transactional
    public SuccessResponse changePassword(ChangePasswordRequest request) {
        User user = currentUserService.getCurrentUser();
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
        if (request.getNewPassword() == null || request.getNewPassword().length() < 8) {
            throw new IllegalArgumentException("New password must be at least 8 characters long");
        }
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        return new SuccessResponse(true);
    }

    @Transactional
    public SuccessResponse forgotPassword(ForgotPasswordRequest request, String ipAddress) {
        passwordResetRateLimiter.assertAllowed(rateKey(ipAddress, request.getEmail()));
        var maybeUser = userRepository.findByEmail(request.getEmail());
        if (maybeUser.isEmpty()) {
            return new SuccessResponse(true);
        }
        User user = maybeUser.get();
        if (!user.isVerified()) {
            return new SuccessResponse(true);
        }
        String token = userTokenService.issue(user, TokenType.PASSWORD_RESET, RESET_TTL);
        sendResetPasswordEmail(user, token);
        return new SuccessResponse(true);
    }

    @Transactional
    public SuccessResponse resetPassword(ResetPasswordRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Invalid reset link"));
        if (!user.isVerified()) {
            throw new IllegalArgumentException("Email not verified");
        }
        userTokenService.consume(user, TokenType.PASSWORD_RESET, request.getToken());
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        userTokenService.invalidateActiveTokens(user, TokenType.PASSWORD_RESET);
        return new SuccessResponse(true);
    }

    private void sendVerificationEmail(User user, String token, String locale) {
        String verifyUrl = buildFrontendUrl("/verify", Map.of("email", user.getEmail(), "token", token));
        VerificationEmailContent content = verificationEmailComposer.compose(
                user.getEmail(),
                verifyUrl,
                locale,
                VERIFICATION_TTL
        );
        mailService.send(EmailMessage.builder()
                .to(user.getEmail())
                .replyTo(content.replyTo())
                .subject(content.subject())
                .htmlBody(content.htmlBody())
                .textBody(content.textBody())
                .build());
    }

    private void sendResetPasswordEmail(User user, String token) {
        String resetUrl = buildFrontendUrl("/reset-password", Map.of("email", user.getEmail(), "token", token));
        String supportEmail = resolveSupportEmail();
        String htmlBody = templateRenderer.render("mail/reset-password.html", Map.of(
                "appName", "TradeJAudit",
                "email", user.getEmail(),
                "resetUrl", resetUrl,
                "supportEmail", supportEmail,
                "expiresIn", "60 minutes"
        ));
        String textBody = "Reset your TradeJAudit password\n\n" +
                "Hi " + user.getEmail() + ",\n\n" +
                "Use the link below to reset your password:\n" + resetUrl + "\n\n" +
                "This link expires in 60 minutes.";
        mailService.send(EmailMessage.builder()
                .to(user.getEmail())
                .subject("Reset your TradeJAudit password")
                .htmlBody(htmlBody)
                .textBody(textBody)
                .build());
    }

    private String buildFrontendUrl(String path, Map<String, String> params) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(frontendUrl).path(path);
        if (params != null) {
            params.forEach(builder::queryParam);
        }
        return builder.toUriString();
    }

    private String rateKey(String ipAddress, String email) {
        String ip = ipAddress == null ? "unknown" : ipAddress;
        String mail = email == null ? "unknown" : email.toLowerCase();
        return ip + ":" + mail;
    }

    private String resolveSupportEmail() {
        if (mailConfig.getSupportEmail() != null && !mailConfig.getSupportEmail().isBlank()) {
            return mailConfig.getSupportEmail();
        }
        if (mailConfig.getContactEmail() != null && !mailConfig.getContactEmail().isBlank()) {
            return mailConfig.getContactEmail();
        }
        return mailConfig.getFromAddress() == null ? "no-reply@tradejaudit.com" : mailConfig.getFromAddress();
    }

    private void validateLegalAcceptance(RegisterRequest request) {
        if (!Boolean.TRUE.equals(request.getTermsAccepted())) {
            throw new IllegalArgumentException("Terms acceptance is required");
        }
        if (!Boolean.TRUE.equals(request.getPrivacyAccepted())) {
            throw new IllegalArgumentException("Privacy acknowledgment is required");
        }
        if (legalConfig.getTermsVersion() == null || !legalConfig.getTermsVersion().equals(request.getTermsVersion())) {
            throw new IllegalArgumentException("Terms version mismatch");
        }
        if (legalConfig.getPrivacyVersion() == null || !legalConfig.getPrivacyVersion().equals(request.getPrivacyVersion())) {
            throw new IllegalArgumentException("Privacy version mismatch");
        }
    }
}
