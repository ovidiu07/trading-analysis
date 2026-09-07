package com.tradevault.service.briefing;

import com.fasterxml.jackson.databind.*;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.net.URI;
import java.time.*;
import java.util.*;

@Component @RequiredArgsConstructor
public class BriefingValidator {
 private final ObjectMapper mapper;
 private final Validator validator;
 public BriefingDocument parse(JsonNode raw, boolean publishing, Instant now) {
  if(raw == null || raw.toString().length()>250000) fail("document: maximum 250 KB");
  BriefingDocument doc;
  try { doc=mapper.copy().enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).treeToValue(raw,BriefingDocument.class); }
  catch(Exception ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid briefing schema: " + ex.getMessage()); }
  if(doc == null) { fail("document: required"); return null; }
  if(publishing) {
   var errors=validator.validate(doc);
   if(!errors.isEmpty()) fail(errors.stream().map(e->e.getPropertyPath()+": "+e.getMessage()).sorted().reduce((a,b)->a+"; "+b).orElse("Invalid document"));
  }
  if(doc.editorialDate()==null || doc.slot()==null || !"Europe/Bucharest".equals(doc.editorialTimezone()) || doc.schemaVersion()!=1) fail("identity: schemaVersion=1, editorialDate, slot and Europe/Bucharest required");
  validateLinks(raw, "document");
  if(!publishing) return doc;
  if(!doc.translations().containsKey(doc.contentLanguage())) fail("contentLanguage: translation is missing");
  if(doc.referenceTime().isAfter(now)) fail("referenceTime: factual reference cannot be in the future");
  if(doc.coverageStart().isAfter(doc.coverageEnd()) || doc.coverageStart().isAfter(doc.referenceTime())) fail("coverageStart: must precede end and reference");
  if(doc.coverage()==BriefingDocument.Coverage.COMPLETE && doc.coverageEnd().isAfter(doc.referenceTime())) fail("coverageEnd: complete coverage cannot exceed reference time");
  doc.translations().forEach((locale,t)-> {
   Set<String> ids=new HashSet<>();
   for(var f:t.facts()) {
    if(!ids.add(f.id())) fail(locale+".facts: duplicate id "+f.id());
    past(f.time(),doc.referenceTime(),locale+".facts."+f.id()+".time");
    past(f.availableAt(),doc.referenceTime(),locale+".facts."+f.id()+".availableAt");
    if(f.availableAt()==null && (f.availabilityNotEstablished()==null || f.availabilityNotEstablished().isBlank())) fail(locale+".facts."+f.id()+": availability must be stated");
    if((f.relatedFactId()==null)!=(f.relationship()==null) || f.id().equals(f.relatedFactId())) fail(locale+".facts."+f.id()+": invalid relationship");
   }
   ids.clear();
   for(var e:t.events()) {
    if(!ids.add(e.id())) fail(locale+".events: duplicate id "+e.id());
    try { ZoneId.of(e.timezone()); } catch(Exception ex) { fail(locale+".events."+e.id()+".timezone: invalid"); }
    if(e.status()==BriefingDocument.EventStatus.RELEASED) past(e.scheduledAt(),doc.referenceTime(),locale+".events."+e.id());
    if(e.status()!=BriefingDocument.EventStatus.RELEASED && e.actual()!=null && !e.actual().isBlank()) fail(locale+".events."+e.id()+": actual only allowed for RELEASED");
   }
   for(var n:t.news()) past(n.publishedAt(),doc.referenceTime(),locale+".news.publishedAt");
   for(var m:t.macro()) { if((m.value()!=null && !Double.isFinite(m.value())) || (m.referenceValue()!=null && !Double.isFinite(m.referenceValue()))) fail(locale+".macro: finite values required"); if(m.type().equalsIgnoreCase("YIELD") && !m.unit().equals("%")) fail(locale+".macro.unit: yield levels require %; changes are displayed in basis points"); past(m.observedAt(),doc.referenceTime(),locale+".macro.observedAt"); past(m.referenceAt(),m.observedAt(),locale+".macro.referenceAt"); if((m.referenceValue()==null)!=(m.referenceAt()==null)) fail(locale+".macro: reference value/time pair required"); }
   for(var s:t.scenarios()) if(s.type().equalsIgnoreCase("FUTURES") && (s.contract()==null || s.contract().isBlank())) fail(locale+".scenarios.contract: futures contract required");
  });
  return doc;
 }
 private void past(Instant time, Instant limit,String field) { if(time!=null && time.isAfter(limit)) fail(field+": cannot exceed reference time"); }
 private void validateLinks(JsonNode n,String path) {
  if(n.isObject()) n.fields().forEachRemaining(e->{
   if(e.getKey().toLowerCase(Locale.ROOT).endsWith("url") && !e.getValue().isNull() && !e.getValue().asText().isBlank()) {
    try { var u=URI.create(e.getValue().asText()); if(!Set.of("http","https").contains(u.getScheme()) || u.getHost()==null || u.getUserInfo()!=null) fail(path+"."+e.getKey()+": use an absolute http(s) URL"); }
    catch(IllegalArgumentException ex) { fail(path+"."+e.getKey()+": invalid URL"); }
   }
   validateLinks(e.getValue(),path+"."+e.getKey());
  });
  else if(n.isArray()) for(int i=0;i<n.size();i++) validateLinks(n.get(i),path+"["+i+"]");
 }
 private static void fail(String message) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,message); }
}
