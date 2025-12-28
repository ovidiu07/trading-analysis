package com.tradevault.controller;

import com.tradevault.dto.trade.TradeRequest;
import com.tradevault.dto.trade.TradeResponse;
import com.tradevault.service.TradeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.OffsetDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/trades")
@RequiredArgsConstructor
public class TradeController {
    private final TradeService tradeService;

    @GetMapping
    public Page<TradeResponse> list(@RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "20") int size) {
        return tradeService.listAll(page, size);
    }

    @GetMapping("/search")
    public Page<TradeResponse> search(@RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "20") int size,
                                      @RequestParam(required = false) OffsetDateTime openedAtFrom,
                                      @RequestParam(required = false) OffsetDateTime openedAtTo,
                                      @RequestParam(required = false) OffsetDateTime closedAtFrom,
                                      @RequestParam(required = false) OffsetDateTime closedAtTo,
                                      @RequestParam(required = false) String symbol,
                                      @RequestParam(required = false) String direction) {
        var parsedDirection = parseDirection(direction);
        return tradeService.search(page, size, openedAtFrom, openedAtTo, closedAtFrom, closedAtTo, symbol, parsedDirection);
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
