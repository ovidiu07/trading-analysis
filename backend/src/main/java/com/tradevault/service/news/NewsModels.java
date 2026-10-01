package com.tradevault.service.news;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;

public final class NewsModels {
    private NewsModels() {}
    public enum Capability { NEWS, CALENDAR, OBSERVATIONS }
    public record Story(String id, String headline, String publisher, String url, Instant publishedAt,
                        Instant sourceUpdatedAt, String excerpt, String category, Set<String> entities) {}
    public record Figure(BigDecimal value, String series, String period, String unit, String adjustment) {
        public boolean comparable(Figure other) {
            return other != null && Objects.equals(series, other.series) && Objects.equals(period, other.period)
                && Objects.equals(unit, other.unit) && Objects.equals(adjustment, other.adjustment);
        }
    }
    public record Event(String id, String name, String region, Instant scheduledAt, LocalDate scheduledDate,
                        String sourceTimezone, String source, String url, String category, String status,
                        String referencePeriod, Figure actual, Figure forecast, Figure previous, Figure revisedPrevious,
                        Instant publishedAt, Instant sourceUpdatedAt) {}
    /** Observations have no inferred release time and are never attached to a scheduled event by guesswork. */
    public record Observation(String id, String name, String region, String source, String url, Figure actual,
                              Figure previous, Instant sourceUpdatedAt, String flag) {}
    public record Payload(List<Story> news, List<Event> events, List<Observation> observations) {
        public static Payload news(List<Story> rows) { return new Payload(rows, List.of(), List.of()); }
        public static Payload events(List<Event> rows) { return new Payload(List.of(), rows, List.of()); }
        public static Payload observations(List<Observation> rows) { return new Payload(List.of(), List.of(), rows); }
    }
    public record Coverage(String source, String feedId, Capability capability, String state, Instant lastSuccessAt,
                           Instant lastAttemptAt, Instant nextRefreshAt) {}
    public record Snapshot(String instrument, String topic, LocalDate date, String timezone, Instant asOf,
                           String window, List<Story> news, List<Event> events, List<Observation> observations,
                           List<Coverage> coverage, Instant lastSuccessAt, boolean historical) {}
    public record Window(Instant start, Instant end) {
        public static Window session(LocalDate date, ZoneId zone) {
            return new Window(date.atStartOfDay(zone).toInstant(), date.plusDays(1).atStartOfDay(zone).toInstant());
        }
        public boolean contains(Instant time) { return time != null && !time.isBefore(start) && time.isBefore(end); }
    }
}
