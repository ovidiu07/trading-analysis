package com.tradevault.service.mail;

public record VerificationEmailContent(
        String locale,
        String subject,
        String preheader,
        String htmlBody,
        String textBody,
        String replyTo,
        String supportEmail
) {
}
