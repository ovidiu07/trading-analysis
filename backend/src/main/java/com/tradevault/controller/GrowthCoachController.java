package com.tradevault.controller;

import com.tradevault.dto.growthcoach.GrowthCoachResponse;
import com.tradevault.dto.growthcoach.GrowthProfileRequest;
import com.tradevault.dto.growthcoach.LedgerEventRequest;
import com.tradevault.dto.growthcoach.MonthlyGrowthPlanRequest;
import com.tradevault.dto.growthcoach.PeriodPlanRequest;
import com.tradevault.dto.growthcoach.ReconcileBalanceRequest;
import com.tradevault.service.growthcoach.GrowthCoachService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/growth-coach")
@RequiredArgsConstructor
public class GrowthCoachController {
    private final GrowthCoachService growthCoachService;

    @GetMapping
    public GrowthCoachResponse page(@RequestParam(required = false) UUID accountId,
                                    @RequestParam(required = false) String month,
                                    @RequestParam(required = false) String period,
                                    @RequestParam(required = false) LocalDate date) {
        return growthCoachService.getPage(accountId, month, period, date);
    }

    @PutMapping("/accounts/{accountId}/period-plans/{periodType}/{periodKey}")
    public GrowthCoachResponse.PeriodPlan updatePeriodPlan(
            @PathVariable UUID accountId,
            @PathVariable String periodType,
            @PathVariable String periodKey,
            @Valid @RequestBody PeriodPlanRequest request) {
        return growthCoachService.updatePeriodPlan(accountId, periodType, periodKey, request);
    }

    @PostMapping("/accounts/{accountId}/reconcile")
    @ResponseStatus(HttpStatus.CREATED)
    public GrowthCoachResponse.LedgerEvent reconcileBalance(
            @PathVariable UUID accountId,
            @Valid @RequestBody ReconcileBalanceRequest request) {
        return growthCoachService.reconcileBalance(accountId, request);
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
