package com.tradevault.service;

import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.AccountStatus;
import com.tradevault.dto.account.CreateTradingAccountRequest;
import com.tradevault.dto.account.TradingAccountOptionResponse;
import com.tradevault.dto.account.UpdateTradingAccountRequest;
import com.tradevault.exception.AccountDomainException;
import com.tradevault.repository.AccountRepository;
import com.tradevault.repository.TradeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TradingAccountService {
    private final CurrentUserService currentUserService;
    private final AccountRepository accountRepository;
    private final TradeRepository tradeRepository;

    @Transactional(readOnly = true)
    public List<TradingAccountOptionResponse> listEligibleAccounts() {
        User user = currentUserService.getCurrentUser();
        return accountRepository.findByUserIdOrderByNameAsc(user.getId()).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public TradingAccountOptionResponse create(CreateTradingAccountRequest request) {
        User user = currentUserService.getCurrentUser();
        Account account = Account.builder()
                .user(user)
                .name(request.name().trim())
                .broker(normalizeOptional(request.broker()))
                .accountCurrency(normalizeCurrency(request.currency()))
                .accountType(normalizeOptional(request.accountType()))
                .externalAccountId(normalizeOptional(request.externalAccountId()))
                .brokerServer(normalizeOptional(request.brokerServer()))
                .brokerTimezone(normalizeOptional(request.brokerTimezone()))
                .startingBalance(request.startingBalance())
                .status(AccountStatus.ACTIVE)
                .build();
        validateExternalMapping(account, user.getId());
        return toResponse(accountRepository.save(account));
    }

    @Transactional
    public TradingAccountOptionResponse update(UUID accountId, UpdateTradingAccountRequest request) {
        User user = currentUserService.getCurrentUser();
        Account account = requireOwned(accountId, user.getId());
        String nextCurrency = normalizeCurrency(request.currency());
        long tradeCount = tradeRepository.countByAccount_Id(account.getId());
        if (tradeCount > 0 && !Objects.equals(normalizeCurrency(account.getAccountCurrency()), nextCurrency)) {
            throw new AccountDomainException(
                    "ACCOUNT_CURRENCY_CONFLICT",
                    HttpStatus.CONFLICT,
                    "Account currency cannot be changed while the account has linked trades."
            );
        }
        String nextExternalId = normalizeOptional(request.externalAccountId());
        String nextServer = normalizeOptional(request.brokerServer());
        if (tradeCount > 0 && (
                !Objects.equals(normalizeOptional(account.getExternalAccountId()), nextExternalId)
                        || !Objects.equals(normalizeOptional(account.getBrokerServer()), nextServer)
        )) {
            throw new AccountDomainException(
                    "ACCOUNT_EXTERNAL_MAPPING_IMMUTABLE",
                    HttpStatus.CONFLICT,
                    "Broker account mapping cannot be changed while the account has linked trades."
            );
        }

        account.setName(request.name().trim());
        account.setBroker(normalizeOptional(request.broker()));
        account.setAccountCurrency(nextCurrency);
        account.setAccountType(normalizeOptional(request.accountType()));
        account.setExternalAccountId(nextExternalId);
        account.setBrokerServer(nextServer);
        account.setBrokerTimezone(normalizeOptional(request.brokerTimezone()));
        account.setStartingBalance(request.startingBalance());
        validateExternalMapping(account, user.getId());
        return toResponse(accountRepository.save(account));
    }

    @Transactional
    public TradingAccountOptionResponse archive(UUID accountId) {
        User user = currentUserService.getCurrentUser();
        Account account = requireOwned(accountId, user.getId());
        account.setStatus(AccountStatus.ARCHIVED);
        account.setDefault(false);
        return toResponse(accountRepository.save(account));
    }

    @Transactional
    public TradingAccountOptionResponse restore(UUID accountId) {
        User user = currentUserService.getCurrentUser();
        Account account = requireOwned(accountId, user.getId());
        account.setStatus(AccountStatus.ACTIVE);
        return toResponse(accountRepository.save(account));
    }

    @Transactional
    public TradingAccountOptionResponse setDefault(UUID accountId) {
        User user = currentUserService.getCurrentUser();
        Account selected = requireOwned(accountId, user.getId());
        if (selected.getStatus() != AccountStatus.ACTIVE) {
            throw new AccountDomainException(
                    "ACCOUNT_ARCHIVED",
                    HttpStatus.CONFLICT,
                    "Only an active account can be the default trading account."
            );
        }
        accountRepository.clearDefaultForUser(user.getId());
        selected.setDefault(true);
        return toResponse(accountRepository.save(selected));
    }

    private Account requireOwned(UUID accountId, UUID userId) {
        return accountRepository.findByIdAndUserId(accountId, userId)
                .orElseThrow(() -> new AccountDomainException(
                        "ACCOUNT_NOT_ACCESSIBLE",
                        HttpStatus.NOT_FOUND,
                        "Trading account was not found."
                ));
    }

    private void validateExternalMapping(Account account, UUID userId) {
        String externalId = normalizeOptional(account.getExternalAccountId());
        if (externalId == null) {
            return;
        }
        String server = normalizeOptional(account.getBrokerServer());
        accountRepository.findByUserIdAndExternalAccountIdIgnoreCase(userId, externalId).stream()
                .filter(existing -> Objects.equals(
                        normalizeServer(existing.getBrokerServer()),
                        normalizeServer(server)
                ))
                .filter(existing -> !Objects.equals(existing.getId(), account.getId()))
                .findAny()
                .ifPresent(existing -> {
                    throw new AccountDomainException(
                            "ACCOUNT_EXTERNAL_MAPPING_CONFLICT",
                            HttpStatus.CONFLICT,
                            "This broker account is already mapped to another TradeJAudit account."
                    );
                });
    }

    private TradingAccountOptionResponse toResponse(Account account) {
        return new TradingAccountOptionResponse(
                account.getId(),
                account.getName(),
                account.getBroker(),
                account.getAccountCurrency(),
                account.getExternalAccountId(),
                account.getBrokerServer(),
                account.getBrokerTimezone(),
                account.getAccountType(),
                account.getStatus(),
                account.isDefault(),
                account.getStartingBalance(),
                account.getId() == null ? 0 : tradeRepository.countByAccount_Id(account.getId()),
                account.getCreatedAt(),
                account.getUpdatedAt()
        );
    }

    private static String normalizeCurrency(String value) {
        return value == null ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    private static String normalizeServer(String value) {
        String normalized = normalizeOptional(value);
        return normalized == null ? "" : normalized.toLowerCase(Locale.ROOT);
    }

    private static String normalizeOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
