package com.tradevault.service.marketdata;

import com.tradevault.service.briefing.events.OfficialEventHttpClient;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class EcbReferenceProviderTest {
    Instant now=Instant.parse("2026-09-25T15:00:00Z");
    String xml="<Envelope xmlns='http://www.gesmes.org/xml/2002-08-01' xmlns:e='http://www.ecb.int/vocabulary/2002-08-01/eurofxref'><e:Cube><e:Cube time='2026-09-25'><e:Cube currency='USD' rate='1.1'/><e:Cube currency='GBP' rate='0.8'/></e:Cube></e:Cube></Envelope>";
    @Test void exactUnmodifiedDailyReferencesHaveProvenance() throws Exception {
        var rows=EcbReferenceProvider.parse(xml,now);
        assertThat(rows).hasSize(2);assertThat(rows.getFirst().canonicalInstrument()).isEqualTo("ECB_EUR_USD");
        assertThat(rows.getFirst().value()).isEqualByComparingTo("1.1");
        assertThat(rows.getFirst().priceBasis()).isEqualTo("OFFICIAL_DAILY_REFERENCE");
        assertThat(rows.getFirst().unit()).isEqualTo("USD per EUR");
        assertThat(rows.getFirst().previousValue()).isNull();
    }
    @Test void rejectsFutureMissingDuplicateAndEntityPayloads() {
        for(String invalid:new String[]{xml.replace("2026-09-25","2099-01-01"),xml.replace("currency='GBP'","currency='USD'"),xml.replace("rate='1.1'","rate='-1'"),"<!DOCTYPE a [<!ENTITY x SYSTEM 'file:///etc/passwd'>]>"+xml,xml.replace("http://www.ecb.int/vocabulary/2002-08-01/eurofxref","wrong")})
            assertThatThrownBy(()->EcbReferenceProvider.parse(invalid,now)).isInstanceOf(Exception.class);
    }
    @Test void boundedCacheRetainsStaleDataAndBacksOffOnFailure() {
        var http=mock(OfficialEventHttpClient.class);when(http.get(OfficialReferenceHttp.ECB)).thenReturn(xml).thenThrow(new IllegalStateException());
        var provider=new EcbReferenceProvider(http);ReflectionTestUtils.setField(provider,"clock",Clock.fixed(now,ZoneOffset.UTC));
        provider.latest();provider.latest();verify(http,times(1)).get(OfficialReferenceHttp.ECB);
        ReflectionTestUtils.setField(provider,"clock",Clock.fixed(now.plusSeconds(3601),ZoneOffset.UTC));
        var stale=provider.latest();provider.latest();verify(http,times(2)).get(OfficialReferenceHttp.ECB);
        assertThat(stale.getFirst().freshness().name()).isEqualTo("STALE");
        assertThat(stale.getFirst().retrievedAt().toInstant()).isEqualTo(now);
    }
    @Test void onlyEiaSameHostExactDownloadRedirectIsAllowed() {
        assertThat(OfficialReferenceHttp.allowedRedirect(OfficialReferenceHttp.EIA,java.net.URI.create("https://ir.eia.gov/secure/wpsr/psw00.json?Policy=example"))).isTrue();
        for(String url:new String[]{"https://evil.test/secure/wpsr/psw00.json","http://ir.eia.gov/secure/wpsr/psw00.json","https://ir.eia.gov/another.json","https://evil@ir.eia.gov/secure/wpsr/psw00.json"})
            assertThat(OfficialReferenceHttp.allowedRedirect(OfficialReferenceHttp.EIA,java.net.URI.create(url))).isFalse();
        assertThatThrownBy(()->OfficialReferenceHttp.get("https://evil.test")).hasMessageContaining("allowlisted");
    }
}
