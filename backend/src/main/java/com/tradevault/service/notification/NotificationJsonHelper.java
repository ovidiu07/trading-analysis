package com.tradevault.service.notification;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class NotificationJsonHelper {
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};

    private final ObjectMapper objectMapper;

    public String writeStringList(Collection<String> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(values);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid list payload");
        }
    }

    public String writeUuidList(Collection<UUID> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        List<String> asStrings = values.stream()
                .map(UUID::toString)
                .toList();
        return writeStringList(asStrings);
    }

    public List<String> readStringList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, STRING_LIST);
        } catch (Exception ex) {
            return List.of();
        }
    }

    public List<UUID> readUuidList(String json) {
        return readStringList(json).stream()
                .map(this::safeUuid)
                .filter(value -> value != null)
                .toList();
    }

    public String writePayload(NotificationEventPayload payload) {
        if (payload == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid payload");
        }
    }

    public NotificationEventPayload readPayload(String payloadJson) {
        if (payloadJson == null || payloadJson.isBlank()) {
            return new NotificationEventPayload(null, null, null, null, null);
        }
        try {
            return objectMapper.readValue(payloadJson, NotificationEventPayload.class);
        } catch (Exception ex) {
            return new NotificationEventPayload(null, null, null, null, null);
        }
    }

    public List<String> normalizeTags(Collection<String> rawValues) {
        return normalizeStringValues(rawValues, false);
    }

    public List<String> normalizeSymbols(Collection<String> rawValues) {
        return normalizeStringValues(rawValues, true);
    }

    private List<String> normalizeStringValues(Collection<String> rawValues, boolean uppercase) {
        if (rawValues == null || rawValues.isEmpty()) {
            return List.of();
        }
        Set<String> unique = new LinkedHashSet<>();
        for (String rawValue : rawValues) {
            if (rawValue == null) {
                continue;
            }
            String trimmed = rawValue.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            String normalized = uppercase
                    ? trimmed.toUpperCase(Locale.ROOT)
                    : trimmed.toLowerCase(Locale.ROOT);
            unique.add(normalized);
        }
        return unique.stream().sorted().toList();
    }

    private UUID safeUuid(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
