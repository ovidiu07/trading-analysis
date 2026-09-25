package com.tradevault.service.briefing.events;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.briefing.BriefingDocument;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.*;

@Service @RequiredArgsConstructor @PreAuthorize("hasRole('ADMIN')")
public class OfficialEventService {
    private final OfficialEventStore store;
    private final OfficialEventHttpClient http;
    private final ObjectMapper mapper;
    private final CurrentUserService users;
    private Clock clock=Clock.systemUTC();
    public record ResultRequest(OfficialResultParser.Measure measure,YearMonth period,Instant publishedAt,
                                String publicationSourceUrl,boolean reviewedPublication) {}
    public Object inbox(LocalDate date){return Map.of("suggestions",store.list(date),"runs",store.runs(),"measures",
        Arrays.stream(OfficialResultParser.Measure.values()).map(m->Map.of("id",m.name(),"sourceId",m.source.name(),"label",m.label,"unit",m.unit)).toList());}
    public Object history(UUID id){return store.history(id);}
    public void link(UUID previousId,UUID revisedId){store.link(previousId,revisedId,users.getCurrentUser().getId());}
    public BriefingDocument.Event review(UUID id){return store.get(id).event().briefing(id);}
    public Object refresh(OfficialEvent.Source source) {
        UUID run=store.reserve(source,"CALENDAR","calendar",users.getCurrentUser().getId(),clock.instant());
        try {
            String text=http.get(source.calendarUrl);
            var events=new OfficialCalendarParser().parse(source,text,clock.instant());
            if(events.isEmpty())throw new IllegalArgumentException("Official calendar is empty; existing suggestions retained");
            return Map.of("staged",store.stage(run,source,events,true,null));
        } catch(RuntimeException e){store.finish(run,"FAILED",safe(e),0);throw failure(e);}
    }
    public Object result(UUID revision,ResultRequest request) {
        var event=store.get(revision).event();Instant now=clock.instant();
        validateResult(event,request,now);
        String url=request.measure().url(request.period());
        UUID run=store.reserve(event.sourceId(),"RESULT",request.measure().series+"|"+request.period(),users.getCurrentUser().getId(),now);
        try {
            var value=new OfficialResultParser().parse(request.measure(),request.period(),mapper.readTree(http.get(url)));
            var next=event.result(value.actual(),request.measure().unit,request.publishedAt(),request.publicationSourceUrl(),url,
                request.measure().series,request.period().toString(),request.measure().label,value.notes(),clock.instant());
            return Map.of("staged",store.stage(run,event.sourceId(),List.of(next),false,revision));
        } catch(Exception e){store.finish(run,"FAILED",safe(e),0);throw failure(e);}
    }
    static void validateResult(OfficialEvent event,ResultRequest request,Instant now) {
        if(request==null || request.measure()==null || request.measure().source!=event.sourceId() || request.period()==null
            || request.publishedAt()==null || !request.reviewedPublication() || !event.sourceId().owns(request.publicationSourceUrl()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Review an exact official measure, period, publication time and official publication URL");
        if(event.status()==BriefingDocument.EventStatus.CANCELLED || request.publishedAt().isAfter(now)
            || (event.scheduledAt()!=null && request.publishedAt().isBefore(event.scheduledAt()))
            || request.publishedAt().atZone(ZoneId.of(event.sourceTimezone())).toLocalDate().isBefore(event.scheduledDate())
            || request.period().atDay(1).isAfter(request.publishedAt().atZone(ZoneOffset.UTC).toLocalDate()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Result is not eligible for release; no data requested");
    }
    private static String safe(Exception e) {
        if(e instanceof IllegalArgumentException || e instanceof IllegalStateException || e instanceof ResponseStatusException)
            return Optional.ofNullable(e.getMessage()).orElse("Official import failed").substring(0,Math.min(500,Optional.ofNullable(e.getMessage()).orElse("Official import failed").length()));
        return "Official response could not be parsed; existing suggestions retained";
    }
    private static ResponseStatusException failure(Exception e){return e instanceof ResponseStatusException r?r:new ResponseStatusException(HttpStatus.BAD_GATEWAY,safe(e));}
}
