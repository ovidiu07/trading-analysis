package com.tradevault.controller;

import com.tradevault.dto.market.MarketWorkspaceResponse;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.marketdata.MarketWorkspaceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;
import java.time.LocalDate;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class MarketWorkspaceController {
    private final CurrentUserService currentUserService;
    private final MarketWorkspaceService marketWorkspaceService;

    @GetMapping("/market-workspace")
    public ResponseEntity<MarketWorkspaceResponse> getSnapshot(
            @RequestParam UUID accountId,
            @RequestParam(required = false) String selectedInstrument,
            @RequestParam(required = false) LocalDate date) {
        UUID userId = currentUserService.getCurrentUser().getId();
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore()).body(marketWorkspaceService.snapshot(userId, accountId, selectedInstrument, date));
    }
}
