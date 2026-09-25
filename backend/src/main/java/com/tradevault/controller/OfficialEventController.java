package com.tradevault.controller;

import com.tradevault.service.briefing.events.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import java.time.LocalDate;
import java.util.UUID;

@RestController @RequiredArgsConstructor @RequestMapping("/api/admin/official-events") @PreAuthorize("hasRole('ADMIN')")
public class OfficialEventController {
    private final OfficialEventService service;
    @GetMapping public Object inbox(@RequestParam LocalDate date){return service.inbox(date);}
    @PostMapping("/refresh/{source}") public Object refresh(@PathVariable OfficialEvent.Source source){return service.refresh(source);}
    @GetMapping("/{id}/history") public Object history(@PathVariable UUID id){return service.history(id);}
    public record Link(UUID previousId,UUID revisedId) {}
    @PostMapping("/link") public void link(@RequestBody Link link){service.link(link.previousId(),link.revisedId());}
    @PostMapping("/{id}/review") public Object review(@PathVariable UUID id){return service.review(id);}
    @PostMapping("/{id}/result") public Object result(@PathVariable UUID id,@RequestBody OfficialEventService.ResultRequest request){return service.result(id,request);}
}
