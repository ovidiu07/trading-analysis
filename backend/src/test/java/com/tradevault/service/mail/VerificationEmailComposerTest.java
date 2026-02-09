package com.tradevault.service.mail;

import com.tradevault.config.MailConfig;
import com.tradevault.service.LocaleResolverService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class VerificationEmailComposerTest {

    @Test
    void composeProducesBrandedEmailWithReplyToAndFallbackLink() {
        VerificationEmailComposer composer = newComposer();

        VerificationEmailContent content = composer.compose(
                "trader@example.com",
                "https://tradejaudit.com/verify?email=trader%40example.com&token=sample-token",
                "en-US",
                Duration.ofHours(24)
        );

        assertThat(content.locale()).isEqualTo("en");
        assertThat(content.subject()).isEqualTo("Verify your TradeJAudit email");
        assertThat(content.replyTo()).isEqualTo("support@tradejaudit.com");
        assertThat(content.htmlBody()).contains("TradeJAudit");
        assertThat(content.htmlBody()).doesNotContain("TradeVault");
        assertThat(content.htmlBody()).contains("https://tradejaudit.com/verify?email=trader%40example.com&token=sample-token");
        assertThat(content.htmlBody()).contains("max-width:600px");
        assertThat(content.htmlBody()).contains("For journaling and analytics only. Not investment advice.");
        assertThat(content.textBody()).contains("This link expires in 24 hours.");
    }

    @Test
    void composeSupportsRomanianLocalization() {
        VerificationEmailComposer composer = newComposer();

        VerificationEmailContent content = composer.compose(
                "trader@example.com",
                "https://tradejaudit.com/verify?email=trader%40example.com&token=sample-token",
                "ro-RO",
                Duration.ofHours(24)
        );

        assertThat(content.locale()).isEqualTo("ro");
        assertThat(content.subject()).isEqualTo("Verifica-ti adresa de email TradeJAudit");
        assertThat(content.htmlBody()).contains("Confirma adresa de email");
        assertThat(content.htmlBody()).contains("Acest link expira in 24 de ore.");
        assertThat(content.htmlBody()).contains("/ro/terms/");
        assertThat(content.textBody()).contains("Doar pentru jurnalizare si analytics.");
    }

    @Test
    void composeWritesPreviewHtmlFilesForManualClientChecks() throws IOException {
        VerificationEmailComposer composer = newComposer();
        Path previewDir = Path.of("target", "mail-preview");
        Files.createDirectories(previewDir);

        VerificationEmailContent english = composer.compose(
                "preview@example.com",
                "https://tradejaudit.com/verify?email=preview%40example.com&token=preview-token",
                "en",
                Duration.ofHours(24)
        );
        VerificationEmailContent romanian = composer.compose(
                "preview@example.com",
                "https://tradejaudit.com/verify?email=preview%40example.com&token=preview-token",
                "ro",
                Duration.ofHours(24)
        );

        Path englishPath = previewDir.resolve("verification-en.html");
        Path romanianPath = previewDir.resolve("verification-ro.html");
        Files.writeString(englishPath, english.htmlBody(), StandardCharsets.UTF_8);
        Files.writeString(romanianPath, romanian.htmlBody(), StandardCharsets.UTF_8);

        assertThat(Files.exists(englishPath)).isTrue();
        assertThat(Files.exists(romanianPath)).isTrue();
        assertThat(Files.size(englishPath)).isGreaterThan(1000);
        assertThat(Files.size(romanianPath)).isGreaterThan(1000);
    }

    private VerificationEmailComposer newComposer() {
        MailConfig mailConfig = new MailConfig();
        mailConfig.setFromName("TradeJAudit");
        mailConfig.setFromAddress("no-reply@tradejaudit.com");
        mailConfig.setReplyToAddress("support@tradejaudit.com");
        mailConfig.setSupportEmail("support@tradejaudit.com");
        mailConfig.setContactEmail("contact@tradejaudit.com");
        mailConfig.setLogoUrl("https://tradejaudit.com/branding/tradejaudit-logo-email@2x.png");

        MailTranslationService translationService = new MailTranslationService(new LocaleResolverService());
        VerificationEmailComposer composer = new VerificationEmailComposer(mailConfig, translationService, new SimpleTemplateRenderer());
        ReflectionTestUtils.setField(composer, "frontendUrl", "https://tradejaudit.com");
        return composer;
    }
}
