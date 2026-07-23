package com.tradevault.service.account;

import com.tradevault.domain.entity.Account;

import java.util.List;
import java.util.Set;
import java.util.UUID;

public record AuthorizedAccountScope(
        UUID userId,
        Mode mode,
        Set<UUID> accountIds,
        List<Account> accounts
) {
    public enum Mode {
        ALL,
        SELECTED
    }

    public boolean isAll() {
        return mode == Mode.ALL;
    }
}
