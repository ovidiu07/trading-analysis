package com.tradevault.service.briefing.events;

import com.fasterxml.jackson.databind.*;
import com.tradevault.service.briefing.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class OfficialEventPipelineTest {
    ObjectMapper mapper=new ObjectMapper().findAndRegisterModules().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    Instant now=Instant.parse("2026-09-25T14:00:00Z");
    String calendar(String body){return "BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:test-1\nSUMMARY:Employment\\, situation\n"+body+"\nEND:VEVENT\nEND:VCALENDAR";}
    OfficialEvent parse(String body){return new OfficialCalendarParser().parse(OfficialEvent.Source.BLS,calendar(body),now).getFirst();}
    @ParameterizedTest @CsvSource({"20260306T083000,2026-03-06T13:30:00Z","20260313T083000,2026-03-13T12:30:00Z","20261030T083000,2026-10-30T12:30:00Z","20261106T083000,2026-11-06T13:30:00Z"})
    void usReleaseTimesFollowUsDstNotEuropeanDst(String local,String expected){assertThat(parse("DTSTART;TZID=America/New_York:"+local).scheduledAt()).isEqualTo(Instant.parse(expected));}
    @ParameterizedTest @CsvSource({"20260327T110000,2026-03-27T10:00:00Z","20260330T110000,2026-03-30T09:00:00Z","20261023T110000,2026-10-23T09:00:00Z","20261026T110000,2026-10-26T10:00:00Z"})
    void europeanReleaseTimesFollowEuropeanDst(String local,String expected) {
        var event=new OfficialCalendarParser().parse(OfficialEvent.Source.EUROSTAT,calendar("DTSTART;VALUE=DATE-TIME;TZID=Europe/Luxembourg:"+local),now).getFirst();
        assertThat(event.scheduledAt()).isEqualTo(Instant.parse(expected));
    }
    @Test void invalidCalendarDatesAreNeverSilentlyCoerced() {
        assertThatThrownBy(()->parse("DTSTART;VALUE=DATE-TIME:20260230T123000Z")).isInstanceOf(java.time.DateTimeException.class);
    }
    @Test void eurostatEscapedFeedRetainsDateOnlyAndDeduplicatesChangingNativeUid() {
        var parser=new OfficialCalendarParser();String text=calendar("DTSTART;VALUE=DATE:20260925").replace("\n","\\r\\n");
        var a=parser.parse(OfficialEvent.Source.EUROSTAT,text,now).getFirst();
        var b=parser.parse(OfficialEvent.Source.EUROSTAT,text.replace("test-1","new-source-uid"),now.plusSeconds(60)).getFirst();
        assertThat(a.scheduledAt()).isNull();assertThat(a.sourceTimezone()).isEqualTo("Europe/Luxembourg");
        assertThat(a.scheduledDate()).isEqualTo(LocalDate.parse("2026-09-25"));
        assertThat(a.eventId()).isEqualTo(b.eventId());assertThat(a.sourceEventId()).isNotEqualTo(b.sourceEventId());
        assertThat(OfficialEventRevisions.fingerprint(mapper,a)).isEqualTo(OfficialEventRevisions.fingerprint(mapper,b));
    }
    @Test void unfoldsTextAndKeepsUtcInstantWithSourceTimezone() {
        var e=new OfficialCalendarParser().parse(OfficialEvent.Source.BLS,calendar("DTSTART:20260925T123000Z").replace("Employment\\, situation","Employment\\,\n situation"),now).getFirst();
        assertThat(e.name()).isEqualTo("Employment,situation");assertThat(e.scheduledAt()).isEqualTo(Instant.parse("2026-09-25T12:30:00Z"));assertThat(e.sourceTimezone()).isEqualTo("America/New_York");
    }
    @Test void rejectsAmbiguousAndMissingDstTimesRecurrenceAndForeignLinks() {
        for(String body:List.of("DTSTART;TZID=America/New_York:20261101T013000","DTSTART;TZID=America/New_York:20260308T023000",
            "DTSTART:20260925T123000Z\nRRULE:FREQ=DAILY","DTSTART:20260925T123000Z\nURL:https://unofficial.example/calendar"))
            assertThatThrownBy(()->parse(body)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void duplicateUidDoesNotAppendAndConflictingDuplicateFails() {
        String one=calendar("DTSTART:20260925T123000Z");String event=one.substring(one.indexOf("BEGIN:VEVENT"),one.indexOf("END:VCALENDAR"));
        assertThat(new OfficialCalendarParser().parse(OfficialEvent.Source.BLS,one.replace("END:VCALENDAR",event+"END:VCALENDAR"),now)).hasSize(1);
        assertThatThrownBy(()->new OfficialCalendarParser().parse(OfficialEvent.Source.BLS,one.replace("END:VCALENDAR",event.replace("123000","133000")+"END:VCALENDAR"),now)).hasMessageContaining("Conflicting");
    }
    @Test void rescheduleAndCancellationPreserveEarlierObservationAndClearResults() {
        var old=parse("DTSTART:20260925T123000Z\nSEQUENCE:1").result("4.1","%",now.minusSeconds(100),"https://www.bls.gov/news.release/empsit.nr0.htm","https://api.bls.gov/","LNS14000000","2026-08","Unemployment",null,now);
        var moved=OfficialEventRevisions.calendar(old,parse("DTSTART:20260926T123000Z\nSEQUENCE:2"));
        assertThat(moved.status()).isEqualTo(BriefingDocument.EventStatus.RESCHEDULED);assertThat(moved.previousScheduledAt()).isEqualTo(old.scheduledAt());assertThat(moved.actual()).isNull();
        var cancelled=OfficialEventRevisions.calendar(old,parse("DTSTART:20260925T123000Z\nSEQUENCE:3\nSTATUS:CANCELLED"));
        assertThat(cancelled.status()).isEqualTo(BriefingDocument.EventStatus.CANCELLED);assertThat(cancelled.actual()).isNull();assertThat(old.actual()).isEqualTo("4.1");
        assertThat(OfficialEventRevisions.older(cancelled,old)).isTrue();
        assertThat(OfficialEventRevisions.calendar(old,parse("DTSTART:20260925T123000Z\nSEQUENCE:1")).actual()).isEqualTo("4.1");
        var refreshed=new OfficialCalendarParser().parse(OfficialEvent.Source.BLS,calendar("DTSTART:20260925T123000Z\nSEQUENCE:2"),now.plusSeconds(60)).getFirst();
        var retained=OfficialEventRevisions.calendar(old,refreshed);
        assertThat(retained.retrievedAt()).isEqualTo(now.plusSeconds(60));
        assertThat(retained.resultRetrievedAt()).isEqualTo(now);
        assertThat(cancelled.resultRetrievedAt()).isNull();
    }
    @Test void blsUsesExactSeriesAndMonthNeverLatestOrAnnualAverage() throws Exception {
        var json=mapper.readTree("""
          {"status":"REQUEST_SUCCEEDED","message":[],"Results":{"series":[{"seriesID":"LNS14000000","data":[
          {"year":"2026","period":"M09","value":"9.9"},{"year":"2026","period":"M13","value":"8.8"},
          {"year":"2026","period":"M08","value":"4.1","footnotes":[{"text":"Revised"}]}]}]}}
          """);
        var result=new OfficialResultParser().parse(OfficialResultParser.Measure.BLS_UNEMPLOYMENT,YearMonth.of(2026,8),json);
        assertThat(result.actual()).isEqualTo("4.1");assertThat(result.notes()).contains("Revised","BLS.gov cannot vouch");
        assertThatThrownBy(()->new OfficialResultParser().parse(OfficialResultParser.Measure.BLS_CPI_INDEX,YearMonth.of(2026,8),json)).hasMessageContaining("unavailable");
    }
    JsonNode eurostat() {
        var root=mapper.createObjectNode().put("source","ESTAT").put("class","dataset");root.putObject("extension").put("id","UNE_RT_M");root.putObject("value").put("0",6.1);
        var ids=root.putArray("id");var sizes=root.putArray("size");var dimensions=root.putObject("dimension");
        Map.of("freq","M","unit","PC_ACT","s_adj","SA","age","TOTAL","sex","T","geo","EU27_2020","time","2026-07").forEach((key,value)->{ids.add(key);sizes.add(1);dimensions.putObject(key).putObject("category").putObject("index").put(value,0);});return root;
    }
    @Test void eurostatValidatesExactDimensionsSourceAndSparseMissingValues() {
        var json=eurostat();var parser=new OfficialResultParser();var measure=OfficialResultParser.Measure.EUROSTAT_EU_UNEMPLOYMENT;
        assertThat(parser.parse(measure,YearMonth.of(2026,7),json).actual()).isEqualTo("6.1");
        assertThatThrownBy(()->parser.parse(measure,YearMonth.of(2026,8),json)).hasMessageContaining("dimensions");
        ((com.fasterxml.jackson.databind.node.ObjectNode)json.path("value")).removeAll();
        assertThatThrownBy(()->parser.parse(measure,YearMonth.of(2026,7),json)).hasMessageContaining("unavailable");
    }
    @Test void publicationGateBlocksFutureUnreviewedWrongSourceAndCancelledBeforeFetch() {
        var event=parse("DTSTART:20260925T123000Z");
        var request=new OfficialEventService.ResultRequest(OfficialResultParser.Measure.BLS_UNEMPLOYMENT,YearMonth.of(2026,8),now.plusSeconds(1),"https://www.bls.gov/news.release/empsit.nr0.htm",true);
        assertThatThrownBy(()->OfficialEventService.validateResult(event,request,now)).hasMessageContaining("not eligible");
        assertThatThrownBy(()->OfficialEventService.validateResult(event,new OfficialEventService.ResultRequest(request.measure(),request.period(),now,request.publicationSourceUrl(),false),now)).hasMessageContaining("Review");
        assertThatThrownBy(()->OfficialEventService.validateResult(event,new OfficialEventService.ResultRequest(OfficialResultParser.Measure.EUROSTAT_EU_UNEMPLOYMENT,request.period(),now,request.publicationSourceUrl(),true),now)).hasMessageContaining("Review");
        assertThatThrownBy(()->OfficialEventService.validateResult(parse("DTSTART:20260925T123000Z\nSTATUS:CANCELLED"),new OfficialEventService.ResultRequest(request.measure(),request.period(),now,request.publicationSourceUrl(),true),now)).hasMessageContaining("not eligible");
    }
    @Test void unavailableCalendarRecordsFailureWithoutStagingOrPublishing() {
        var store=mock(OfficialEventStore.class);var http=mock(OfficialEventHttpClient.class);var users=mock(com.tradevault.service.CurrentUserService.class);var user=mock(com.tradevault.domain.entity.User.class);UUID id=UUID.randomUUID(),run=UUID.randomUUID();
        when(users.getCurrentUser()).thenReturn(user);when(user.getId()).thenReturn(id);when(store.reserve(any(),anyString(),anyString(),any(),any())).thenReturn(run);
        when(http.get(anyString())).thenThrow(new IllegalStateException("Official source HTTP 403"));
        var service=new OfficialEventService(store,http,mapper,users);
        assertThatThrownBy(()->service.refresh(OfficialEvent.Source.BLS)).hasMessageContaining("403");
        verify(store).finish(eq(run),eq("FAILED"),contains("403"),eq(0));verify(store,never()).stage(any(),any(),anyList(),anyBoolean(),any());
    }
    @Test void publicReadGuardNeverMutatesSnapshotOrRevealsEmbargoedActual() throws Exception {
        var raw=mapper.readTree("""
         {"document":{"referenceTime":"2026-09-25T14:00:00Z","translations":{"en":{"events":[{"status":"RELEASED","actual":"SECRET","publishedAt":"2026-09-25T14:00:01Z","forecast":"9"}]}}}}
         """);
        var safe=EventPublicationGuard.safeCopy(raw,now);assertThat(safe.toString()).doesNotContain("SECRET","\"forecast\":\"9\"");assertThat(raw.toString()).contains("SECRET");
    }
    @Test void resultEndpointsRejectUnapprovedHostsWithoutNetwork() {
        assertThatThrownBy(()->new OfficialEventHttpClient().get("https://unofficial.example/calendar")).hasMessageContaining("allowlisted");
    }
}
