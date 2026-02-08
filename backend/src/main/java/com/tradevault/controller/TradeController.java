package com.tradevault.controller;

import com.tradevault.domain.enums.PnlBasis;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.trade.DailyPnlResponse;
import com.tradevault.dto.trade.DailySummaryResponse;
import com.tradevault.dto.trade.TradeRequest;
import com.tradevault.dto.trade.TradeResponse;
import com.tradevault.dto.trade.TradeCsvImportSummary;
import com.tradevault.service.TradeCalendarService;
import com.tradevault.service.TradeCsvImportService;
import com.tradevault.service.TradeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.math.BigDecimal;
import java.util.UUID;
import java.io.IOException;

@RestController
@RequestMapping("/api/trades")
@RequiredArgsConstructor
public class TradeController {
    private final TradeService tradeService;
    private final TradeCalendarService tradeCalendarService;
    private final TradeCsvImportService tradeCsvImportService;

    @GetMapping
    public Page<TradeResponse> list(@RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "20") int size) {
        return tradeService.listAll(page, size);
    }

    @GetMapping("/search")
    public Page<TradeResponse> search(@RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "20") int size,
                                      @RequestParam(required = false) String openedAtFrom,
                                      @RequestParam(required = false) String openedAtTo,
                                      @RequestParam(required = false) OffsetDateTime closedAtFrom,
                                      @RequestParam(required = false) OffsetDateTime closedAtTo,
                                      @RequestParam(required = false) LocalDate closedDate,
                                      @RequestParam(required = false) String tz,
                                      @RequestParam(required = false) String symbol,
                                      @RequestParam(required = false) String strategy,
                                      @RequestParam(required = false) String direction,
                                      @RequestParam(required = false) TradeStatus status) {
        var parsedDirection = parseDirection(direction);
        return tradeService.search(page, size, openedAtFrom, openedAtTo, closedAtFrom, closedAtTo, closedDate, tz, symbol, strategy, parsedDirection, status);
    }

    private com.tradevault.domain.enums.Direction parseDirection(String direction) {
        if (direction == null || direction.isBlank()) {
            return null;
        }
        try {
            return com.tradevault.domain.enums.Direction.valueOf(direction);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid direction value: " + direction);
        }
    }

    @PostMapping
    public ResponseEntity<TradeResponse> create(@Valid @RequestBody TradeRequest request) {
        return ResponseEntity.ok(tradeService.create(request));
    }

    @PostMapping(value = "/import/csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<TradeCsvImportSummary> importCsv(@RequestParam("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV file is required");
        }
        return ResponseEntity.ok(tradeCsvImportService.importCsv(file));
    }

    @GetMapping("/daily-pnl")
    public java.util.List<DailyPnlResponse> dailyPnl(@RequestParam LocalDate from,
                                                     @RequestParam LocalDate to,
                                                     @RequestParam(required = false) String tz,
                                                     @RequestParam(defaultValue = "close") String basis) {
        PnlBasis resolved = resolveBasis(basis);
        return tradeCalendarService.fetchDailyPnl(from, to, tz, resolved);
    }

    @GetMapping("/daily-summary")
    public DailySummaryResponse dailySummary(@RequestParam LocalDate date,
                                             @RequestParam(required = false) String tz,
                                             @RequestParam(defaultValue = "close") String basis) {
        if (basis != null && !basis.isBlank() && !"close".equalsIgnoreCase(basis)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only close basis is supported for daily summary");
        }
        return tradeService.dailySummary(date, tz);
    }

    @GetMapping("/{id}")
    public TradeResponse getById(@PathVariable UUID id) {
        return tradeService.getById(id);
    }

    @GetMapping("/closed-day")
    public java.util.List<TradeResponse> closedDay(@RequestParam LocalDate date,
                                                   @RequestParam(required = false) String tz) {
        return tradeService.listClosedTradesByDate(date, tz);
    }

    @PutMapping("/{id}")
    public ResponseEntity<TradeResponse> update(@PathVariable UUID id, @Valid @RequestBody TradeRequest request) {
        return ResponseEntity.ok(tradeService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        tradeService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/losses")
    public java.util.List<TradeResponse> listLosses(@RequestParam LocalDate from,
                                                    @RequestParam LocalDate to,
                                                    @RequestParam(required = false) String tz,
                                                    @RequestParam(required = false) BigDecimal minLoss) {
        return tradeService.listLosses(from, to, tz, minLoss);
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
