package com.tradevault.service.news;

import java.time.*;
import java.time.format.*;
import java.util.*;
import static com.tradevault.service.news.NewsModels.*;

/** BEA's documented one-off UTC iCalendar format. Fail closed on recurrence or timezone changes. */
final class BeaCalendarParser {
    private BeaCalendarParser() {}
    static Payload parse(NewsProviders.Feed feed,String text) {
        if(!text.strip().startsWith("BEGIN:VCALENDAR") || !text.strip().endsWith("END:VCALENDAR") || text.length()>2_000_000)
            throw new IllegalArgumentException("Invalid BEA calendar");
        text=text.replace("\r\n","\n").replaceAll("\n[ \t]","");
        Map<String,String> fields=null; Map<String,Event> events=new LinkedHashMap<>();
        for(String line:text.split("\n")) {
            if(line.equals("BEGIN:VEVENT")){if(fields!=null)throw new IllegalArgumentException("Nested event");fields=new HashMap<>();continue;}
            if(line.equals("END:VEVENT")) {
                if(fields==null)throw new IllegalArgumentException("Unmatched event");
                String uid=NewsParsers.required(fields.get("UID")),name=NewsParsers.required(fields.get("SUMMARY"));
                Instant at=LocalDateTime.parse(NewsParsers.required(fields.get("DTSTART")),DateTimeFormatter.ofPattern("uuuuMMdd'T'HHmmss'Z'").withResolverStyle(ResolverStyle.STRICT)).toInstant(ZoneOffset.UTC);
                String status=fields.getOrDefault("STATUS","CONFIRMED");
                if(!Set.of("CONFIRMED","CANCELLED","TENTATIVE").contains(status))throw new IllegalArgumentException("Unknown event status");
                String url=fields.containsKey("URL")?NewsParsers.officialUrl(fields.get("URL"),feed):"https://www.bea.gov/news/schedule";
                var event=new Event("bea-calendar:"+uid,name,"US",at,at.atZone(ZoneId.of("America/New_York")).toLocalDate(),"America/New_York","BEA",url,"US_MACRO",status.equals("CANCELLED")?"CANCELLED":"UPCOMING",null,null,null,null,null,null,null);
                var old=events.putIfAbsent(uid,event);if(old!=null&&!old.equals(event))throw new IllegalArgumentException("Conflicting event UID");
                fields=null;continue;
            }
            if(fields==null)continue;
            int colon=line.indexOf(':');if(colon<1)throw new IllegalArgumentException("Invalid calendar property");
            String key=line.substring(0,colon).split(";",2)[0];
            if(Set.of("RRULE","RDATE","EXDATE","RECURRENCE-ID","BEGIN").contains(key))throw new IllegalArgumentException("Unsupported recurrence");
            if(Set.of("UID","SUMMARY","DTSTART","STATUS","URL").contains(key)) {
                String value=line.substring(colon+1).replace("\\,",",").replace("\\;",";").replace("\\n","\n");
                if(fields.putIfAbsent(key,value)!=null)throw new IllegalArgumentException("Duplicate property");
            }
        }
        if(fields!=null || events.size()>5000)throw new IllegalArgumentException("Incomplete calendar");
        return Payload.events(List.copyOf(events.values()));
    }
}
