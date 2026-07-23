package com.tradevault.controller;

import com.tradevault.dto.account.CreateTradingAccountRequest;
import com.tradevault.dto.account.TradingAccountOptionResponse;
import com.tradevault.service.TradingAccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/accounts")
@RequiredArgsConstructor
public class TradingAccountController {
    private final TradingAccountService tradingAccountService;

    @GetMapping
    public List<TradingAccountOptionResponse> list() {
        return tradingAccountService.listEligibleAccounts();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TradingAccountOptionResponse create(@Valid @RequestBody CreateTradingAccountRequest request) {
        return tradingAccountService.create(request);
    }
}
