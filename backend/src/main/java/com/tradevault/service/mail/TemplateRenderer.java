package com.tradevault.service.mail;

import java.util.Map;

public interface TemplateRenderer {
    String render(String templatePath, Map<String, String> variables);
}
