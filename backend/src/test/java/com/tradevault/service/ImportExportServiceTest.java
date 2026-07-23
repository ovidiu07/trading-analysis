package com.tradevault.service;

import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.Trade;
import com.tradevault.repository.TradeRepository;
import com.tradevault.service.account.AccountScopeService;
import com.tradevault.service.account.AuthorizedAccountScope;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.domain.Specification;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ImportExportServiceTest {
    @Test
    void exportUsesAuthorizedAccountScopeAndIncludesRoundTripSafeMetadata() throws Exception {
        TradeRepository tradeRepository = mock(TradeRepository.class);
        AccountScopeService accountScopeService = mock(AccountScopeService.class);
        UUID userId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        Account account = Account.builder()
                .id(accountId)
                .name("Funded\nAccount")
                .accountCurrency("USD")
                .build();
        when(accountScopeService.resolve(accountId.toString(), null)).thenReturn(new AuthorizedAccountScope(
                userId,
                AuthorizedAccountScope.Mode.SELECTED,
                Set.of(accountId),
                List.of(account)
        ));
        when(tradeRepository.findAll(any(Specification.class))).thenReturn(List.of(
                Trade.builder().symbol("EURUSD").notes("Scoped export").build()
        ));
        ImportExportService service = new ImportExportService(
                tradeRepository,
                mock(CurrentUserService.class),
                mock(TradeCsvImportService.class),
                accountScopeService
        );

        String csv = service.exportCsv(null, null, accountId.toString(), null);

        assertTrue(csv.startsWith("# Account scope: 1 selected accounts\n"));
        assertTrue(csv.contains("# Account: Funded Account [" + accountId + "]\n"));
        assertTrue(csv.contains("\nsymbol,market,direction,openedAt"));
        assertTrue(csv.contains("\nEURUSD,"));
        verify(accountScopeService).resolve(accountId.toString(), null);
        verify(tradeRepository).findAll(any(Specification.class));
    }
}
