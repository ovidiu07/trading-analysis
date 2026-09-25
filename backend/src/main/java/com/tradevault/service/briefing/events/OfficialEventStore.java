package com.tradevault.service.briefing.events;

import com.fasterxml.jackson.databind.*;
import com.tradevault.service.briefing.BriefingDocument;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.*;
import java.util.*;

@Repository
public class OfficialEventStore {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    public OfficialEventStore(JdbcTemplate jdbc,ObjectMapper mapper) {
        this.jdbc=jdbc;this.mapper=mapper.copy().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }
    public record Revision(UUID id,int revision,UUID previousId,OfficialEvent event) {}
    private Revision row(java.sql.ResultSet rs,int ignored) throws java.sql.SQLException {
        try {return new Revision(rs.getObject("id",UUID.class),rs.getInt("revision"),rs.getObject("previous_id",UUID.class),mapper.readValue(rs.getString("payload"),OfficialEvent.class));}
        catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException("Invalid stored event",e);}
    }
    public Revision get(UUID id) {
        var rows=jdbc.query("SELECT * FROM official_event_revision WHERE id=?",this::row,id);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Suggestion not found");return rows.getFirst();
    }
    public List<Revision> list(LocalDate date) {
        return jdbc.query("SELECT * FROM (SELECT DISTINCT ON (source_id,event_id) * FROM official_event_revision ORDER BY source_id,event_id,revision DESC) latest WHERE scheduled_date=? AND NOT EXISTS(SELECT 1 FROM official_event_alias a WHERE a.source_id=latest.source_id AND a.event_id=latest.event_id) ORDER BY source_id,event_id LIMIT 500",this::row,date);
    }
    public List<Revision> history(UUID id) {
        var event=get(id).event();
        return jdbc.query("SELECT * FROM official_event_revision WHERE source_id=? AND event_id=? ORDER BY revision DESC LIMIT 100",this::row,event.sourceId().name(),event.eventId());
    }
    public List<Map<String,Object>> runs() {
        return jdbc.queryForList("SELECT source_id,kind,started_at,finished_at,status,detail,staged_count FROM official_event_import_run ORDER BY started_at DESC LIMIT 20");
    }
    @Transactional
    public UUID reserve(OfficialEvent.Source source,String kind,String key,UUID actor,Instant now) {
        lock(source);
        // Durable budgets across app instances; failed attempts also count. No keys or accounts required.
        Integer recent=jdbc.queryForObject("SELECT count(*) FROM official_event_import_run WHERE source_id=? AND request_key=? AND started_at>?",Integer.class,source.name(),key,java.sql.Timestamp.from(now.minusSeconds(3600)));
        Integer daily=jdbc.queryForObject("SELECT count(*) FROM official_event_import_run WHERE source_id=? AND kind='RESULT' AND started_at>?",Integer.class,source.name(),java.sql.Timestamp.from(now.minusSeconds(86400)));
        if(recent>0 || (kind.equals("RESULT") && daily>=20))throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Official import cooldown or daily budget reached; existing suggestions retained");
        UUID run=UUID.randomUUID();jdbc.update("INSERT INTO official_event_import_run(id,source_id,request_key,kind,actor_id,started_at,status) VALUES (?,?,?,?,?,?,'STARTED')",run,source.name(),key,kind,actor,java.sql.Timestamp.from(now));return run;
    }
    private void lock(OfficialEvent.Source source){jdbc.queryForObject("SELECT source_id FROM official_event_source WHERE source_id=? FOR UPDATE",String.class,source.name());}
    @Transactional
    public int stage(UUID run,OfficialEvent.Source source,List<OfficialEvent> events,boolean calendar,UUID expectedRevision) {
        lock(source);int count=0;
        for(var incoming:events) {
            if(calendar && Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM official_event_alias WHERE source_id=? AND target_event_id=?)",Boolean.class,source.name(),incoming.eventId())) && expectedRevision==null)continue;
            var targets=jdbc.queryForList("SELECT target_event_id FROM official_event_alias WHERE source_id=? AND event_id=?",String.class,source.name(),incoming.eventId());
            var next=targets.isEmpty()?incoming:incoming.identity(targets.getFirst());
            if(next.sourceId()!=source)throw new IllegalArgumentException("Source mismatch");
            var prior=jdbc.query("SELECT * FROM official_event_revision WHERE source_id=? AND event_id=? ORDER BY revision DESC LIMIT 1",this::row,source.name(),next.eventId());
            var old=prior.isEmpty()?null:prior.getFirst();
            if(expectedRevision!=null && (old==null || !old.id().equals(expectedRevision)))throw new ResponseStatusException(HttpStatus.CONFLICT,"Suggestion changed during fetch; review latest revision");
            if(calendar && old!=null && OfficialEventRevisions.older(old.event(),next))continue;
            var normalized=calendar?OfficialEventRevisions.calendar(old==null?null:old.event(),next):next;
            String fingerprint=OfficialEventRevisions.fingerprint(mapper,normalized);
            if(old!=null && fingerprint.equals(OfficialEventRevisions.fingerprint(mapper,old.event())))continue;
            LocalDate date=normalized.scheduledAt()==null?normalized.scheduledDate():normalized.scheduledAt().atZone(ZoneId.of("Europe/Bucharest")).toLocalDate();
            try {jdbc.update("INSERT INTO official_event_revision(id,source_id,event_id,revision,previous_id,run_id,observed_at,scheduled_date,payload,fingerprint) VALUES (?,?,?,?,?,?,?,?,?::jsonb,?)",
                UUID.randomUUID(),source.name(),next.eventId(),old==null?1:old.revision()+1,old==null?null:old.id(),run,java.sql.Timestamp.from(normalized.retrievedAt()),date,mapper.writeValueAsString(normalized),fingerprint);}
            catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException(e);}
            count++;
        }
        finish(run,"STAGED",null,count);return count;
    }
    @Transactional
    public void link(UUID oldId,UUID newId,UUID actor) {
        var old=get(oldId);var next=get(newId);var source=old.event().sourceId();lock(source);
        if(source!=next.event().sourceId() || old.event().eventId().equals(next.event().eventId()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose two different events from the same source");
        for(var revision:List.of(old,next)) {
            UUID latest=jdbc.queryForObject("SELECT id FROM official_event_revision WHERE source_id=? AND event_id=? ORDER BY revision DESC LIMIT 1",UUID.class,source.name(),revision.event().eventId());
            if(!latest.equals(revision.id()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Review the latest event revisions");
        }
        Integer aliases=jdbc.queryForObject("SELECT count(*) FROM official_event_alias WHERE source_id=? AND (event_id IN (?,?) OR target_event_id=?)",Integer.class,source.name(),old.event().eventId(),next.event().eventId(),next.event().eventId());
        if(aliases>0)throw new ResponseStatusException(HttpStatus.CONFLICT,"Event identity already linked; chained identity changes require separate review");
        jdbc.update("INSERT INTO official_event_alias(source_id,event_id,target_event_id,reviewed_by) VALUES (?,?,?,?)",source.name(),next.event().eventId(),old.event().eventId(),actor);
        UUID run=jdbc.queryForObject("SELECT run_id FROM official_event_revision WHERE id=?",UUID.class,next.id());
        stage(run,source,List.of(next.event().identity(old.event().eventId())),true,old.id());
    }
    public void finish(UUID run,String status,String detail,int count) {
        jdbc.update("UPDATE official_event_import_run SET status=?,detail=?,staged_count=?,finished_at=now() WHERE id=? AND status='STARTED'",status,detail,count,run);
    }
    public void verify(BriefingDocument document) {
        for(var translation:document.translations().values())for(var event:translation.events())if(event.official()!=null) {
            var original=get(event.official().revisionId());
            if(!original.event().briefing(original.id()).equals(event))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Imported event provenance/value was changed; review the original suggestion");
        }
    }
}
