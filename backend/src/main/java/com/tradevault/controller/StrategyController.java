package com.tradevault.controller;

import com.tradevault.dto.strategy.StrategyListResponse;
import com.tradevault.dto.strategy.StrategyRequest;
import com.tradevault.dto.strategy.StrategyResponse;
import com.tradevault.service.LocaleResolverService;
import com.tradevault.service.StrategyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/strategies")
@RequiredArgsConstructor
public class StrategyController {
    private final StrategyService strategyService;
    private final LocaleResolverService localeResolverService;

    @GetMapping
    public StrategyListResponse list(@RequestParam(defaultValue = "false") boolean includeArchived,
                                     @RequestParam(required = false, name = "lang") String lang,
                                     @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage) {
        String locale = localeResolverService.resolveLocale(lang, acceptLanguage);
        return strategyService.listStrategies(includeArchived, locale);
    }

    @PostMapping
    public ResponseEntity<StrategyResponse> create(@Valid @RequestBody StrategyRequest request) {
        return ResponseEntity.ok(strategyService.createMyStrategy(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<StrategyResponse> update(@PathVariable UUID id,
                                                   @Valid @RequestBody StrategyRequest request) {
        return ResponseEntity.ok(strategyService.updateMyStrategy(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> archive(@PathVariable UUID id) {
        strategyService.archiveMyStrategy(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/assets/{assetId}")
    public ResponseEntity<StrategyResponse> attachAsset(@PathVariable UUID id,
                                                        @PathVariable UUID assetId) {
        return ResponseEntity.ok(strategyService.attachAsset(id, assetId));
    }

    @DeleteMapping("/{id}/assets/{assetId}")
    public ResponseEntity<StrategyResponse> removeAsset(@PathVariable UUID id,
                                                        @PathVariable UUID assetId) {
        return ResponseEntity.ok(strategyService.removeAsset(id, assetId));
    }

    @PutMapping("/{id}/snapshot/{assetId}")
    public ResponseEntity<StrategyResponse> setSnapshot(@PathVariable UUID id,
                                                        @PathVariable UUID assetId) {
        return ResponseEntity.ok(strategyService.setSnapshotAsset(id, assetId));
    }

    @DeleteMapping("/{id}/snapshot")
    public ResponseEntity<StrategyResponse> clearSnapshot(@PathVariable UUID id) {
        return ResponseEntity.ok(strategyService.clearSnapshotAsset(id));
    }
}
