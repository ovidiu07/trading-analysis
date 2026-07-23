package com.tradevault.service;

import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.User;
import com.tradevault.dto.account.CreateTradingAccountRequest;
import com.tradevault.repository.AccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TradingAccountServiceTest {
    @Mock CurrentUserService currentUserService;
    @Mock AccountRepository accountRepository;

    private TradingAccountService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new TradingAccountService(currentUserService, accountRepository);
        user = User.builder().id(UUID.randomUUID()).email("owner@example.test").build();
        when(currentUserService.getCurrentUser()).thenReturn(user);
    }

    @Test
    void listsOnlyAccountsReturnedForTheAuthenticatedUser() {
        Account owned = Account.builder().id(UUID.randomUUID()).user(user).name("Institutional Funding 50K")
                .broker("TRDX").accountCurrency("USD").build();
        when(accountRepository.findByUserIdOrderByNameAsc(user.getId())).thenReturn(List.of(owned));

        var result = service.listEligibleAccounts();

        assertThat(result).singleElement().satisfies(option -> {
            assertThat(option.id()).isEqualTo(owned.getId());
            assertThat(option.name()).isEqualTo("Institutional Funding 50K");
            assertThat(option.broker()).isEqualTo("TRDX");
            assertThat(option.currency()).isEqualTo("USD");
        });
        verify(accountRepository).findByUserIdOrderByNameAsc(user.getId());
    }

    @Test
    void createsAnUnmappedInternalAccountForTheAuthenticatedUser() {
        when(accountRepository.save(org.mockito.ArgumentMatchers.any())).thenAnswer(invocation -> {
            Account account = invocation.getArgument(0);
            account.setId(UUID.randomUUID());
            return account;
        });

        var result = service.create(new CreateTradingAccountRequest(" Main account ", " TRDX ", "usd"));

        assertThat(result.name()).isEqualTo("Main account");
        assertThat(result.broker()).isEqualTo("TRDX");
        assertThat(result.currency()).isEqualTo("USD");
        assertThat(result.externalAccountId()).isNull();
        verify(accountRepository).save(org.mockito.ArgumentMatchers.argThat(account ->
                account.getUser() == user && account.getExternalAccountId() == null));
    }
}
