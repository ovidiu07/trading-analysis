package com.tradevault.service.backtesting;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;

/** Entry-time research sessions, using the user's Bucharest clock windows. */
public final class BacktestingSessionClassifier {
    public static final String TIMEZONE = "Europe/Bucharest";
    private BacktestingSessionClassifier() {}

    public static String classify(LocalDate date, LocalTime entryTime, String sourceTimezone) {
        if (date == null || entryTime == null) return null;
        ZoneId bucharest = ZoneId.of(TIMEZONE);
        ZoneId source = sourceTimezone == null || sourceTimezone.isBlank() ? bucharest : ZoneId.of(sourceTimezone.trim());
        LocalTime clock = date.atTime(entryTime).atZone(source).withZoneSameInstant(bucharest).toLocalTime();
        int minute = clock.getHour() * 60 + clock.getMinute();
        if (minute >= 10 * 60 + 30 && minute <= 16 * 60 + 25) return "London";
        if (minute >= 16 * 60 + 30 && minute <= 23 * 60) return "New York";
        return null;
    }
}
