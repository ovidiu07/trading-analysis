package com.tradevault.service.mail;

import com.tradevault.config.MailConfig;
import com.tradevault.service.LocaleResolverService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class VerificationEmailComposer {
    private static final String BRAND_NAME = "TradeJAudit";
    private static final String DEFAULT_LOGO_URL = "https://tradejaudit.com/branding/tradejaudit-logo-email@2x.png";

    private final MailConfig mailConfig;
    private final MailTranslationService mailTranslationService;
    private final TemplateRenderer templateRenderer;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    public VerificationEmailContent compose(String recipientEmail,
                                            String verifyUrl,
                                            String requestedLocale,
                                            Duration linkTtl) {
        String locale = mailTranslationService.normalizeLocale(requestedLocale);
        String supportEmail = resolveSupportEmail();
        String replyTo = resolveReplyToEmail();
        String expiresIn = formatDurationLabel(locale, linkTtl);
        String subject = mailTranslationService.verification(locale, "verification.subject");
        String preheader = mailTranslationService.verification(locale, "verification.preheader");

        String htmlBody = templateRenderer.render("mail/verification.html", Map.ofEntries(
                Map.entry("lang", locale),
                Map.entry("subject", subject),
                Map.entry("preheader", preheader),
                Map.entry("brandName", BRAND_NAME),
                Map.entry("badgeText", mailTranslationService.verification(locale, "verification.badge")),
                Map.entry("logoUrl", resolveLogoUrl()),
                Map.entry("logoAlt", mailTranslationService.verification(locale, "verification.logoAlt")),
                Map.entry("headline", mailTranslationService.verification(locale, "verification.headline")),
                Map.entry("greeting", mailTranslationService.verification(locale, "verification.greeting", recipientEmail)),
                Map.entry("intro", mailTranslationService.verification(locale, "verification.intro")),
                Map.entry("ctaText", mailTranslationService.verification(locale, "verification.cta")),
                Map.entry("verifyUrl", verifyUrl),
                Map.entry("fallbackLabel", mailTranslationService.verification(locale, "verification.fallbackLabel")),
                Map.entry("expiryText", mailTranslationService.verification(locale, "verification.expiry", expiresIn)),
                Map.entry("ignoreText", mailTranslationService.verification(locale, "verification.ignore")),
                Map.entry("securityText", mailTranslationService.verification(locale, "verification.security")),
                Map.entry("helpPrefix", mailTranslationService.verification(locale, "verification.helpPrefix")),
                Map.entry("supportEmail", supportEmail),
                Map.entry("footerDisclaimer", mailTranslationService.verification(locale, "verification.footer.disclaimer")),
                Map.entry("termsUrl", buildPublicUrl(locale, "/en/terms/", "/ro/terms/")),
                Map.entry("privacyUrl", buildPublicUrl(locale, "/en/privacy/", "/ro/privacy/")),
                Map.entry("cookiesUrl", buildPublicUrl(locale, "/en/cookies/", "/ro/cookies/")),
                Map.entry("termsLabel", mailTranslationService.verification(locale, "verification.footer.terms")),
                Map.entry("privacyLabel", mailTranslationService.verification(locale, "verification.footer.privacy")),
                Map.entry("cookiesLabel", mailTranslationService.verification(locale, "verification.footer.cookies"))
        ));

        String textBody = String.join("\n",
                mailTranslationService.verification(locale, "verification.text.title"),
                "",
                mailTranslationService.verification(locale, "verification.greeting", recipientEmail),
                "",
                mailTranslationService.verification(locale, "verification.intro"),
                "",
                mailTranslationService.verification(locale, "verification.text.cta", verifyUrl),
                "",
                mailTranslationService.verification(locale, "verification.expiry", expiresIn),
                mailTranslationService.verification(locale, "verification.ignore"),
                mailTranslationService.verification(locale, "verification.helpPrefix") + " " + supportEmail,
                "",
                mailTranslationService.verification(locale, "verification.footer.disclaimer")
        );

        return new VerificationEmailContent(
                locale,
                subject,
                preheader,
                htmlBody,
                textBody,
                replyTo,
                supportEmail
        );
    }

    private String formatDurationLabel(String locale, Duration duration) {
        long seconds = duration.getSeconds();
        if (seconds > 0 && seconds % 3600 == 0) {
            long hours = seconds / 3600;
            return mailTranslationService.verification(locale, "duration.hours", hours);
        }
        if (seconds > 0 && seconds % 60 == 0) {
            long minutes = seconds / 60;
            return mailTranslationService.verification(locale, "duration.minutes", minutes);
        }
        return mailTranslationService.verification(locale, "duration.seconds", Math.max(seconds, 0));
    }

    private String resolveSupportEmail() {
        if (mailConfig.getSupportEmail() != null && !mailConfig.getSupportEmail().isBlank()) {
            return mailConfig.getSupportEmail();
        }
        if (mailConfig.getContactEmail() != null && !mailConfig.getContactEmail().isBlank()) {
            return mailConfig.getContactEmail();
        }
        if (mailConfig.getFromAddress() != null && !mailConfig.getFromAddress().isBlank()) {
            return mailConfig.getFromAddress();
        }
        return "support@tradejaudit.com";
    }

    private String resolveReplyToEmail() {
        if (mailConfig.getReplyToAddress() != null && !mailConfig.getReplyToAddress().isBlank()) {
            return mailConfig.getReplyToAddress();
        }
        String supportEmail = resolveSupportEmail();
        if (supportEmail != null && !supportEmail.isBlank()) {
            return supportEmail;
        }
        return "contact@tradejaudit.com";
    }

    private String resolveLogoUrl() {
        if (mailConfig.getLogoUrl() != null && !mailConfig.getLogoUrl().isBlank()) {
            return mailConfig.getLogoUrl();
        }
        return DEFAULT_LOGO_URL;
    }

    private String buildPublicUrl(String locale, String englishPath, String romanianPath) {
        String targetPath = LocaleResolverService.ROMANIAN_LOCALE.equals(locale) ? romanianPath : englishPath;
        return UriComponentsBuilder.fromHttpUrl(frontendUrl)
                .replacePath(targetPath)
                .replaceQuery(null)
                .toUriString();
    }
}
