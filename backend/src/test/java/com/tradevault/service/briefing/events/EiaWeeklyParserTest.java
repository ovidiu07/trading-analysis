package com.tradevault.service.briefing.events;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.time.*;
import static org.assertj.core.api.Assertions.*;

class EiaWeeklyParserTest {
    ObjectMapper mapper=new ObjectMapper().findAndRegisterModules();
    String fixture="""
      {"metadata":{"source":"U.S. Energy Information Administration","release_name":"Weekly Petroleum Status Report","data_description":"Commercial Crude Oil Stocks (Excluding SPR)","periodicity":"Weekly","release_date":"2026-09-23","release_time":"10:30 am","time_period":{"end_date":"2026-09-18"}},
      "data":{"U.S.":{"sourcekey":"WCESTUS1","units":"thousand barrels","time_series":[{"date":"2026-09-18","value":400000,"suppression_flag":null},{"date":"2026-09-11","value":410000,"suppression_flag":null}]}}}
      """;
    OfficialEvent parse(String text,String now) throws Exception {return new EiaWeeklyParser().parse(mapper.readTree(text),Instant.parse(now));}
    @Test void selectsExactWeekNotArrayOrderAndConvertsPublicationWithDst() throws Exception {
        var e=parse(fixture,"2026-09-25T15:00:00Z");
        assertThat(e.actual()).isEqualTo("400000");assertThat(e.publishedAt()).isEqualTo(Instant.parse("2026-09-23T14:30:00Z"));
        assertThat(e.referencePeriod()).isEqualTo("2026-09-18");assertThat(e.sourceId()).isEqualTo(OfficialEvent.Source.EIA);
        try (var factory=jakarta.validation.Validation.buildDefaultValidatorFactory()) { assertThat(factory.getValidator().validate(e.briefing(java.util.UUID.randomUUID()))).isEmpty(); }
        assertThat(e.scheduledAt()).isNull();assertThat(e.briefing(java.util.UUID.randomUUID()).forecast()).isNull();
        assertThat(parse(fixture.replace("2026-09-23","2026-12-23"),"2026-12-25T16:00:00Z").publishedAt()).isEqualTo(Instant.parse("2026-12-23T15:30:00Z"));
    }
    @Test void embargoMissingSuppressedWrongSeriesAndUnitsFailClosed() {
        assertThatThrownBy(()->parse(fixture,"2026-09-23T14:29:59Z")).hasMessageContaining("withheld");
        for(String bad:new String[]{fixture.replace("WCESTUS1","WCRSTUS1"),fixture.replace("thousand barrels","USD"),fixture.replace("\"suppression_flag\":null","\"suppression_flag\":\"--\""),fixture.replace("\"value\":400000","\"value\":null")})
            assertThatThrownBy(()->parse(bad,"2026-09-25T15:00:00Z")).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void unchangedRetrievalDeduplicatesButRevisedActualIsPreserved() throws Exception {
        var a=parse(fixture,"2026-09-25T15:00:00Z");var b=parse(fixture,"2026-09-25T16:00:00Z");
        assertThat(OfficialEventRevisions.fingerprint(mapper,a)).isEqualTo(OfficialEventRevisions.fingerprint(mapper,b));
        var revision=parse(fixture.replace("400000","400001"),"2026-09-25T16:00:00Z");
        assertThat(revision.eventId()).isEqualTo(a.eventId());assertThat(OfficialEventRevisions.fingerprint(mapper,revision)).isNotEqualTo(OfficialEventRevisions.fingerprint(mapper,a));
    }
}
