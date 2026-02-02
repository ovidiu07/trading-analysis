package com.tradevault.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.captcha")
@Getter
@Setter
public class CaptchaConfig {
    private String turnstileSecret;
    private String turnstileSiteKey;
}
