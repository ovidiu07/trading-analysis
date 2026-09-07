package com.tradevault.service.briefing;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.validation.Validation;
import org.junit.jupiter.api.*;
import java.time.Instant;
import static org.assertj.core.api.Assertions.*;
class BriefingValidatorTest {
 ObjectMapper mapper=new ObjectMapper().registerModule(new JavaTimeModule());
 BriefingValidator validator=new BriefingValidator(mapper,Validation.buildDefaultValidatorFactory().getValidator());
 Instant now=Instant.parse("2026-09-07T09:00:00Z");
 com.fasterxml.jackson.databind.node.ObjectNode document() throws Exception {return (com.fasterxml.jackson.databind.node.ObjectNode)mapper.readTree("""
 {"schemaVersion":1,"editorialDate":"2026-09-07","slot":"ASIA","editorialTimezone":"Europe/Bucharest","coverageStart":"2026-09-06T21:00:00Z","coverageEnd":"2026-09-07T06:00:00Z","referenceTime":"2026-09-07T06:00:00Z","coverage":"COMPLETE","author":"QA","contentLanguage":"en","translations":{"en":{"title":"QA","summary":["One","Two","Three"],"facts":[],"news":[],"events":[],"macro":[],"scenarios":[],"sourcesAndLimitations":"Synthetic data"}}}
 """);}
 @Test void acceptsOvernightDeclaredCoverage() throws Exception {assertThat(validator.parse(document(),true,now).coverageStart()).isBefore(Instant.parse("2026-09-07T00:00:00Z"));}
 @Test void futureReferenceRejected() throws Exception {var d=document();d.put("referenceTime","2099-01-01T00:00:00Z");assertThatThrownBy(()->validator.parse(d,true,now)).hasMessageContaining("referenceTime");}
 @Test void unknownPrivilegedFieldRejected() throws Exception {var d=document();d.put("role","ADMIN");assertThatThrownBy(()->validator.parse(d,false,now)).hasMessageContaining("role");}
 @Test void futureUpcomingEventAllowedWithoutInventedActual() throws Exception {var d=document();var events=(com.fasterxml.jackson.databind.node.ArrayNode)d.path("translations").path("en").path("events");events.addObject().put("id","event-1").put("scheduledAt","2026-09-07T12:30:00Z").put("timezone","America/New_York").put("region","US").put("name","QA").put("source","QA").put("status","UPCOMING");assertThat(validator.parse(d,true,now).translations().get("en").events()).hasSize(1);}
 @Test void releasedFutureEventRejected() throws Exception {var d=document();var events=(com.fasterxml.jackson.databind.node.ArrayNode)d.path("translations").path("en").path("events");events.addObject().put("id","event-1").put("scheduledAt","2026-09-07T12:30:00Z").put("timezone","America/New_York").put("region","US").put("name","QA").put("source","QA").put("status","RELEASED");assertThatThrownBy(()->validator.parse(d,true,now)).hasMessageContaining("events.event-1");}
 @Test void explicitHistoricalAvailabilityRequired() throws Exception {var d=document();var facts=(com.fasterxml.jackson.databind.node.ArrayNode)d.path("translations").path("en").path("facts");facts.addObject().put("id","f").put("topic","QA").put("statement","QA").put("source","QA");assertThatThrownBy(()->validator.parse(d,true,now)).hasMessageContaining("availability must be stated");}
 @Test void preservesPlainTextEntitiesAndHtmlWithoutExecution() throws Exception {var d=document();((com.fasterxml.jackson.databind.node.ObjectNode)d.path("translations").path("en")).put("title","<script>alert(1)</script> &amp;");assertThat(validator.parse(d,true,now).translations().get("en").title()).isEqualTo("<script>alert(1)</script> &amp;");}
 @Test void missingTranslationCannotMasqueradeAsRomanian() throws Exception {var d=document();d.put("contentLanguage","ro");assertThatThrownBy(()->validator.parse(d,true,now)).hasMessageContaining("translation is missing");}
 @Test void completeCoverageCannotExceedReference() throws Exception {var d=document();d.put("coverageEnd","2026-09-07T12:00:00Z");assertThatThrownBy(()->validator.parse(d,true,now)).hasMessageContaining("coverageEnd");}
 @Test void unsupportedMetricsCannotBeImported() throws Exception {var d=document();d.putObject("ath").put("referencePrice",95).put("allTimeHigh",100);assertThatThrownBy(()->validator.parse(d,true,now)).hasMessageContaining("ath");}
}
