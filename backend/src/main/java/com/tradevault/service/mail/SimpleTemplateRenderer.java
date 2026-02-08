package com.tradevault.service.mail;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Service
public class SimpleTemplateRenderer implements TemplateRenderer {
    @Override
    public String render(String templatePath, Map<String, String> variables) {
        String template = loadTemplate(templatePath);
        String rendered = template;
        if (variables != null) {
            for (Map.Entry<String, String> entry : variables.entrySet()) {
                String key = entry.getKey();
                String value = entry.getValue() == null ? "" : entry.getValue();
                rendered = rendered.replace("{{" + key + "}}", value);
                rendered = rendered.replace("${" + key + "}", value);
            }
        }
        return rendered;
    }

    private String loadTemplate(String templatePath) {
        try {
            ClassPathResource resource = new ClassPathResource(templatePath);
            return new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to load mail template: " + templatePath, ex);
        }
    }
}
