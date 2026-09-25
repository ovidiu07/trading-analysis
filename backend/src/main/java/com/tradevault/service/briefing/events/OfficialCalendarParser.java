package com.tradevault.service.briefing.events;

import com.tradevault.service.briefing.BriefingDocument.EventStatus;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.ResolverStyle;
import java.util.*;

/** Deliberately bounded RFC5545 subset: one-off releases, no recurrence expansion or remote timezone loading. */
public class OfficialCalendarParser {
    private record Property(String parameters,String value) {}
    public List<OfficialEvent> parse(OfficialEvent.Source source, String text, Instant retrievedAt) {
        if(text==null || text.length()>2_000_000) throw new IllegalArgumentException("Calendar exceeds size limit");
        // Eurostat's public subscription currently emits literal escaped CRLF separators.
        if(source==OfficialEvent.Source.EUROSTAT && text.startsWith("BEGIN:VCALENDAR\\r\\n")) text=text.replace("\\r\\n","\n");
        if(!text.strip().startsWith("BEGIN:VCALENDAR") || !text.strip().endsWith("END:VCALENDAR")) throw new IllegalArgumentException("Invalid calendar envelope");
        String unfolded=text.replace("\r\n","\n").replaceAll("\n[ \t]","");
        Map<String,OfficialEvent> unique=new LinkedHashMap<>();
        Map<String,Property> properties=null;
        for(String line:unfolded.split("\n")) {
            if(line.equals("BEGIN:VEVENT")) { if(properties!=null)throw new IllegalArgumentException("Nested event"); properties=new HashMap<>(); continue; }
            if(line.equals("END:VEVENT")) {
                if(properties==null)throw new IllegalArgumentException("Unmatched event");
                var event=event(source,properties,retrievedAt);
                var old=unique.putIfAbsent(event.eventId(),event);
                if(old!=null) {
                    var mapper=new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules();
                    if(!OfficialEventRevisions.fingerprint(mapper,old).equals(OfficialEventRevisions.fingerprint(mapper,event)))throw new IllegalArgumentException("Conflicting duplicate event UID");
                }
                if(unique.size()>5000)throw new IllegalArgumentException("Too many events");
                properties=null; continue;
            }
            if(properties==null)continue;
            int colon=line.indexOf(':'); if(colon<1)throw new IllegalArgumentException("Invalid calendar property");
            String left=line.substring(0,colon); String name=left.split(";",2)[0].toUpperCase(Locale.ROOT);
            if(Set.of("RRULE","RDATE","RECURRENCE-ID","EXDATE","BEGIN").contains(name))throw new IllegalArgumentException("Recurring or nested release unsupported");
            if(Set.of("UID","DTSTART","SUMMARY","URL","STATUS","SEQUENCE","LAST-MODIFIED").contains(name)
                && properties.putIfAbsent(name,new Property(left,line.substring(colon+1)))!=null)throw new IllegalArgumentException("Duplicate calendar property");
        }
        if(properties!=null)throw new IllegalArgumentException("Unterminated event");
        return List.copyOf(unique.values());
    }
    private OfficialEvent event(OfficialEvent.Source source,Map<String,Property> p,Instant retrieved) {
        String id=required(p,"UID",500), name=required(p,"SUMMARY",300);
        var start=p.get("DTSTART"); if(start==null)throw new IllegalArgumentException("Release date missing");
        String zone=source.timezone;
        for(String part:start.parameters().split(";"))if(part.startsWith("TZID="))zone=part.substring(5).replace("\"","");
        ZoneId zoneId=ZoneId.of(zone);
        Instant instant=null; LocalDate date;
        if(Arrays.asList(start.parameters().split(";")).contains("VALUE=DATE") || start.value().matches("\\d{8}")) date=LocalDate.parse(start.value(),DateTimeFormatter.BASIC_ISO_DATE);
        else {
            if(start.value().endsWith("Z"))instant=LocalDateTime.parse(start.value().substring(0,start.value().length()-1),DateTimeFormatter.ofPattern("uuuuMMdd'T'HHmmss").withResolverStyle(ResolverStyle.STRICT)).toInstant(ZoneOffset.UTC);
            else {
                var local=LocalDateTime.parse(start.value(),DateTimeFormatter.ofPattern("uuuuMMdd'T'HHmmss").withResolverStyle(ResolverStyle.STRICT));
                var offsets=zoneId.getRules().getValidOffsets(local);
                if(offsets.size()!=1)throw new IllegalArgumentException("Ambiguous or nonexistent release time");
                instant=local.toInstant(offsets.getFirst());
            }
            date=instant.atZone(zoneId).toLocalDate();
        }
        String url=p.containsKey("URL")?unescape(p.get("URL").value()):source.calendarUrl;
        if(!source.owns(url))throw new IllegalArgumentException("Non-official event URL");
        String status=p.containsKey("STATUS")?p.get("STATUS").value():"CONFIRMED";
        if(!Set.of("CONFIRMED","TENTATIVE","CANCELLED").contains(status))throw new IllegalArgumentException("Unknown calendar status");
        Integer sequence=p.containsKey("SEQUENCE")?Integer.valueOf(p.get("SEQUENCE").value()):null;
        if(sequence!=null && sequence<0)throw new IllegalArgumentException("Invalid source sequence");
        Instant modified=p.containsKey("LAST-MODIFIED")?utc(p.get("LAST-MODIFIED").value()):null;
        String canonical=source==OfficialEvent.Source.EUROSTAT?UUID.nameUUIDFromBytes((name+"|"+date+"|"+instant+"|"+zone).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString():id;
        return new OfficialEvent(source,canonical,id,source==OfficialEvent.Source.EUROSTAT?"SCHEDULE_SIGNATURE":"SOURCE_UID",source.region,name,instant,date,zone,url,retrieved,
            status.equals("CANCELLED")?EventStatus.CANCELLED:EventStatus.UPCOMING,sequence,modified,null,null,
            null,null,null,null,null,null,null,null,status.equals("TENTATIVE")?"Tentative official schedule":null,null);
    }
    private static Instant utc(String value) { return LocalDateTime.parse(value,DateTimeFormatter.ofPattern("uuuuMMdd'T'HHmmss'Z'").withResolverStyle(ResolverStyle.STRICT)).toInstant(ZoneOffset.UTC); }
    private static String required(Map<String,Property> p,String key,int max) {
        var prop=p.get(key);String value=prop==null?"":unescape(prop.value());
        if(value.isBlank() || value.length()>max)throw new IllegalArgumentException("Invalid "+key);return value;
    }
    private static String unescape(String s) {return s.replace("\\n","\n").replace("\\N","\n").replace("\\,",",").replace("\\;",";").replace("\\\\","\\");}
}
