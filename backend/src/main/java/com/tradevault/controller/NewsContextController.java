package com.tradevault.controller;

import com.tradevault.service.CurrentUserService;
import com.tradevault.service.news.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.time.*;

@RestController
@RequestMapping("/api/market-context")
@RequiredArgsConstructor
public class NewsContextController {
    private final CurrentUserService users;
    private final NewsContextService context;
    @GetMapping
    public ResponseEntity<NewsModels.Snapshot> get(@RequestParam String instrument,@RequestParam LocalDate date,
            @RequestParam(defaultValue="Europe/Bucharest") String timezone,@RequestParam(defaultValue="SESSION") String window,
            @RequestParam(required=false) Instant asOf) {
        users.getCurrentUser();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(context.snapshot(instrument,date,timezone,window,asOf));
    }
    @PostMapping("/refresh")
    public ResponseEntity<Void> refresh(@RequestParam String instrument) {
        users.getCurrentUser();context.requestRefresh(instrument);
        return ResponseEntity.accepted().build();
    }
}
