package com.tradevault.service.news;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.test.util.ReflectionTestUtils;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static com.tradevault.service.news.NewsModels.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class NewsContextTest {
    ObjectMapper mapper=new ObjectMapper().findAndRegisterModules();
    NewsProviders providers=new NewsProviders(mapper);
    Instant now=Instant.parse("2026-10-01T14:00:00Z");
    NewsProviders.Feed feed(String id){return providers.feeds().stream().filter(f->f.id().equals(id)).findFirst().orElseThrow();}
    String fixture(String name) throws Exception {return new String(getClass().getResourceAsStream("/news/"+name).readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);}
    @Test void aliasTopicsKeepExactInstrumentsAndRejectAmbiguity() {
        for(String symbol:List.of("GER40","DE40","DAX","OANDA:DE30EUR"))assertThat(InstrumentTopics.resolve(symbol).key()).isEqualTo("GERMANY");
        for(String symbol:List.of("NQ","MNQ","NAS100","US100","Nasdaq-100","CME_MINI:NQ1!"))assertThat(InstrumentTopics.resolve(symbol).key()).isEqualTo("US_TECH");
        assertThat(InstrumentTopics.resolve("NASDAQ:AAPL").stockSymbol()).isEqualTo("AAPL");
        assertThat(InstrumentTopics.resolve("NYSE:NQ").stockSymbol()).isEqualTo("NQ");
        assertThat(InstrumentTopics.resolve("NASDAQ").key()).isEqualTo("UNSUPPORTED");
        var story=new Story("1","NQ is a company","X","https://example.org/a",now,null,null,"DIRECT_INSTRUMENT",Set.of("NQ"));
        assertThat(InstrumentTopics.newsMatches(InstrumentTopics.resolve("NQ"),story)).isFalse();
        assertThat(InstrumentTopics.resolve("GBPUSD").regions()).containsExactlyInAnyOrder("UK","US");
    }
    @Test void localMidnightUsesDstAndNotTwentyFourHourArithmetic() {
        var spring=Window.session(LocalDate.parse("2026-03-29"),ZoneId.of("Europe/Bucharest"));
        var autumn=Window.session(LocalDate.parse("2026-10-25"),ZoneId.of("Europe/Bucharest"));
        assertThat(Duration.between(spring.start(),spring.end())).isEqualTo(Duration.ofHours(23));
        assertThat(Duration.between(autumn.start(),autumn.end())).isEqualTo(Duration.ofHours(25));
        assertThat(spring.contains(spring.start())).isTrue();assertThat(spring.contains(spring.end())).isFalse();
    }
    @Test void dedupTracksVersionsAndCanonicalLinksWithoutCollapsingUpdates() {
        var a=new Story("1","Policy decision","Fed","https://example.org/news?utm_source=a",now,null,null,"US_MACRO",Set.of());
        var b=new Story("2",a.headline(),a.publisher(),"https://example.org/news",now,null,null,a.category(),Set.of());
        var updated=new Story("1","Policy decision updated",a.publisher(),b.url(),now.plusSeconds(60),null,null,a.category(),Set.of());
        assertThat(NewsParsers.deduplicate(List.of(a,b,a,updated))).hasSize(2);
    }
    @Test void nullAndZeroAndComparableBasisRemainDistinct() {
        assertThat(NewsParsers.number(mapper.createObjectNode().putNull("0"),0)).isNull();
        assertThat(NewsParsers.number(mapper.createObjectNode().put("0",0),0)).isEqualByComparingTo(BigDecimal.ZERO);
        var a=new Figure(BigDecimal.ZERO,"CPI","2026-08","%","NSA");
        assertThat(a.comparable(new Figure(BigDecimal.ONE,"CPI","2026-08","%","NSA"))).isTrue();
        assertThat(a.comparable(new Figure(BigDecimal.ONE,"CPI","2026-07","%","NSA"))).isFalse();
        assertThat(a.comparable(new Figure(BigDecimal.ONE,"CPI","2026-08","index","SA"))).isFalse();
    }
    @Test void verifiedFixturesParseAndNeverInferStatisticsReleaseTime() throws Exception {
        assertThat(providers.parse(feed("ecb-news"),fixture("ecb.xml"),now).news()).isNotEmpty();
        assertThat(providers.parse(feed("fed-news"),fixture("fed.xml"),now).news()).allMatch(s->s.category().equals("US_MACRO"));
        var releases=providers.parse(feed("eurostat-news"),fixture("eurostat.xml"),now);
        assertThat(releases.news()).isNotEmpty();assertThat(releases.events()).isNotEmpty();
        var inflation=releases.events().getFirst();
        assertThat(inflation.actual().series()).isEqualTo("EUROSTAT:HICP:EA:ANNUAL_RATE");
        assertThat(inflation.actual().adjustment()).isEqualTo("NSA");assertThat(inflation.forecast()).isNull();
        assertThat(inflation.publishedAt()).isNotNull();assertThat(inflation.scheduledAt()).isNull();
        for(String id:List.of("bls-unemployment","bls-cpi","eurostat-unemployment")) {
            var result=providers.parse(feed(id),fixture(id+".json"),now);
            assertThat(result.events()).isEmpty();assertThat(result.observations()).hasSize(1);
            assertThat(result.observations().getFirst().actual().value()).isNotNull();
        }
        assertThat(providers.parse(feed("bea-calendar"),fixture("bea.ics"),now).events()).isNotEmpty();
        assertThat(providers.parse(feed("eurostat-calendar"),fixture("eurostat.ics"),now).events()).isNotEmpty();
    }
    @Test void noGuessedNumbersWhenReleaseSummaryChanges() throws Exception {
        String changed=fixture("eurostat.xml").replace("The euro area annual inflation rate was", "Analysts expect euro area inflation at");
        assertThat(providers.parse(feed("eurostat-news"),changed,now).events()).isEmpty();
    }
    @Test void emptyRssIsDifferentFromMalformedAndXxe() {
        assertThat(providers.parse(feed("ecb-news"),"<rss><channel/></rss>",now).news()).isEmpty();
        assertThatThrownBy(()->providers.parse(feed("ecb-news"),"<html>Blocked</html>",now)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->providers.parse(feed("ecb-news"),"<!DOCTYPE rss [<!ENTITY x SYSTEM 'file:///etc/passwd'>]><rss><channel>&x;</channel></rss>",now)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void invalidEurostatDimensionsCannotBecomeZero() throws Exception {
        String invalid=fixture("eurostat-unemployment.json").replace("EU27_2020","EA20");
        assertThatThrownBy(()->providers.parse(feed("eurostat-unemployment"),invalid,now)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void releasedValuesAreWithheldBeforePublicationAndPassedSchedulesAwaitConfirmation() {
        var e=new Event("1","CPI","US",now.minusSeconds(60),LocalDate.of(2026,10,1),"America/New_York","BLS","https://www.bls.gov/","US_MACRO","RELEASED","2026-09",new Figure(BigDecimal.ZERO,"s","2026-09","%","SA"),null,null,null,now.plusSeconds(60),null);
        assertThat(NewsContextService.asOfEvent(e,now).status()).isEqualTo("AWAITING_RESULT");
        assertThat(NewsContextService.asOfEvent(e,now).actual()).isNull();
        assertThat(NewsContextService.asOfEvent(e,now.plusSeconds(60)).actual().value()).isZero();
    }
    @Test void historicalCutoffPreventsLaterNewsAndObservationsWithoutAnyPlanWrites() {
        var store=mock(NewsFeedStore.class);var source=mock(NewsProviders.class);when(source.feeds()).thenReturn(List.of(feed("fed-news")));
        when(store.state(any())).thenReturn(new NewsFeedStore.State(now,now,now.plusSeconds(60),"OK"));
        when(store.snapshots(any(),any(),any(),anyBoolean())).thenReturn(List.of());
        var service=new NewsContextService(store,source);ReflectionTestUtils.setField(service,"clock",Clock.fixed(now,ZoneOffset.UTC));
        var result=service.snapshot("NQ",LocalDate.parse("2026-09-30"),"Europe/Bucharest","SESSION",null);
        assertThat(result.asOf()).isEqualTo(Instant.parse("2026-09-30T20:59:59.999999999Z"));
        assertThat(result.news()).isEmpty();assertThat(result.observations()).isEmpty();
        assertThat(result.coverage().getFirst().state()).isEqualTo("UNSUPPORTED_HISTORY");
        verify(store).snapshots(eq("fed-news"),any(),eq(result.asOf()),eq(true));
        verify(store,never()).requestRefresh(any(),any());
    }
    @Test void cachedFailureIsStaleAndSuccessfulEmptyRemainsEmpty() {
        var store=mock(NewsFeedStore.class);var source=mock(NewsProviders.class);when(source.feeds()).thenReturn(List.of(feed("fed-news")));
        when(store.state(any())).thenReturn(new NewsFeedStore.State(now,now.minusSeconds(20),now.plusSeconds(60),"FAILED"));
        when(store.snapshots(any(),any(),any(),anyBoolean())).thenReturn(List.of(new NewsFeedStore.Cached(now.minusSeconds(20),Payload.news(List.of()))));
        var service=new NewsContextService(store,source);ReflectionTestUtils.setField(service,"clock",Clock.fixed(now,ZoneOffset.UTC));
        assertThat(service.snapshot("NQ",LocalDate.parse("2026-10-01"),"Europe/Bucharest","SESSION",null).coverage().getFirst().state()).isEqualTo("STALE");
        when(store.state(any())).thenReturn(new NewsFeedStore.State(now,now,now.plusSeconds(60),"OK"));
        assertThat(service.snapshot("NQ",LocalDate.parse("2026-10-01"),"Europe/Bucharest","SESSION",null).coverage().getFirst().state()).isEqualTo("OK");
    }
    @Test void quotaAndLeasePreventRequestsAnd429DoesNotRetry() {
        var store=mock(NewsFeedStore.class);var source=mock(NewsProviders.class);var service=new NewsContextService(store,source);var feed=feed("fed-news");
        service.refresh(feed);verify(source,never()).fetch(any());
        when(store.claim(any(),any())).thenReturn(UUID.randomUUID());when(store.reserve(any(),any(),anyInt())).thenReturn(false);
        service.refresh(feed);verify(source,never()).fetch(any());
        when(store.reserve(any(),any(),anyInt())).thenReturn(true);when(source.fetch(any())).thenThrow(new NewsProviders.FetchFailure(429,Duration.ofHours(1)));
        service.refresh(feed);verify(source,times(1)).fetch(feed);verify(store).failure(eq(feed.id()),any(),any(),eq(Duration.ofHours(1)),eq("FAILED"));
    }
    @Test void asOfWithoutSnapshotIsUnsupportedHistoryAndDoesNotExposeCurrentAttempts() {
        var store=mock(NewsFeedStore.class);var source=mock(NewsProviders.class);
        when(source.feeds()).thenReturn(List.of(feed("fed-news")));
        when(store.state(any())).thenReturn(new NewsFeedStore.State(now,now,now.plusSeconds(60),"OK"));
        when(store.snapshots(any(),any(),any(),anyBoolean())).thenReturn(List.of());
        var service=new NewsContextService(store,source);ReflectionTestUtils.setField(service,"clock",Clock.fixed(now,ZoneOffset.UTC));
        var result=service.snapshot("NQ",LocalDate.parse("2026-10-01"),"Europe/Bucharest","SESSION",now.minusSeconds(3600));
        assertThat(result.coverage().getFirst().state()).isEqualTo("UNSUPPORTED_HISTORY");
        assertThat(result.coverage().getFirst().lastAttemptAt()).isNull();
        assertThat(result.coverage().getFirst().nextRefreshAt()).isNull();
    }
    @Test void retryAfterHonorsSecondsAndHttpDateWithBounds() {
        assertThat(NewsProviders.retryDelay("3600",now)).isEqualTo(Duration.ofHours(1));
        assertThat(NewsProviders.retryDelay("Thu, 1 Oct 2026 16:00:00 GMT",now)).isEqualTo(Duration.ofHours(2));
        assertThat(NewsProviders.retryDelay("10",now)).isEqualTo(Duration.ofMinutes(30));
        assertThat(NewsProviders.retryDelay("99999999",now)).isEqualTo(Duration.ofDays(1));
        assertThat(NewsProviders.retryDelay("invalid",now)).isEqualTo(Duration.ofMinutes(30));
    }
    @Test void marketauxRequiresBothCommercialAuthorizationAndServerToken() {
        assertThat(providers.feeds()).noneMatch(f->f.provider().equals("Marketaux"));
        ReflectionTestUtils.setField(providers,"marketauxToken","synthetic-test-token");
        assertThat(providers.feeds()).noneMatch(f->f.provider().equals("Marketaux"));
        ReflectionTestUtils.setField(providers,"marketauxAuthorized",true);
        assertThat(providers.feeds().stream().filter(f->f.provider().equals("Marketaux"))).hasSize(3);
        assertThat(providers.feeds()).allMatch(f->!f.url().contains("synthetic-test-token"));
    }
    @Test void releaseDayFollowsSessionTimezoneRatherThanPublishersLocalDate() {
        var store=mock(NewsFeedStore.class);var source=mock(NewsProviders.class);
        when(source.feeds()).thenReturn(List.of(feed("eurostat-news")));
        when(store.state(any())).thenReturn(new NewsFeedStore.State(now,now,now.plusSeconds(60),"OK"));
        var release=new Event("release","Euro-area HICP annual inflation","EU",null,LocalDate.parse("2026-09-30"),"Europe/Luxembourg","Eurostat","https://ec.europa.eu/eurostat/","EURO_AREA_MACRO","RELEASED","2026-08",null,null,null,null,Instant.parse("2026-09-30T21:30:00Z"),null);
        when(store.snapshots(any(),any(),any(),anyBoolean())).thenReturn(List.of(new NewsFeedStore.Cached(now,Payload.events(List.of(release)))));
        var service=new NewsContextService(store,source);ReflectionTestUtils.setField(service,"clock",Clock.fixed(now,ZoneOffset.UTC));
        assertThat(service.snapshot("GER40",LocalDate.parse("2026-10-01"),"Europe/Bucharest","SESSION",null).events()).hasSize(1);
    }
}
