package com.tradevault.service.mail;

import com.tradevault.config.MailConfig;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
public class JavaMailSenderMailService implements MailService {
    private final JavaMailSender mailSender;
    private final MailConfig mailConfig;

    @SneakyThrows
    @Override
    public void send(EmailMessage message) {
        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, StandardCharsets.UTF_8.name());
            helper.setTo(message.getTo());
            helper.setSubject(message.getSubject());

            String fromAddress = mailConfig.getFromAddress();
            String fromName = mailConfig.getFromName();
            if (fromAddress != null && !fromAddress.isBlank()) {
                if (fromName != null && !fromName.isBlank()) {
                    helper.setFrom(new InternetAddress(fromAddress, fromName));
                } else {
                    helper.setFrom(fromAddress);
                }
            }

            if (message.getTextBody() != null && !message.getTextBody().isBlank()) {
                helper.setText(message.getTextBody(), message.getHtmlBody());
            } else {
                helper.setText(message.getHtmlBody(), true);
            }

            if (message.getHeaders() != null) {
                message.getHeaders().forEach((name, value) -> {
                    try {
                        mimeMessage.addHeader(name, value);
                    } catch (MessagingException e) {
                        throw new IllegalStateException("Failed to add email header: " + name, e);
                    }
                });
            }

            mailSender.send(mimeMessage);
        } catch (MessagingException ex) {
            throw new IllegalStateException("Failed to send email", ex);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to send email", ex);
        }
    }
}