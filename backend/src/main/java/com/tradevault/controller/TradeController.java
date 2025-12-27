package com.tradevault.controller;

import com.tradevault.dto.trade.TradeRequest;
import com.tradevault.dto.trade.TradeResponse;
import com.tradevault.service.TradeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/trades")
@RequiredArgsConstructor
public class TradeController {
    private final TradeService tradeService;

    @GetMapping
    public Page<TradeResponse> search(@RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "20") int size,
                                      @RequestParam(required = false) OffsetDateTime from,
                                      @RequestParam(required = false) OffsetDateTime to,
                                      @RequestParam(required = false) String symbol,
                                      @RequestParam(required = false) String strategy) {
        return tradeService.search(page, size, from, to, symbol, strategy);
    }

    @PostMapping
    public ResponseEntity<TradeResponse> create(@Valid @RequestBody TradeRequest request) {
        return ResponseEntity.ok(tradeService.create(request));
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
}
