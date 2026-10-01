package com.tradevault.service.news;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.*;
import java.util.*;
import static com.tradevault.service.news.NewsModels.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MarketContextProfilesTest {
    ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
    NewsProviders providers = new NewsProviders(mapper);
    Instant now = Instant.parse("2026-10-01T14:00:00Z");
    String mappings = """
        [{"identity":"NASDAQ:AAPL","symbol":"AAPL","exchange":"NASDAQ","country":"us","sector":"Technology"},
         {"identity":"LSE:SHEL","symbol":"SHEL.L","exchange":"LSE","country":"gb","sector":"Energy"},
         {"identity":"XETR:SAP","symbol":"SAP.DE","exchange":"XETRA","country":"de","sector":"Technology"}]
        """;
    void enable() {
        ReflectionTestUtils.setField(providers,"marketauxAuthorized",true);
        ReflectionTestUtils.setField(providers,"marketauxToken","fixture-secret");
        ReflectionTestUtils.setField(providers,"companyMappings",mappings);
    }
    @Test void aliasesUseExistingDaxRegistryAndExplicitFxAndEquityProfiles() {
        for(String alias:List.of("NAS","NAS100","CME_MINI:NQ1!","MNQ")) assertThat(InstrumentTopics.resolve(alias).key()).isEqualTo("US_TECH");
        for(String alias:List.of("GER40","DEU40","GERMANY40CFD","FDXM","XETR:DAX")) assertThat(InstrumentTopics.resolve(alias).key()).isEqualTo("GERMANY");
        for(String alias:List.of("UK100","FTSE100","OANDA:UK100GBP")) assertThat(InstrumentTopics.resolve(alias).key()).isEqualTo("UK_EQUITIES");
        assertThat(InstrumentTopics.resolve("EURUSD").regions()).contains("EU","US");
        assertThat(InstrumentTopics.resolve("GBPUSD").regions()).contains("UK","US");
        assertThat(InstrumentTopics.resolve("USDJPY").key()).isEqualTo("PARTIAL_FX");
        assertThat(InstrumentTopics.resolve("AAPL").key()).isEqualTo("UNSUPPORTED");
        assertThat(InstrumentTopics.resolve("LSE:SHEL").stockIdentity()).isEqualTo("LSE:SHEL");
        assertThat(InstrumentTopics.resolve("XETR:SAP").regions()).containsExactlyInAnyOrder("DE","EU");
    }
    @Test void mappingsAreExplicitUnambiguousAndRequestsNeverContainSecrets() {
        enable(); assertThat(providers.mapping("NASDAQ:AAPL")).isPresent();
        assertThat(providers.mapping("NYSE:AAPL")).isEmpty();
        assertThat(providers.mapping("AAPL")).isEmpty();
        assertThat(providers.companyFeed("LSE:SHEL").orElseThrow().url()).contains("symbols=SHEL.L","countries=gb").doesNotContain("fixture-secret");
        assertThatThrownBy(()->CompanyNewsMappings.parse(mapper,mappings.replace("\"NASDAQ\"","null"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->CompanyNewsMappings.parse(mapper,mappings.replace("LSE:SHEL","NASDAQ:AAPL"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->providers.fetch(new NewsProviders.Feed("unknown","Marketaux",Capability.NEWS,"US","https://example.org",Duration.ofHours(1),80))).isInstanceOf(IllegalArgumentException.class);
    }
    String article(String exchange) {
        return """
          {"data":[{"uuid":"s1","title":"Company update","source":"publisher.example","url":"https://publisher.example/story","published_at":"2026-10-01T12:00:00Z",
          "entities":[{"symbol":"AAPL","exchange":%s,"country":"us","type":"equity","industry":"Technology"}]}]}
          """.formatted(exchange);
    }
    @Test void directCompanyNeedsExactProviderEntityAndMissingExchangeCannotMatch() {
        enable(); var feed=providers.companyFeed("NASDAQ:AAPL").orElseThrow();
        for(String exchange:List.of("null","\"NYSE\"")) assertThat(providers.parse(feed,article(exchange),now).news()).isEmpty();
        var story=providers.parse(feed,article("\"NASDAQ\""),now).news().getFirst();
        assertThat(story.entities()).contains("NASDAQ:AAPL"); assertThat(story.publisher()).isEqualTo("publisher.example");
        assertThat(story.aggregator()).isEqualTo("Marketaux");assertThat(story.excerpt()).isNull();
        assertThat(InstrumentTopics.newsMatches(InstrumentTopics.resolve("NYSE:AAPL"),story)).isFalse();
        assertThat(InstrumentTopics.rank(InstrumentTopics.resolve("NASDAQ:AAPL"),story)).isZero();
    }
    @Test void companyDemandIsBoundedAndNoHttpRequestRunsOnSelection() {
        enable();var store=mock(NewsFeedStore.class);var service=new NewsContextService(store,providers);
        when(store.demandCompany(eq("NASDAQ:AAPL"),any())).thenReturn(false,true);
        assertThat(service.demandCompany("NASDAQ:AAPL")).isEqualTo("CAPACITY");
        assertThat(service.demandCompany("NASDAQ:AAPL")).isEqualTo("QUEUED");
        assertThat(service.demandCompany("NYSE:AAPL")).isEqualTo("MAPPING_REQUIRED");
        verify(store,never()).claim(any(),any());
    }
    @Test void calendarContractIsStableAcrossProfilesAndHistoryIsUnavailable() {
        var store=mock(NewsFeedStore.class);when(store.state(any())).thenReturn(new NewsFeedStore.State(null,null,null,"PENDING"));
        when(store.snapshots(any(),any(),any(),anyBoolean())).thenReturn(List.of());
        var service=new NewsContextService(store,providers);ReflectionTestUtils.setField(service,"clock",Clock.fixed(now,ZoneOffset.UTC));
        CalendarAccess original=null;
        for(String instrument:List.of("NAS","GER40","UK100","GBPUSD","LSE:SHEL")) {
            var result=service.snapshot(instrument,LocalDate.parse("2026-10-01"),"Europe/Bucharest","SESSION",null);
            if(original==null) original=result.calendar(); else assertThat(result.calendar()).isEqualTo(original);
            assertThat(result.calendar().events()).isEmpty(); assertThat(result.calendar().coverage()).isEqualTo("UNAVAILABLE");
            assertThat(result.coverage().stream().filter(c->c.capability()==Capability.CALENDAR)).hasSize(4);
        }
        assertThat(service.snapshot("NAS",LocalDate.parse("2026-10-01"),"Europe/Bucharest","SESSION",now.minusSeconds(60)).calendar().coverage()).isEqualTo("HISTORICAL");
    }
    @Test void onsAndDestatisAreRegionalNewsOnlyAndEmptyIsNotMalformed() {
        for(String id:List.of("ons-news","destatis-news")) {
            var feed=providers.feeds().stream().filter(f->f.id().equals(id)).findFirst().orElseThrow();
            String host=id.equals("ons-news")?"www.ons.gov.uk":"www.destatis.de";
            String title=id.equals("ons-news")?"UK economic activity":"Deutsche Verbraucherpreise";
            String rss="<rss><channel><item><title>"+title+"</title><link>https://"+host+"/release</link><pubDate>Thu, 1 Oct 2026 08:00:00 +0200</pubDate></item></channel></rss>";
            var payload=providers.parse(feed,rss,now);
            assertThat(payload.news().getFirst().category()).isEqualTo(id.equals("ons-news")?"UK_MACRO":"GERMAN_MACRO");
            assertThat(payload.events()).isEmpty();assertThat(providers.parse(feed,"<rss><channel/></rss>",now).news()).isEmpty();
            assertThatThrownBy(()->providers.parse(feed,"<html>blocked</html>",now)).isInstanceOf(IllegalArgumentException.class);
        }
    }
    @Test void relevanceRankingPutsDirectAndSectorBeforeNewerMacroAndRetainsPublisher() {
        enable();var topic=InstrumentTopics.resolve("NASDAQ:AAPL");
        var direct=new Story("direct","Company update","Publisher","https://example.org/company",now.minusSeconds(300),null,null,"DIRECT_INSTRUMENT",Set.of("NASDAQ:AAPL"));
        var sector=new Story("sector","Semiconductor update","Publisher","https://example.org/sector",now.minusSeconds(100),null,null,"TECHNOLOGY_SECTOR",Set.of("SECTOR:us:Technology"));
        var macro=new Story("macro","Policy update","Fed","https://www.federalreserve.gov/",now,null,null,"US_MACRO",Set.of());
        assertThat(providers.sectorStory(topic,sector)).isTrue();
        var ranked=new ArrayList<>(List.of(macro,sector,direct));
        ranked.sort(Comparator.comparingInt((Story s)->InstrumentTopics.rank(topic,s)).thenComparing(Story::publishedAt,Comparator.reverseOrder()));
        assertThat(ranked).containsExactly(direct,sector,macro);
        assertThat(providers.sectorStory(InstrumentTopics.resolve("LSE:SHEL"),sector)).isFalse();
    }
    @Test void retriesEachReserveBudgetAndCompanyQuotaFailureDoesNotFetch() {
        var store=mock(NewsFeedStore.class);var source=mock(NewsProviders.class);var service=new NewsContextService(store,source);
        enable();var feed=providers.companyFeed("NASDAQ:AAPL").orElseThrow();
        when(store.claim(any(),any())).thenReturn(UUID.randomUUID());
        when(store.reserveCompany(any(),anyInt())).thenReturn(true,true);
        when(source.fetch(feed)).thenThrow(new NewsProviders.FetchFailure(500,Duration.ofMinutes(30))).thenReturn("fixture");
        when(source.parse(eq(feed),eq("fixture"),any())).thenReturn(Payload.news(List.of()));
        service.refresh(feed);
        verify(store,times(2)).reserveCompany(any(),eq(80));verify(source,times(2)).fetch(feed);
        when(store.reserveCompany(any(),anyInt())).thenReturn(false);service.refresh(feed);
        verify(source,times(2)).fetch(feed);verify(store).failure(eq(feed.id()),any(),any(),any(),eq("QUOTA"));
    }

}
