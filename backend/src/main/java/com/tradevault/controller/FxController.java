package com.tradevault.controller;

import com.tradevault.dto.fx.FxRateResponse;
import com.tradevault.service.FxRateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/fx")
@RequiredArgsConstructor
public class FxController {
    private final FxRateService fxRateService;

    @GetMapping("/rate")
    public FxRateResponse rate(@RequestParam("base") String baseCurrency,
                               @RequestParam("quote") String quoteCurrency) {
        try {
            return fxRateService.getLatestRate(baseCurrency, quoteCurrency);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage(), ex);
        } catch (IllegalStateException ex) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, ex.getMessage(), ex);
        }
    }
}
