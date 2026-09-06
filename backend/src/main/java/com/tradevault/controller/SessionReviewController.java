package com.tradevault.controller;

import com.tradevault.service.today.SessionReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/today/reviews")
@RequiredArgsConstructor
public class SessionReviewController {
    private final SessionReviewService reviews;
    @GetMapping("/{accountId}/{date}")
    public SessionReviewService.Response get(@PathVariable UUID accountId, @PathVariable LocalDate date) {
        return reviews.get(accountId, date);
    }
    @GetMapping("/{accountId}/{date}/history")
    public java.util.List<SessionReviewService.Response> history(@PathVariable UUID accountId, @PathVariable LocalDate date) {
        return reviews.history(accountId, date);
    }
    @PutMapping("/{accountId}/{date}")
    public SessionReviewService.Response save(@PathVariable UUID accountId, @PathVariable LocalDate date,
                                             @Valid @RequestBody SessionReviewService.Request request) {
        return reviews.save(accountId, date, request);
    }
}
