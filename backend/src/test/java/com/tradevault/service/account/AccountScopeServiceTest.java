package com.tradevault.service.account;

import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.User;
import com.tradevault.repository.AccountRepository;
import com.tradevault.service.CurrentUserService;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AccountScopeServiceTest {
    private final UUID userId = UUID.randomUUID();
    private CurrentUserService currentUserService;
    private AccountRepository accountRepository;
    private AccountScopeService accountScopeService;

    @BeforeEach
    void setUp() {
        currentUserService = mock(CurrentUserService.class);
        accountRepository = mock(AccountRepository.class);
        accountScopeService = new AccountScopeService(currentUserService, accountRepository);
        when(currentUserService.getCurrentUser()).thenReturn(User.builder().id(userId).build());
    }

    @Test
    void resolvesAbsentScopeAsAllOwnedAccounts() {
        Account account = account(UUID.randomUUID(), "Primary");
        when(accountRepository.findByUserIdOrderByNameAsc(userId)).thenReturn(List.of(account));

        AuthorizedAccountScope scope = accountScopeService.resolve(null, null);

        assertEquals(AuthorizedAccountScope.Mode.ALL, scope.mode());
        assertEquals(Set.of(), scope.accountIds());
        assertEquals(List.of(account), scope.accounts());
    }

    @Test
    void resolvesSelectedScopeWithDeduplicationAndStableOrdering() {
        UUID firstId = UUID.fromString("00000000-0000-4000-8000-000000000001");
        UUID secondId = UUID.fromString("00000000-0000-4000-8000-000000000002");
        Account first = account(firstId, "Alpha");
        Account second = account(secondId, "Zulu");
        when(accountRepository.findByUserIdAndIdIn(org.mockito.ArgumentMatchers.eq(userId), anyCollection()))
                .thenReturn(List.of(second, first));

        AuthorizedAccountScope scope = accountScopeService.resolve(
                secondId + "," + firstId + "," + secondId,
                null
        );

        assertEquals(AuthorizedAccountScope.Mode.SELECTED, scope.mode());
        assertEquals(List.of(firstId, secondId), List.copyOf(scope.accountIds()));
        assertEquals(List.of(first, second), scope.accounts());
        verify(accountRepository).findByUserIdAndIdIn(userId, Set.of(firstId, secondId));
    }

    @Test
    void rejectsMalformedAndLegacyBrokerIdentifiers() {
        assertThrows(IllegalArgumentException.class, () -> accountScopeService.resolve("broker-123", null));
        assertThrows(IllegalArgumentException.class, () -> accountScopeService.resolve(" , ", null));
    }

    @Test
    void rejectsASelectionContainingAnUnownedOrMissingAccount() {
        UUID ownedId = UUID.randomUUID();
        UUID inaccessibleId = UUID.randomUUID();
        when(accountRepository.findByUserIdAndIdIn(org.mockito.ArgumentMatchers.eq(userId), anyCollection()))
                .thenReturn(List.of(account(ownedId, "Owned")));

        assertThrows(
                EntityNotFoundException.class,
                () -> accountScopeService.resolve(ownedId + "," + inaccessibleId, null)
        );
    }

    private Account account(UUID id, String name) {
        return Account.builder().id(id).name(name).user(User.builder().id(userId).build()).build();
    }
}
