package com.tradevault.service.mail;

import com.tradevault.service.LocaleResolverService;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.text.MessageFormat;
import java.util.Map;
import java.util.Properties;

@Component
public class MailTranslationService {
    private static final String VERIFICATION_BUNDLE_BASE_PATH = "mail/i18n/verification_";

    private final LocaleResolverService localeResolverService;
    private final Map<String, Properties> verificationBundles;

    public MailTranslationService(LocaleResolverService localeResolverService) {
        this.localeResolverService = localeResolverService;
        this.verificationBundles = Map.of(
                LocaleResolverService.DEFAULT_LOCALE, loadProperties(VERIFICATION_BUNDLE_BASE_PATH + "en.properties"),
                LocaleResolverService.ROMANIAN_LOCALE, loadProperties(VERIFICATION_BUNDLE_BASE_PATH + "ro.properties")
        );
    }

    public String normalizeLocale(String requestedLocale) {
        String normalized = localeResolverService.normalizeLocale(requestedLocale);
        if (normalized == null || normalized.isBlank()) {
            return LocaleResolverService.DEFAULT_LOCALE;
        }
        return normalized;
    }

    public String verification(String requestedLocale, String key, Object... args) {
        String locale = normalizeLocale(requestedLocale);
        String pattern = getVerificationPattern(locale, key);
        if (pattern == null) {
            pattern = getVerificationPattern(LocaleResolverService.DEFAULT_LOCALE, key);
        }
        if (pattern == null) {
            return key;
        }
        if (args == null || args.length == 0) {
            return pattern;
        }
        return MessageFormat.format(pattern, args);
    }

    private String getVerificationPattern(String locale, String key) {
        Properties bundle = verificationBundles.get(locale);
        if (bundle == null) {
            return null;
        }
        return bundle.getProperty(key);
    }

    private Properties loadProperties(String path) {
        try {
            ClassPathResource resource = new ClassPathResource(path);
            Properties properties = new Properties();
            try (InputStreamReader reader = new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8)) {
                properties.load(reader);
            }
            return properties;
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to load mail translation bundle: " + path, ex);
        }
    }
}
