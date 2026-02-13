package com.tradevault.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.mail")
@Getter
@Setter
public class MailConfig {
    private String fromName;
    private String fromAddress;
    private String replyToAddress;
    private String templateBaseUrl;
    private String supportEmail;
    private String contactEmail;
    private String logoUrl;
}
