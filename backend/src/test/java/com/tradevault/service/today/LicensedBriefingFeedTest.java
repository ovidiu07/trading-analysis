package com.tradevault.service.today;
import org.junit.jupiter.api.Test;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import static org.assertj.core.api.Assertions.*;
class LicensedBriefingFeedTest {
 ObjectMapper mapper=new ObjectMapper(); LicensedBriefingFeed feed=new LicensedBriefingFeed(mapper);
 @Test void excludesFutureKnowledgeAndKeepsUpcomingForecastWithoutActual() throws Exception {
  var input=mapper.readTree("""
   {"news":[{"title":"future","source":"QA","url":"https://example.test","time":"2026-09-04T15:00:00Z","availableAt":"2026-09-04T15:00:00Z"}],
   "events":[{"title":"Release","source":"QA","url":"https://example.test","time":"2026-09-04T16:00:00Z","availableAt":"2026-09-01T12:00:00Z","actual":9,"forecast":4,"previous":3}]}
   """);
  var result=feed.normalize(input,Instant.parse("2026-09-04T14:00:00Z"));
  assertThat(result.path("news").size()).isZero(); assertThat(result.path("events").get(0).has("actual")).isFalse(); assertThat(result.path("events").get(0).path("forecast").asInt()).isEqualTo(4);
 }
 @Test void rejectsMixedFuturesContractsAndFutureBars() throws Exception {
  var input=mapper.readTree("""
   {"esHourly":{"contract":"ESU26","source":"Licensed QA feed","url":"https://example.test","bars":[
   {"contract":"ESZ26","time":"2026-09-04T10:00:00Z","availableAt":"2026-09-04T11:00:00Z","open":100,"high":110,"low":90,"close":105},
   {"contract":"ESU26","time":"2026-09-04T14:00:00Z","availableAt":"2026-09-04T15:00:00Z","open":100,"high":110,"low":90,"close":105},
   {"contract":"ESU26","time":"2026-09-04T10:00:00Z","availableAt":"2026-09-04T11:00:00Z","open":100,"high":110,"low":90,"close":105}]}}
   """);
  assertThat(feed.normalize(input,Instant.parse("2026-09-04T14:00:00Z")).path("esHourly").path("bars").size()).isEqualTo(1);
 }
 @Test void yieldChangesAreBasisPointsAndOldLiveQuotesBecomeStale() throws Exception {
  var input=mapper.readTree("""
   {"macro":[{"name":"US 10Y","source":"QA","url":"https://example.test","time":"2026-09-04T12:00:00Z","availableAt":"2026-09-04T12:00:00Z","unit":"%","value":4.25,"referenceValue":4.0,"referenceTime":"2026-09-03T12:00:00Z","status":"live"}]}
   """);
  var row=feed.normalize(input,Instant.parse("2026-09-04T14:00:00Z")).path("macro").get(0);
  assertThat(row.path("change").asDouble()).isEqualTo(25); assertThat(row.path("changeUnit").asText()).isEqualTo("bps"); assertThat(row.path("status").asText()).isEqualTo("stale");
 }
}
