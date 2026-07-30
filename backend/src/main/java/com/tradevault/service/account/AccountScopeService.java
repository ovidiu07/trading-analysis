package com.tradevault.service.account;

import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.User;
import com.tradevault.exception.AccountDomainException;
import com.tradevault.repository.AccountRepository;
import com.tradevault.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AccountScopeService {
    private static final Logger log = LoggerFactory.getLogger(AccountScopeService.class);

    private final CurrentUserService currentUserService;
    private final AccountRepository accountRepository;

    @Transactional(readOnly = true)
    public AuthorizedAccountScope resolve(String accountIds, String legacyAccountId) {
        User user = currentUserService.getCurrentUser();
        Set<UUID> requestedIds = parseRequestedIds(firstNonBlank(accountIds, legacyAccountId));

        if (requestedIds.isEmpty()) {
            List<Account> accounts = accountRepository.findByUserIdOrderByNameAsc(user.getId());
            return new AuthorizedAccountScope(
                    user.getId(),
                    AuthorizedAccountScope.Mode.ALL,
                    Set.of(),
                    accounts
            );
        }

        List<Account> accounts = accountRepository.findByUserIdAndIdIn(user.getId(), requestedIds).stream()
                .sorted(Comparator.comparing(Account::getName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                        .thenComparing(Account::getId))
                .toList();

        if (accounts.size() != requestedIds.size()) {
            log.warn("Rejected inaccessible account scope userId={} requestedCount={} resolvedCount={}",
                    user.getId(), requestedIds.size(), accounts.size());
            throw invalidSelection(
                    HttpStatus.NOT_FOUND,
                    "The requested account selection contains an inaccessible or nonexistent account"
            );
        }

        return new AuthorizedAccountScope(
                user.getId(),
                AuthorizedAccountScope.Mode.SELECTED,
                requestedIds,
                accounts
        );
    }

    private Set<UUID> parseRequestedIds(String raw) {
        if (raw == null || raw.isBlank() || "all".equalsIgnoreCase(raw.trim())) {
            return Set.of();
        }
        LinkedHashSet<UUID> ids = new LinkedHashSet<>();
        for (String token : raw.split(",")) {
            String normalized = token.trim();
            if (normalized.isEmpty()) {
                continue;
            }
            try {
                ids.add(UUID.fromString(normalized));
            } catch (IllegalArgumentException ex) {
                throw invalidSelection(
                        HttpStatus.BAD_REQUEST,
                        "Account selection must contain internal TradeJAudit account IDs"
                );
            }
        }
        if (ids.isEmpty()) {
            throw invalidSelection(
                    HttpStatus.BAD_REQUEST,
                    "Selected account scope must contain at least one account"
            );
        }
        return ids.stream()
                .sorted()
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    private String firstNonBlank(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) {
            return primary;
        }
        return fallback;
    }

    private AccountDomainException invalidSelection(HttpStatus status, String message) {
        return new AccountDomainException("INVALID_ACCOUNT_SELECTION", status, message);
    }
}
