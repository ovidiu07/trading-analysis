package com.tradevault.service.briefing;

import java.time.*;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

/** All prose is plain text. No supplied publication, ownership, or role fields are accepted. */
public record BriefingDocument(
 @Min(1) @Max(1) int schemaVersion, @NotNull LocalDate editorialDate, @NotNull Slot slot,
 @Pattern(regexp="Europe/Bucharest") @NotNull String editorialTimezone,
 @NotNull Instant coverageStart, @NotNull Instant coverageEnd, @NotNull Instant referenceTime,
 @NotNull Coverage coverage, @NotBlank @Size(max=200) String author,
 @Pattern(regexp="en|ro") @NotNull String contentLanguage,
 @Size(max=1000) String aiDisclosure,
 @NotEmpty @Size(max=2) Map<@Pattern(regexp="en|ro") String,@NotNull @Valid Translation> translations) {
 public enum Slot { ASIA, LONDON, DAY_RECAP }
 public enum Coverage { ONGOING, COMPLETE }
 public record Translation(@NotBlank @Size(max=255) String title,
  @NotNull @Size(min=3,max=5) List<@NotBlank @Size(max=500) String> summary,
  @NotNull @Size(max=100) List<@NotNull @Valid Fact> facts,
  @NotNull @Size(max=5) List<@NotNull @Valid News> news,
  @NotNull @Size(max=50) List<@NotNull @Valid Event> events,
  @NotNull @Size(max=20) List<@NotNull @Valid Macro> macro,
  @NotNull @Size(max=3) List<@NotNull @Valid Scenario> scenarios,
  @NotBlank @Size(max=4000) String sourcesAndLimitations) {}
 public record Fact(@NotBlank @Size(max=120) String id, Instant time,
  @NotBlank @Size(max=150) String topic, @NotBlank @Size(max=2000) String statement,
  @NotBlank @Size(max=200) String source, @Size(max=2000) String sourceUrl,
  Instant availableAt, @Size(max=500) String availabilityNotEstablished,
  @Size(max=120) String relatedFactId, Relation relationship) {}
 public enum Relation { UPDATE, CORRECTION, CONTINUATION }
 public record News(@NotBlank @Size(max=300) String headline, @NotNull Instant publishedAt,
  @NotBlank @Size(max=200) String source, @NotBlank @Size(max=2000) String sourceUrl,
  @NotBlank @Size(max=1500) String summary, @NotBlank @Size(max=1000) String relevance) {}
 public record Event(@NotBlank @Size(max=120) String id, @NotNull Instant scheduledAt,
  @NotBlank @Size(max=80) String timezone, @NotBlank @Size(max=100) String region,
  @NotBlank @Size(max=300) String name, @NotBlank @Size(max=200) String source,
  @Size(max=2000) String sourceUrl, @Size(max=100) String actual, @Size(max=100) String forecast,
  @Size(max=100) String previous, @Size(max=50) String unit, @Size(max=1000) String explanation,
  @NotNull EventStatus status) {}
 public enum EventStatus { RELEASED, UPCOMING, RESCHEDULED, CANCELLED }
 public record Macro(@NotBlank @Size(max=200) String instrument, @NotBlank @Size(max=100) String type,
  Double value, @NotBlank @Size(max=100) String unit, @NotNull Instant observedAt,
  @NotBlank @Size(max=200) String source, @Size(max=2000) String sourceUrl,
  Double referenceValue, Instant referenceAt, @NotBlank @Size(max=300) String availability) {}
 public record Scenario(@Pattern(regexp="DAX|NASDAQ_100|ES") @NotNull String market,
  @NotBlank @Size(max=200) String instrument, @NotBlank @Size(max=200) String source,
  @NotBlank @Size(max=100) String type, @Size(max=200) String contract,
  @NotBlank @Size(max=2000) String context, @Pattern(regexp="bullish|bearish|neutral|mixed") @NotNull String bias,
  @NotBlank @Size(max=2000) String main, @NotBlank @Size(max=2000) String alternative,
  @NotBlank @Size(max=2000) String invalidation, @NotBlank @Size(max=2000) String risks,
  @NotBlank @Size(max=2000) String limitations) {}
}
