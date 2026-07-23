package com.tradevault.service;

import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.User;
import com.tradevault.dto.account.CreateTradingAccountRequest;
import com.tradevault.dto.account.TradingAccountOptionResponse;
import com.tradevault.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class TradingAccountService {
    private final CurrentUserService currentUserService;
    private final AccountRepository accountRepository;

    @Transactional(readOnly = true)
    public List<TradingAccountOptionResponse> listEligibleAccounts() {
        User user = currentUserService.getCurrentUser();
        return accountRepository.findByUserIdOrderByNameAsc(user.getId()).stream()
                .map(TradingAccountService::toResponse)
                .toList();
    }

    @Transactional
    public TradingAccountOptionResponse create(CreateTradingAccountRequest request) {
        User user = currentUserService.getCurrentUser();
        Account account = Account.builder()
                .user(user)
                .name(request.name().trim())
                .broker(normalizeOptional(request.broker()))
                .accountCurrency(request.currency().trim().toUpperCase(Locale.ROOT))
                .createdAt(OffsetDateTime.now())
                .build();
        return toResponse(accountRepository.save(account));
    }

    private static TradingAccountOptionResponse toResponse(Account account) {
        return new TradingAccountOptionResponse(
                account.getId(),
                account.getName(),
                account.getBroker(),
                account.getAccountCurrency(),
                account.getExternalAccountId(),
                account.getBrokerServer(),
                account.getBrokerTimezone()
        );
    }

    private static String normalizeOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
