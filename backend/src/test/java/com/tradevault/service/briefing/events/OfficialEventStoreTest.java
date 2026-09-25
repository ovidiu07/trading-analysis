package com.tradevault.service.briefing.events;

import com.fasterxml.jackson.databind.*;
import com.tradevault.service.briefing.BriefingDocument;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

/** Opt-in, isolated PostgreSQL only. Apply V70 and V71 to the disposable QA schema before running. */
@EnabledIfEnvironmentVariable(named="OFFICIAL_EVENTS_TEST_DB",matches="jdbc:postgresql://localhost(?::[0-9]+)?/tradevault_events_qa_[a-z0-9_]+")
class OfficialEventStoreTest {
    JdbcTemplate jdbc;OfficialEventStore store;TransactionTemplate tx;
    ObjectMapper mapper=new ObjectMapper().findAndRegisterModules().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    UUID actor;Instant now=Instant.now();
    @BeforeEach void setup() {
        var ds=new DriverManagerDataSource(System.getenv("OFFICIAL_EVENTS_TEST_DB"),System.getProperty("user.name"),"");
        jdbc=new JdbcTemplate(ds);store=new OfficialEventStore(jdbc,mapper);tx=new TransactionTemplate(new DataSourceTransactionManager(ds));
        actor=UUID.randomUUID();jdbc.update("INSERT INTO users(id) VALUES (?)",actor);
    }
    OfficialEvent event(String id,String date) {
        return new OfficialCalendarParser().parse(OfficialEvent.Source.BLS,"BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:"+id+"\nSUMMARY:QA release\nDTSTART:"+date+"\nEND:VEVENT\nEND:VCALENDAR",now).getFirst();
    }
    UUID run(String key) {return tx.execute(s->store.reserve(OfficialEvent.Source.BLS,"CALENDAR",key,actor,now));}
    int stage(UUID run,List<OfficialEvent> events,boolean calendar,UUID expected){return tx.execute(s->store.stage(run,OfficialEvent.Source.BLS,events,calendar,expected));}
    OfficialEventStore.Revision latest(String id) {return store.list(LocalDate.of(2026,9,25)).stream().filter(r->r.event().eventId().equals(id)).findFirst().orElseThrow();}
    @Test void dedupRevisionCancellationAndDatabaseImmutability() {
        String id=UUID.randomUUID().toString();UUID run=run(id);var original=event(id,"20260925T123000Z");
        assertThat(stage(run,List.of(original),true,null)).isEqualTo(1);var first=latest(id);
        assertThat(stage(run,List.of(original),true,null)).isZero();
        var result=original.result("4.1","%",now,"https://www.bls.gov/news.release/empsit.nr0.htm","https://api.bls.gov/publicAPI/v1/timeseries/data/LNS14000000","LNS14000000","2026-08","US unemployment",null,now);
        assertThat(stage(run,List.of(result),false,first.id())).isEqualTo(1);
        var cancelled=new OfficialCalendarParser().parse(OfficialEvent.Source.BLS,"BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:"+id+"\nSUMMARY:QA release\nDTSTART:20260925T123000Z\nSTATUS:CANCELLED\nEND:VEVENT\nEND:VCALENDAR",now).getFirst();
        stage(run,List.of(cancelled),true,null);var last=latest(id);
        assertThat(last.event().actual()).isNull();assertThat(last.event().status()).isEqualTo(BriefingDocument.EventStatus.CANCELLED);
        assertThat(store.history(last.id())).hasSize(3);assertThat(store.get(first.id()).event().status()).isEqualTo(BriefingDocument.EventStatus.UPCOMING);
        assertThatThrownBy(()->jdbc.update("UPDATE official_event_revision SET revision=99 WHERE id=?",first.id())).hasMessageContaining("immutable");
        assertThatThrownBy(()->jdbc.update("DELETE FROM official_event_revision WHERE id=?",first.id())).hasMessageContaining("immutable");
    }
    @Test void failedBatchRollsBackAndDoesNotInferCancellationFromAbsence() {
        String id=UUID.randomUUID().toString();UUID run=run(id);var original=event(id,"20260925T123000Z");stage(run,List.of(original),true,null);
        var first=latest(id);assertThat(stage(run,List.of(),true,null)).isZero();assertThat(latest(id).id()).isEqualTo(first.id());
        assertThatThrownBy(()->stage(run,List.of(original),false,UUID.randomUUID())).hasMessageContaining("Suggestion changed");
        assertThat(store.history(first.id())).hasSize(1);
    }
    @Test void reviewedIdentityLinkPreservesHistoryAndDoesNotBounceBackOnNextCalendar() {
        String a=UUID.randomUUID().toString(),b=UUID.randomUUID().toString();UUID run=run(a);
        stage(run,List.of(event(a,"20260925T123000Z"),event(b,"20260925T133000Z")),true,null);
        var old=latest(a);var revised=latest(b);tx.executeWithoutResult(s->store.link(old.id(),revised.id(),actor));
        var linked=latest(a);assertThat(linked.event().status()).isEqualTo(BriefingDocument.EventStatus.RESCHEDULED);
        assertThat(linked.event().previousScheduledAt()).isEqualTo(old.event().scheduledAt());assertThat(store.get(revised.id())).isEqualTo(revised);
        assertThat(stage(run,List.of(event(a,"20260925T123000Z"),event(b,"20260925T133000Z")),true,null)).isZero();
        assertThat(store.list(LocalDate.of(2026,9,25)).stream().filter(r->r.event().eventId().equals(b))).isEmpty();
    }
    @Test void budgetsAndProvenanceAreEnforced() {
        String id=UUID.randomUUID().toString();UUID run=run(id);stage(run,List.of(event(id,"20260925T123000Z")),true,null);
        assertThatThrownBy(()->run(id)).hasMessageContaining("cooldown");
        var revision=latest(id);var e=revision.event().briefing(revision.id());
        var document=mapper.createObjectNode();document.putObject("translations").putObject("en").putArray("events").add(mapper.valueToTree(e));
        var doc=mapper.convertValue(document,BriefingDocument.class);store.verify(doc);
        ((com.fasterxml.jackson.databind.node.ObjectNode)document.path("translations").path("en").path("events").get(0)).put("actual","fabricated");
        assertThatThrownBy(()->store.verify(mapper.convertValue(document,BriefingDocument.class))).hasMessageContaining("provenance/value was changed");
    }
    @Test void eiaExactPeriodStagesDeduplicatesAndRetainsRevisedActual() throws Exception {
        var fixture=new EiaWeeklyParserTest().fixture;
        var parser=new EiaWeeklyParser();var time=Instant.parse("2026-09-25T15:00:00Z");
        var event=parser.parse(mapper.readTree(fixture),time);
        UUID run=tx.execute(s->store.reserve(OfficialEvent.Source.EIA,"RESULT",UUID.randomUUID().toString(),actor,time));
        assertThat(tx.<Integer>execute(s->store.stage(run,OfficialEvent.Source.EIA,List.of(event),false,null))).isEqualTo(1);
        var first=store.list(LocalDate.of(2026,9,23)).stream().filter(r->r.event().sourceId()==OfficialEvent.Source.EIA).findFirst().orElseThrow();
        assertThat(tx.<Integer>execute(s->store.stage(run,OfficialEvent.Source.EIA,List.of(event),false,null))).isZero();
        var revised=parser.parse(mapper.readTree(fixture.replace("400000","400001")),time.plusSeconds(1));
        assertThat(tx.<Integer>execute(s->store.stage(run,OfficialEvent.Source.EIA,List.of(revised),false,null))).isEqualTo(1);
        assertThat(store.get(first.id()).event().actual()).isEqualTo("400000");
        var last=store.list(LocalDate.of(2026,9,23)).stream().filter(r->r.event().sourceId()==OfficialEvent.Source.EIA).findFirst().orElseThrow();
        assertThat(store.history(last.id())).hasSize(2);
        var doc=mapper.createObjectNode();doc.putObject("translations").putObject("en").putArray("events").add(mapper.valueToTree(last.event().briefing(last.id())));
        store.verify(mapper.convertValue(doc,BriefingDocument.class));
    }

}
