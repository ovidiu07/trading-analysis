package com.tradevault.controller;

import com.tradevault.domain.enums.PnlBasis;
import com.tradevault.dto.trade.MonthlyPnlSummaryResponse;
import com.tradevault.service.TradeCalendarService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/calendar")
@RequiredArgsConstructor
public class CalendarController {
    private final TradeCalendarService tradeCalendarService;

    @GetMapping("/month-summary")
    public MonthlyPnlSummaryResponse monthSummary(@RequestParam int year,
                                                  @RequestParam int month,
                                                  @RequestParam(required = false) String tz,
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
        return tradeCalendarService.fetchMonthlySummary(year, month, tz, resolved);
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
