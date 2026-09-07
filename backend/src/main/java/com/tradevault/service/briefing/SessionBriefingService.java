package com.tradevault.service.briefing;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.tradevault.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.*;
import static com.tradevault.service.briefing.BriefingDocument.Slot;

@Service @RequiredArgsConstructor
public class SessionBriefingService {
 private final JdbcTemplate jdbc;
 private final ObjectMapper mapper;
 private final CurrentUserService users;
 private final BriefingValidator validator;
 public record Edit(int version, JsonNode document) {}
 public record Publish(int version, UUID requestId) {}
 private JsonNode json(String value) { try{return mapper.readTree(value);}catch(Exception ex){throw new IllegalStateException(ex);} }
 private UUID actor(){return users.getCurrentUser().getId();}
 private void conflict(String message){throw new ResponseStatusException(HttpStatus.CONFLICT,message);}
 @PreAuthorize("hasRole('ADMIN')")
 public List<Map<String,Object>> day(LocalDate date) {
  actor();
  return jdbc.queryForList("SELECT b.id,b.slot,b.draft_version AS version,b.published_draft_version,b.withdrawn,b.updated_at,b.updated_by, r.revision,r.reference_time,r.published_at, (SELECT min(published_at) FROM session_briefing_revision WHERE briefing_id=b.id) AS first_published_at FROM session_briefing b LEFT JOIN LATERAL (SELECT * FROM session_briefing_revision WHERE briefing_id=b.id ORDER BY revision DESC LIMIT 1) r ON true WHERE b.editorial_date=? ORDER BY b.slot",date);
 }
 @PreAuthorize("hasRole('ADMIN')")
 public JsonNode draft(UUID id) {
  actor(); var rows=jdbc.queryForList("SELECT jsonb_build_object('id',id,'version',draft_version,'document',draft)::text FROM session_briefing WHERE id=?",String.class,id);
  if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Briefing not found"); return json(rows.get(0));
 }
 @PreAuthorize("hasRole('ADMIN')") @Transactional
 public JsonNode save(UUID id,Edit edit) {
  UUID actor=actor(); var doc=validator.parse(edit.document(),false,Instant.now());
  JsonNode normalized=mapper.copy().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS).valueToTree(doc);
  if(id==null) {
   // Serializes creation across admins; the unique date/slot constraint remains authoritative.
   jdbc.queryForObject("SELECT id FROM content_type WHERE key='SESSION_BRIEFING' FOR UPDATE",UUID.class);
   if(Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM session_briefing WHERE editorial_date=? AND slot=?)",Boolean.class,doc.editorialDate(),doc.slot().name()))) conflict("Slot already exists; open its draft");
   if(edit.version()!=0) conflict("New draft requires version 0");
   id=UUID.randomUUID();
   jdbc.update("INSERT INTO content_post(id,content_type_id,status,created_by) SELECT ?,id,'DRAFT',? FROM content_type WHERE key='SESSION_BRIEFING'",id,actor);
   jdbc.update("INSERT INTO session_briefing(id,editorial_date,slot,draft,updated_by) VALUES (?,?,?,?::jsonb,?)",id,doc.editorialDate(),doc.slot().name(),normalized.toString(),actor);
   audit(id,null,"CREATE",1);
  } else {
   var current=draft(id);
   if(!current.path("document").path("editorialDate").asText().equals(doc.editorialDate().toString()) || !current.path("document").path("slot").asText().equals(doc.slot().name())) conflict("Date/session identity cannot change; create a new slot");
   int changed=jdbc.update("UPDATE session_briefing SET draft=?::jsonb,draft_version=draft_version+1,updated_at=now(),updated_by=? WHERE id=? AND draft_version=?",normalized.toString(),actor,id,edit.version());
   if(changed!=1) conflict("Draft changed in another tab. Your edits are retained; reload and merge.");
   audit(id,null,"SAVE_DRAFT",edit.version()+1);
  }
  // Reuse CMS translations, but only the typed endpoint publishes immutable content.
  jdbc.update("DELETE FROM content_post_translation WHERE content_post_id=?",id);
  if(doc.translations()!=null) for(var entry:doc.translations().entrySet()) {
   var t=entry.getValue(); if(t==null)continue;
   jdbc.update("INSERT INTO content_post_translation(content_post_id,locale,title,summary,body_markdown) VALUES (?,?,?,?,?)",id,entry.getKey(),t.title()==null?"":t.title(),t.summary()==null?"":String.join("\n",t.summary()),mapper.valueToTree(t).toString());
  }
  return draft(id);
 }
 @PreAuthorize("hasRole('ADMIN')")
 public JsonNode preview(JsonNode raw) {validator.parse(raw,true,Instant.now());return raw;}
 @PreAuthorize("hasRole('ADMIN')") @Transactional
 public JsonNode publish(UUID id,Publish request) {
  actor(); if(request.requestId()==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"requestId required");
  jdbc.queryForObject("SELECT id FROM session_briefing WHERE id=? FOR UPDATE",UUID.class,id);
  var retry=jdbc.queryForList("SELECT id FROM session_briefing_revision WHERE request_id=? AND briefing_id=? AND draft_version=?",UUID.class,request.requestId(),id,request.version());
  if(!retry.isEmpty())return revision(retry.get(0));
  if(Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM session_briefing_revision WHERE request_id=?)",Boolean.class,request.requestId()))) conflict("Publication retry identity mismatch");
  var draft=draft(id); if(draft.path("version").asInt()!=request.version())conflict("Draft changed; preview the current version before publishing");
  var same=jdbc.queryForList("SELECT id FROM session_briefing_revision WHERE briefing_id=? AND draft_version=?",UUID.class,id,request.version());
  if(!same.isEmpty())return revision(same.get(0));
  var doc=validator.parse(draft.path("document"),true,Instant.now());
  // An unchanged ID is a reference to the same fact, never an implicit correction.
  for(var entry:doc.translations().entrySet()) {
   var localFacts=entry.getValue().facts();
   for(var f:localFacts) {
    var priorFacts=jdbc.queryForList("SELECT fact::text FROM session_briefing_revision r JOIN session_briefing b ON b.id=r.briefing_id CROSS JOIN LATERAL jsonb_array_elements(r.payload->'translations'->?->'facts') fact WHERE b.editorial_date=? AND fact->>'id'=?",String.class,entry.getKey(),doc.editorialDate(),f.id());
    for(var old:priorFacts) {
     try { if(!mapper.valueToTree(mapper.treeToValue(json(old),BriefingDocument.Fact.class)).equals(mapper.valueToTree(f)))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"facts."+f.id()+": unchanged IDs cannot rewrite facts; use a new ID and explicit correction/update relationship");
     } catch(com.fasterxml.jackson.core.JsonProcessingException ex) {throw new IllegalStateException(ex);}
    }
    Set<String> visited=new HashSet<>();var cursor=f;
    while(cursor!=null && cursor.relatedFactId()!=null) {
     if(!visited.add(cursor.id()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"facts."+f.id()+": relationship cycle");
     String target=cursor.relatedFactId();cursor=localFacts.stream().filter(x->x.id().equals(target)).findFirst().orElse(null);
    }
   }
  }
  // Relationships must name an eligible earlier same-day fact or another fact in this publication.
  for(var entry:doc.translations().entrySet()) for(var f:entry.getValue().facts()) if(f.relatedFactId()!=null) {
   boolean local=entry.getValue().facts().stream().anyMatch(x->x.id().equals(f.relatedFactId()));
   boolean prior=Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM session_briefing_fact f JOIN session_briefing_revision r ON r.id=f.revision_id JOIN session_briefing b ON b.id=r.briefing_id WHERE b.editorial_date=? AND f.locale=? AND f.fact_id=? AND r.reference_time<=? AND NOT b.withdrawn AND CASE b.slot WHEN 'ASIA' THEN 0 WHEN 'LONDON' THEN 1 ELSE 2 END<=?)",Boolean.class,doc.editorialDate(),entry.getKey(),f.relatedFactId(),java.sql.Timestamp.from(doc.referenceTime()),doc.slot().ordinal()));
   if(!local && !prior)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"facts."+f.id()+": related fact is not available in this day/session");
  }
  UUID revision=UUID.randomUUID();
  int number=jdbc.queryForObject("SELECT coalesce(max(revision),0)+1 FROM session_briefing_revision WHERE briefing_id=?",Integer.class,id);
  jdbc.update("INSERT INTO session_briefing_revision(id,briefing_id,revision,draft_version,payload,reference_time,actor_id,request_id) VALUES (?,?,?,?,?::jsonb,?,?,?)",revision,id,number,request.version(),draft.path("document").toString(),java.sql.Timestamp.from(doc.referenceTime()),actor(),request.requestId());
  for(var entry:doc.translations().entrySet()) {
   for(var f:entry.getValue().facts())jdbc.update("INSERT INTO session_briefing_fact VALUES (?,?,?,?,?)",revision,entry.getKey(),f.id(),f.relatedFactId(),f.relationship()==null?null:f.relationship().name());
   for(var e:entry.getValue().events())jdbc.update("INSERT INTO session_briefing_event VALUES (?,?,?)",revision,entry.getKey(),e.id());
  }
  jdbc.update("UPDATE session_briefing SET published_draft_version=?,withdrawn=false,updated_at=now(),updated_by=? WHERE id=?",request.version(),actor(),id);
  audit(id,revision,"PUBLISH",request.version()); return revision(revision);
 }
 @PreAuthorize("hasRole('ADMIN')") @Transactional
 public void withdraw(UUID id,int version) {
  if(jdbc.update("UPDATE session_briefing SET withdrawn=true,draft_version=draft_version+1,updated_by=?,updated_at=now() WHERE id=? AND draft_version=?",actor(),id,version)!=1)conflict("Draft changed; reload before withdrawal");
  audit(id,null,"WITHDRAW",version+1);
 }
 private void audit(UUID id,UUID revision,String action,int version) {jdbc.update("INSERT INTO content_publication_audit(id,content_id,revision_id,actor_id,action,draft_version) VALUES (?,?,?,?,?,?)",UUID.randomUUID(),id,revision,actor(),action,version);}
 @PreAuthorize("hasRole('ADMIN')")
 public Map<String,Object> history(UUID id) {actor();return Map.of("revisions",jdbc.queryForList("SELECT id,revision,actor_id,published_at,reference_time,payload FROM session_briefing_revision WHERE briefing_id=? ORDER BY revision DESC",id),"actions",jdbc.queryForList("SELECT action,actor_id,occurred_at,draft_version FROM content_publication_audit WHERE content_id=? ORDER BY occurred_at DESC",id));}
 private static final String REVISION_SQL="SELECT jsonb_build_object('id',r.id,'briefingId',b.id,'revision',r.revision,'publishedAt',r.published_at,'firstPublishedAt',(SELECT min(published_at) FROM session_briefing_revision WHERE briefing_id=b.id),'actorId',r.actor_id,'withdrawn',b.withdrawn,'document',r.payload)::text FROM session_briefing_revision r JOIN session_briefing b ON b.id=r.briefing_id ";
 private JsonNode revision(UUID id){return json(jdbc.queryForObject(REVISION_SQL+"WHERE r.id=?",String.class,id));}
 public static Slot preferred(Instant now) {var t=now.atZone(ZoneId.of("Europe/Berlin")).toLocalTime();return t.isBefore(LocalTime.of(16,15))?Slot.ASIA:t.isBefore(LocalTime.of(22,30))?Slot.LONDON:Slot.DAY_RECAP;}
 public List<JsonNode> publications(LocalDate date) {
  actor();return jdbc.queryForList(REVISION_SQL+"WHERE NOT b.withdrawn AND b.editorial_date=? AND r.id=(SELECT id FROM session_briefing_revision WHERE briefing_id=b.id ORDER BY revision DESC LIMIT 1) ORDER BY CASE b.slot WHEN 'ASIA' THEN 0 WHEN 'LONDON' THEN 1 ELSE 2 END",String.class,date).stream().map(this::json).toList();
 }
 public ObjectNode selection(LocalDate date,Slot slot) {
  actor();Instant now=Instant.now();
  if(slot==null)slot=preferred(now);
  var root=mapper.createObjectNode();root.put("requestedDate",date.toString());root.put("requestedSlot",slot.name());root.put("editorialTimezone","Europe/Bucharest");root.put("selectionTimezone","Europe/Berlin");
  var rows=jdbc.queryForList(REVISION_SQL+"WHERE NOT b.withdrawn AND r.published_at<=? AND r.id=(SELECT id FROM session_briefing_revision WHERE briefing_id=b.id ORDER BY revision DESC LIMIT 1) AND (b.editorial_date<? OR (b.editorial_date=? AND CASE b.slot WHEN 'ASIA' THEN 0 WHEN 'LONDON' THEN 1 ELSE 2 END<=?)) ORDER BY b.editorial_date DESC, CASE b.slot WHEN 'DAY_RECAP' THEN 2 WHEN 'LONDON' THEN 1 ELSE 0 END DESC LIMIT 1",String.class,java.sql.Timestamp.from(now),date,date,slot.ordinal());
  if(!rows.isEmpty())root.set("selected",json(rows.get(0)));
  var selected=root.path("selected");root.put("missingPreferred",!selected.path("document").path("editorialDate").asText().equals(date.toString()) || !selected.path("document").path("slot").asText().equals(slot.name()));
  root.set("available",mapper.valueToTree(publications(date)));
  var prior=jdbc.queryForList(REVISION_SQL+"WHERE NOT b.withdrawn AND b.editorial_date<? AND b.slot='DAY_RECAP' AND r.id=(SELECT id FROM session_briefing_revision WHERE briefing_id=b.id ORDER BY revision DESC LIMIT 1) ORDER BY b.editorial_date DESC LIMIT 1",String.class,date);
  if(!prior.isEmpty())root.set("previousRecap",json(prior.get(0)));
  return root;
 }
 @Transactional(isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
 public JsonNode capture(LocalDate workspaceDate,LocalDate editorialDate,Slot slot) {
  UUID user=actor();var result=selection(editorialDate,slot);var selected=result.path("selected");
  UUID id=UUID.randomUUID();result.put("id",id.toString());result.put("kind","EDITORIAL");result.put("asOf",selected.path("document").path("referenceTime").asText(Instant.now().toString()));result.put("capturedAt",Instant.now().toString());
  var composition=result.putArray("composition");
  if(selected.has("id")) {
   var doc=selected.path("document");var rank=Slot.valueOf(doc.path("slot").asText()).ordinal();
   var rows=jdbc.queryForList(REVISION_SQL+"WHERE NOT b.withdrawn AND b.editorial_date=? AND CASE b.slot WHEN 'ASIA' THEN 0 WHEN 'LONDON' THEN 1 ELSE 2 END<=? AND r.id=(SELECT id FROM session_briefing_revision WHERE briefing_id=b.id AND published_at<=? AND reference_time<=? ORDER BY revision DESC LIMIT 1) ORDER BY CASE b.slot WHEN 'ASIA' THEN 0 WHEN 'LONDON' THEN 1 ELSE 2 END",String.class,LocalDate.parse(doc.path("editorialDate").asText()),rank,OffsetDateTime.parse(selected.path("publishedAt").asText()),InstantTimestamp(doc.path("referenceTime").asText()));
   rows.forEach(row->composition.add(json(row)));
   // Previous-day context obeys the same knowledge cutoff, even for a historical selection.
   result.remove("previousRecap");
   var prior=jdbc.queryForList(REVISION_SQL+"WHERE NOT b.withdrawn AND b.editorial_date<? AND b.slot='DAY_RECAP' AND r.id=(SELECT id FROM session_briefing_revision WHERE briefing_id=b.id AND published_at<=? AND reference_time<=? ORDER BY revision DESC LIMIT 1) ORDER BY b.editorial_date DESC LIMIT 1",String.class,LocalDate.parse(doc.path("editorialDate").asText()),OffsetDateTime.parse(selected.path("publishedAt").asText()),InstantTimestamp(doc.path("referenceTime").asText()));
   if(!prior.isEmpty())result.set("previousRecap",json(prior.get(0)));

  }
  result.remove("available");
  jdbc.update("INSERT INTO preparation_briefings(id,user_id,reference_date,session_key,payload) VALUES (?,?,?,?,?::jsonb)",id,user,workspaceDate,slot.name(),result.toString());
  int pos=0;Set<String> seen=new HashSet<>();
  for(var r:composition) {seen.add(r.path("id").asText());jdbc.update("INSERT INTO preparation_briefing_composition VALUES (?,?,?)",id,pos++,UUID.fromString(r.path("id").asText()));}
  var prior=result.path("previousRecap");if(prior.has("id") && seen.add(prior.path("id").asText()))jdbc.update("INSERT INTO preparation_briefing_composition VALUES (?,?,?)",id,pos,UUID.fromString(prior.path("id").asText()));
  return result;
 }
 private java.sql.Timestamp InstantTimestamp(String value){return java.sql.Timestamp.from(Instant.parse(value));}
 public List<UUID> withdrawnForCapture(UUID id) {
  actor();return jdbc.queryForList("SELECT r.id FROM preparation_briefing_composition c JOIN preparation_briefings p ON p.id=c.preparation_id JOIN session_briefing_revision r ON r.id=c.revision_id JOIN session_briefing b ON b.id=r.briefing_id WHERE c.preparation_id=? AND p.user_id=? AND b.withdrawn",UUID.class,id,actor());
 }
}
