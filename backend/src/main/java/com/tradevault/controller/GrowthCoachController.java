package com.tradevault.controller;

import com.tradevault.dto.growthcoach.GrowthCoachResponse;
import com.tradevault.dto.growthcoach.GrowthProfileRequest;
import com.tradevault.dto.growthcoach.LedgerEventRequest;
import com.tradevault.dto.growthcoach.MonthlyGrowthPlanRequest;
import com.tradevault.service.growthcoach.GrowthCoachService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/growth-coach")
@RequiredArgsConstructor
public class GrowthCoachController {
    private final GrowthCoachService growthCoachService;

    @GetMapping
    public GrowthCoachResponse page(@RequestParam(required = false) UUID accountId,
                                    @RequestParam(required = false) String month) {
        return growthCoachService.getPage(accountId, month);
    }

    @PutMapping("/accounts/{accountId}/profile")
    public GrowthCoachResponse.GrowthProfile updateProfile(
            @PathVariable UUID accountId,
            @Valid @RequestBody GrowthProfileRequest request) {
        return growthCoachService.updateProfile(accountId, request);
    }

    @PutMapping("/accounts/{accountId}/plans/{monthKey}")
    public GrowthCoachResponse.MonthlyPlan updatePlan(
            @PathVariable UUID accountId,
            @PathVariable String monthKey,
            @Valid @RequestBody MonthlyGrowthPlanRequest request) {
        return growthCoachService.updatePlan(accountId, monthKey, request);
    }

    @PostMapping("/accounts/{accountId}/ledger")
    @ResponseStatus(HttpStatus.CREATED)
    public GrowthCoachResponse.LedgerEvent createLedgerEvent(
            @PathVariable UUID accountId,
            @Valid @RequestBody LedgerEventRequest request) {
        return growthCoachService.createLedgerEvent(accountId, request);
    }

    @PutMapping("/accounts/{accountId}/ledger/{eventId}")
    public GrowthCoachResponse.LedgerEvent updateLedgerEvent(
            @PathVariable UUID accountId,
            @PathVariable UUID eventId,
            @Valid @RequestBody LedgerEventRequest request) {
        return growthCoachService.updateLedgerEvent(accountId, eventId, request);
    }

    @DeleteMapping("/accounts/{accountId}/ledger/{eventId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteLedgerEvent(@PathVariable UUID accountId, @PathVariable UUID eventId) {
        growthCoachService.deleteLedgerEvent(accountId, eventId);
    }
}
