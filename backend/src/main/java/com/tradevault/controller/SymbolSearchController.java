package com.tradevault.controller;

import com.tradevault.domain.enums.Market;
import com.tradevault.dto.symbol.SymbolSearchResult;
import com.tradevault.service.symbol.SymbolSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/symbols")
@RequiredArgsConstructor
public class SymbolSearchController {
    private final SymbolSearchService symbolSearchService;

    @GetMapping("/search")
    public List<SymbolSearchResult> search(
            @RequestParam("q") String query,
            @RequestParam(value = "market", required = false) Market market
    ) {
        return symbolSearchService.search(query, market);
    }
}
