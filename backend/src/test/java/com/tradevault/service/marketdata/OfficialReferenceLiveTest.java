package com.tradevault.service.marketdata;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.service.briefing.events.EiaWeeklyParser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.time.Instant;
import static org.assertj.core.api.Assertions.*;

/** Optional public read-only download smoke test. No credentials or database writes. */
@EnabledIfEnvironmentVariable(named="OFFICIAL_REFERENCE_LIVE_TEST",matches="true")
class OfficialReferenceLiveTest {
    @Test void officialEcbDownloadParses() throws Exception {
        var rows=EcbReferenceProvider.parse(OfficialReferenceHttp.get(OfficialReferenceHttp.ECB),Instant.now());
        assertThat(rows).hasSize(2);assertThat(rows).allMatch(r->r.value().signum()>0);
    }
    @Test void officialEiaDownloadParsesOnlyPublishedRelease() throws Exception {
        var root=new ObjectMapper().readTree(OfficialReferenceHttp.get(OfficialReferenceHttp.EIA));
        var event=new EiaWeeklyParser().parse(root,Instant.now());
        assertThat(event.seriesId()).isEqualTo("WCESTUS1");assertThat(event.publishedAt()).isBeforeOrEqualTo(Instant.now());
    }
}
