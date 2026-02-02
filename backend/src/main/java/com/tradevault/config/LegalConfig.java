package com.tradevault.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.legal")
@Getter
@Setter
public class LegalConfig {
    private String termsVersion;
    private String privacyVersion;
}
