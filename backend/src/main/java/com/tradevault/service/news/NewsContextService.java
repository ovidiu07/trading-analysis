package com.tradevault.service.news;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.*;
import static com.tradevault.service.news.NewsModels.*;

@Service
@RequiredArgsConstructor
public class NewsContextService {
    private static final Logger log=LoggerFactory.getLogger(NewsContextService.class);
    private final NewsFeedStore store;
    private final NewsProviders providers;
    @Value("${news.enabled:true}") private boolean enabled=true;
    private Clock clock=Clock.systemUTC();

    /** The existing always-on Spring Boot scheduler wakes this durable, cluster-safe queue. */
    @Scheduled(cron="${news.refresh-cron:0 */5 * * * *}", zone="UTC", scheduler="newsScheduler")
    public void refreshDue() {
        if(!enabled)return;
        for(var feed:providers.feeds()) {
            try { refresh(feed); }
            catch(RuntimeException ex) { log.warn("Context job could not complete: feed={} type={}",feed.id(),ex.getClass().getSimpleName()); }
        }
    }
    void refresh(NewsProviders.Feed feed) {
        UUID token=store.claim(feed.id(),clock.instant()); if(token==null)return;
        for(int attempt=0;attempt<2;attempt++) {
            if(!store.reserve(feed.provider(),clock.instant(),feed.budget())) {
                Instant tomorrow=LocalDate.now(clock).plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
                store.failure(feed.id(),token,clock.instant(),Duration.between(clock.instant(),tomorrow),"QUOTA");return;
            }
            try {
                String body=providers.fetch(feed);
                Payload payload=providers.parse(feed,body,clock.instant());
                store.success(feed.id(),token,clock.instant(),feed.ttl(),payload);return;
            } catch(NewsProviders.FetchFailure ex) {
                if(attempt==0 && ex.retryable()) {
                    try { Thread.sleep(1000); } catch(InterruptedException interrupted) { Thread.currentThread().interrupt();break; }
                    continue;
                }
                store.failure(feed.id(),token,clock.instant(),(ex.status==401 || ex.status==403) && feed.ttl().compareTo(ex.backoff)>0 ? feed.ttl() : ex.backoff,"FAILED");
                log.warn("Context fetch failed: feed={} status={}",feed.id(),ex.status);return;
            } catch(RuntimeException ex) {
                store.failure(feed.id(),token,clock.instant(),Duration.ofMinutes(30),"FAILED");
                log.warn("Context validation failed: feed={} type={}",feed.id(),ex.getClass().getSimpleName());return;
            }
        }
        store.failure(feed.id(),token,clock.instant(),Duration.ofMinutes(30),"FAILED");
    }
    public Snapshot snapshot(String instrument,LocalDate date,String timezone,String window,Instant requestedAsOf) {
        if(instrument==null || instrument.isBlank() || instrument.length()>80 || date==null)throw badRequest();
        ZoneId zone;try { zone=ZoneId.of(timezone); }catch(Exception ex){throw badRequest();}
        if(!Set.of("SESSION","LAST_24_HOURS").contains(window))throw badRequest();
        Instant now=clock.instant(); var day=Window.session(date,zone);
        boolean historical=date.isBefore(now.atZone(zone).toLocalDate());
        if(window.equals("LAST_24_HOURS") && !date.equals(now.atZone(zone).toLocalDate()))throw badRequest();
        boolean frozen=historical || requestedAsOf!=null;
        Instant cutoff=requestedAsOf==null ? now : requestedAsOf;
        if(cutoff.isAfter(now))cutoff=now;
        if(historical && !cutoff.isBefore(day.end()))cutoff=day.end().minusNanos(1);
        Window range=window.equals("LAST_24_HOURS") ? new Window(now.minus(Duration.ofHours(24)),now.plusNanos(1)) : day;
        var topic=InstrumentTopics.resolve(instrument);
        List<Story> news=new ArrayList<>(); Map<String,Event> eventVersions=new LinkedHashMap<>(); List<Observation> observations=new ArrayList<>(); List<Coverage> coverage=new ArrayList<>();
        for(var feed:providers.feeds()) {
            if(!topic.regions().contains(feed.region()))continue;
            var state=store.state(feed.id());
            var cached=store.snapshots(feed.id(),range.start(),cutoff,feed.capability()==Capability.NEWS);
            Instant success=cached.isEmpty()?null:cached.getFirst().fetchedAt();
            String status=!enabled?"DISABLED":success==null ? frozen?"UNSUPPORTED_HISTORY":state.status().equals("PENDING")?"PENDING":"FAILED"
                : Duration.between(success,cutoff).compareTo(feed.ttl().multipliedBy(2))>0 || (!frozen && !state.status().equals("OK")) ? "STALE" : "OK";
            for(var snapshot:cached) {
                for(var story:snapshot.payload().news()) if(range.contains(story.publishedAt()) && !story.publishedAt().isAfter(cutoff) && InstrumentTopics.newsMatches(topic,story))news.add(story);
                for(var event:snapshot.payload().events()) {
                    boolean inDay=event.scheduledAt()!=null ? day.contains(event.scheduledAt())
                        : event.publishedAt()!=null ? day.contains(event.publishedAt()) : date.equals(event.scheduledDate());
                    if(inDay && (event.publishedAt()==null || !event.publishedAt().isAfter(cutoff)) && InstrumentTopics.trackedEvent(topic,event))eventVersions.putIfAbsent(event.id(),asOfEvent(event,cutoff));
                }
                // Statistical API values are explicitly retrospective and never inserted into past sessions.
                if(!historical && requestedAsOf==null && date.equals(now.atZone(zone).toLocalDate()))observations.addAll(snapshot.payload().observations());
            }
            if(feed.capability()==Capability.CALENDAR && !cached.isEmpty()) {
                var all=cached.getFirst().payload().events();
                LocalDate min=all.stream().map(Event::scheduledDate).min(LocalDate::compareTo).orElse(null);
                LocalDate max=all.stream().map(Event::scheduledDate).max(LocalDate::compareTo).orElse(null);
                if(min==null || date.isBefore(min) || date.isAfter(max))status="OUT_OF_RANGE";
            }
            coverage.add(new Coverage(feed.provider(),feed.id(),feed.capability(),status,success,frozen?null:state.attempt(),frozen?null:state.next()));
        }
        if(topic.stockSymbol()!=null || topic.key().equals("US_TECH") || topic.key().equals("GERMANY"))
            coverage.add(new Coverage("Company news",null,Capability.NEWS,"LIMITED",null,null,null));
        if(topic.regions().contains("UK"))coverage.add(new Coverage("UK releases",null,Capability.CALENDAR,"LIMITED",null,null,null));
        if(coverage.isEmpty())coverage.add(new Coverage("Instrument coverage",null,Capability.NEWS,"UNSUPPORTED",null,null,null));
        List<Event> events=new ArrayList<>(eventVersions.values());
        events.sort(Comparator.comparing(Event::scheduledAt,Comparator.nullsLast(Comparator.naturalOrder())));
        Instant last=coverage.stream().map(Coverage::lastSuccessAt).filter(Objects::nonNull).max(Instant::compareTo).orElse(null);
        return new Snapshot(instrument,topic.key(),date,timezone,cutoff,window,NewsParsers.deduplicate(news),List.copyOf(events),List.copyOf(observations),List.copyOf(coverage),last,historical);
    }
    static Event asOfEvent(Event e,Instant cutoff) {
        String status=e.status();
        boolean released=e.publishedAt()!=null && !e.publishedAt().isAfter(cutoff);
        if(!status.equals("CANCELLED")) status=released?"RELEASED":e.scheduledAt()!=null && !e.scheduledAt().isAfter(cutoff)?"AWAITING_RESULT":"UPCOMING";
        return new Event(e.id(),e.name(),e.region(),e.scheduledAt(),e.scheduledDate(),e.sourceTimezone(),e.source(),e.url(),e.category(),status,e.referencePeriod(),released?e.actual():null,e.forecast(),e.previous(),released?e.revisedPrevious():null,released?e.publishedAt():null,e.sourceUpdatedAt());
    }
    public void requestRefresh(String instrument) {
        if(!enabled)return;
        var topic=InstrumentTopics.resolve(instrument==null?"":instrument);
        for(var feed:providers.feeds())if(topic.regions().contains(feed.region()))store.requestRefresh(feed.id(),clock.instant());
    }
    private ResponseStatusException badRequest(){return new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid news context");}
}
