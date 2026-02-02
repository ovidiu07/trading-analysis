package com.tradevault.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.tradevault.config.CaptchaConfig;
import com.tradevault.exception.CaptchaVerificationException;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.RestTemplateBuilder;

import java.time.Duration;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TurnstileService {
    private static final Logger log = LoggerFactory.getLogger(TurnstileService.class);
    private static final String VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    private final CaptchaConfig captchaConfig;
    private final Environment environment;
    private final RestTemplateBuilder restTemplateBuilder;

    public void verifyToken(String token, String remoteIp) {
        String secret = captchaConfig.getTurnstileSecret();
        if (secret == null || secret.isBlank()) {
            if (environment.acceptsProfiles(Profiles.of("local", "dev"))) {
                log.warn("Turnstile secret key missing. CAPTCHA bypass enabled for local/dev profile.");
                return;
            }
            throw new CaptchaVerificationException("Captcha verification unavailable");
        }
        if (token == null || token.isBlank()) {
            throw new CaptchaVerificationException("Captcha token is required");
        }
        RestTemplate restTemplate = restTemplateBuilder
                .setConnectTimeout(Duration.ofSeconds(4))
                .setReadTimeout(Duration.ofSeconds(6))
                .build();
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("secret", secret);
        body.add("response", token);
        if (remoteIp != null && !remoteIp.isBlank()) {
            body.add("remoteip", remoteIp);
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);
        try {
            TurnstileResponse response = restTemplate.postForObject(VERIFY_URL, request, TurnstileResponse.class);
            if (response == null || !response.success()) {
                throw new CaptchaVerificationException("Captcha verification failed");
            }
        } catch (RestClientException ex) {
            throw new CaptchaVerificationException("Captcha verification failed");
        }
    }

    public record TurnstileResponse(
            boolean success,
            @JsonProperty("error-codes") List<String> errorCodes
    ) { }
}
