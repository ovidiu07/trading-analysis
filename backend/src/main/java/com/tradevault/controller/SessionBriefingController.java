package com.tradevault.controller;
import com.tradevault.service.briefing.*;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import java.time.LocalDate;
import java.util.*;

@RestController @RequiredArgsConstructor
public class SessionBriefingController {
 private final SessionBriefingService service;
 @GetMapping("/api/admin/session-briefings") @PreAuthorize("hasRole('ADMIN')")
 public Object day(@RequestParam LocalDate date){return service.day(date);}
 @GetMapping("/api/admin/session-briefings/{id}") @PreAuthorize("hasRole('ADMIN')")
 public Object draft(@PathVariable UUID id){return service.draft(id);}
 @PostMapping("/api/admin/session-briefings") @PreAuthorize("hasRole('ADMIN')")
 public Object create(@RequestBody SessionBriefingService.Edit request){return service.save(null,request);}
 @PutMapping("/api/admin/session-briefings/{id}") @PreAuthorize("hasRole('ADMIN')")
 public Object save(@PathVariable UUID id,@RequestBody SessionBriefingService.Edit request){return service.save(id,request);}
 @PostMapping("/api/admin/session-briefings/preview") @PreAuthorize("hasRole('ADMIN')")
 public Object preview(@RequestBody JsonNode request){return service.preview(request);}
 @PostMapping("/api/admin/session-briefings/{id}/publish") @PreAuthorize("hasRole('ADMIN')")
 public Object publish(@PathVariable UUID id,@RequestBody SessionBriefingService.Publish request){return service.publish(id,request);}
 @PostMapping("/api/admin/session-briefings/{id}/withdraw") @PreAuthorize("hasRole('ADMIN')")
 public void withdraw(@PathVariable UUID id,@RequestBody SessionBriefingService.Publish request){service.withdraw(id,request.version());}
 @GetMapping("/api/admin/session-briefings/{id}/history") @PreAuthorize("hasRole('ADMIN')")
 public Object history(@PathVariable UUID id){return service.history(id);}
 @GetMapping("/api/session-briefings")
 public Object selection(@RequestParam LocalDate date,@RequestParam(required=false) BriefingDocument.Slot slot){return service.selection(date,slot);}
 public record Capture(LocalDate editorialDate, BriefingDocument.Slot slot) {}
 @PostMapping("/api/session-briefings/capture/{date}")
 public Object capture(@PathVariable LocalDate date,@RequestBody Capture request){
  if(request.editorialDate()==null || request.slot()==null)throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"editorialDate and slot required");
  return service.capture(date,request.editorialDate(),request.slot());
 }
 @GetMapping("/api/session-briefings/capture/{id}/withdrawals")
 public Object withdrawals(@PathVariable UUID id){return service.withdrawnForCapture(id);}
}
