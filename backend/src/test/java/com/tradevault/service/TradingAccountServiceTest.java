package com.tradevault.service;

import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.User;
import com.tradevault.dto.account.CreateTradingAccountRequest;
import com.tradevault.dto.account.UpdateTradingAccountRequest;
import com.tradevault.exception.AccountDomainException;
import com.tradevault.repository.AccountRepository;
import com.tradevault.repository.TradeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TradingAccountServiceTest {
    @Mock CurrentUserService currentUserService;
    @Mock AccountRepository accountRepository;
    @Mock TradeRepository tradeRepository;

    private TradingAccountService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new TradingAccountService(currentUserService, accountRepository, tradeRepository);
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

    @Test
    void rejectsUpdatingAnAccountOwnedByAnotherUserWithoutRevealingIt() {
        UUID accountId = UUID.randomUUID();
        when(accountRepository.findByIdAndUserId(accountId, user.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(accountId, updateRequest("USD")))
                .isInstanceOf(AccountDomainException.class)
                .satisfies(error -> assertThat(((AccountDomainException) error).getCode())
                        .isEqualTo("ACCOUNT_NOT_ACCESSIBLE"));
    }

    @Test
    void rejectsCurrencyChangesWhenTradesAreLinked() {
        Account account = Account.builder().id(UUID.randomUUID()).user(user).name("Main")
                .accountCurrency("USD").build();
        when(accountRepository.findByIdAndUserId(account.getId(), user.getId())).thenReturn(Optional.of(account));
        when(tradeRepository.countByAccount_Id(account.getId())).thenReturn(3L);

        assertThatThrownBy(() -> service.update(account.getId(), updateRequest("EUR")))
                .isInstanceOf(AccountDomainException.class)
                .satisfies(error -> assertThat(((AccountDomainException) error).getCode())
                        .isEqualTo("ACCOUNT_CURRENCY_CONFLICT"));
    }

    @Test
    void archivesWithoutDeletingLinkedTrades() {
        Account account = Account.builder().id(UUID.randomUUID()).user(user).name("Main")
                .accountCurrency("USD").isDefault(true).build();
        when(accountRepository.findByIdAndUserId(account.getId(), user.getId())).thenReturn(Optional.of(account));
        when(accountRepository.save(any(Account.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(tradeRepository.countByAccount_Id(account.getId())).thenReturn(4L);

        var result = service.archive(account.getId());

        assertThat(result.status().name()).isEqualTo("ARCHIVED");
        assertThat(result.isDefault()).isFalse();
        assertThat(result.tradeCount()).isEqualTo(4);
        verify(accountRepository).save(account);
    }

    @Test
    void setsTheDefaultAfterClearingTheExistingUserDefault() {
        Account account = Account.builder().id(UUID.randomUUID()).user(user).name("Main")
                .accountCurrency("USD").status(com.tradevault.domain.enums.AccountStatus.ACTIVE).build();
        when(accountRepository.findByIdAndUserId(account.getId(), user.getId())).thenReturn(Optional.of(account));
        when(accountRepository.save(account)).thenReturn(account);

        var result = service.setDefault(account.getId());

        verify(accountRepository).clearDefaultForUser(user.getId());
        verify(accountRepository).save(account);
        assertThat(result.isDefault()).isTrue();
    }

    private static UpdateTradingAccountRequest updateRequest(String currency) {
        return new UpdateTradingAccountRequest(
                "Main", "Broker", currency, null, null, null, null, null
        );
    }
}
