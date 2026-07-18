package com.tradevault.controller;

import com.tradevault.domain.enums.PnlBasis;
import com.tradevault.dto.calendar.CalendarPlansResponse;
import com.tradevault.dto.calendar.CalendarAccountOptionResponse;
import com.tradevault.dto.trade.MonthlyPnlSummaryResponse;
import com.tradevault.service.TradeCalendarService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/calendar")
@RequiredArgsConstructor
public class CalendarController {
    private final TradeCalendarService tradeCalendarService;

    @GetMapping("/accounts")
    public List<CalendarAccountOptionResponse> accounts() {
        return tradeCalendarService.fetchAccountOptions();
    }

    @GetMapping("/month-summary")
    public MonthlyPnlSummaryResponse monthSummary(@RequestParam int year,
                                                  @RequestParam int month,
                                                  @RequestParam(required = false) String tz,
                                                  @RequestParam(required = false) String accountId,
                                                  @RequestParam(defaultValue = "close") String basis) {
        PnlBasis resolved = resolveBasis(basis);
        if (resolved != PnlBasis.CLOSE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only close basis is supported for monthly summary");
        }
        if (year < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid year value: " + year);
        }
        if (month < 1 || month > 12) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid month value: " + month);
        }
        return tradeCalendarService.fetchMonthlySummary(year, month, tz, resolved, accountId);
    }

    @GetMapping("/plans")
    public CalendarPlansResponse plans(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                       @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                       @RequestParam(required = false) String tz) {
        return tradeCalendarService.fetchPlanSummaries(from, to, tz);
    }

    private PnlBasis resolveBasis(String basis) {
        if (basis == null || basis.isBlank()) {
            return PnlBasis.CLOSE;
        }
        try {
            return PnlBasis.valueOf(basis.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid basis value: " + basis);
        }
    }
}
