package com.tradevault.service;

import com.tradevault.domain.entity.User;
import org.springframework.stereotype.Service;

import java.time.DateTimeException;
import java.time.ZoneId;

@Service
public class TimezoneService {
    public static final String DEFAULT_TIMEZONE = "Europe/Bucharest";

    public ZoneId resolveZone(String tz, User user) {
        String candidate = tz;
        if (candidate == null || candidate.isBlank()) {
            candidate = user != null ? user.getTimezone() : null;
        }
        if (candidate == null || candidate.isBlank()) {
            candidate = DEFAULT_TIMEZONE;
        }
        try {
            return ZoneId.of(candidate);
        } catch (DateTimeException ex) {
            return ZoneId.of(DEFAULT_TIMEZONE);
        }
    }
}
