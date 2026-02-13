package com.tradevault.service.mail;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class EmailMessage {
    private String to;
    private String subject;
    private String replyTo;
    private String htmlBody;
    private String textBody;
    private Map<String, String> headers;
}
