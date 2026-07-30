package com.tradevault.service;

import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeSource;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.trade.TradeDataDeletionRequest;
import com.tradevault.repository.AccountRepository;
import com.tradevault.repository.NotebookNoteRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.service.backtesting.LiveTradeEvidenceChangedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TradeDataManagementServiceTest {
    @Mock CurrentUserService currentUserService;
    @Mock AccountRepository accountRepository;
    @Mock TradeRepository tradeRepository;
    @Mock NotebookNoteRepository notebookNoteRepository;
    @Mock ApplicationEventPublisher eventPublisher;

    private TradeDataManagementService service;
    private User user;
    private Account account;
    private List<Trade> intervalTrades;

    @BeforeEach
    void setUp() {
        user = User.builder().id(UUID.randomUUID()).email("owner@example.test")
                .timezone("Europe/Bucharest").build();
        account = Account.builder().id(UUID.randomUUID()).user(user).name("Trading 212 EUR")
                .accountCurrency("EUR").brokerTimezone("Europe/Bucharest").build();
        intervalTrades = List.of(
                trade("2026-07-13T13:54:29Z", "-430.52", TradeSource.TRADING212_CSV),
                trade("2026-07-16T17:36:49Z", "524.53", TradeSource.MANUAL));
        service = new TradeDataManagementService(currentUserService, accountRepository, tradeRepository,
                notebookNoteRepository, new TimezoneService(), eventPublisher);
        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(accountRepository.findByIdAndUserId(account.getId(), user.getId())).thenReturn(Optional.of(account));
        lenient().when(notebookNoteRepository.countByUserIdAndRelatedTrade_IdInAndIsDeletedFalse(
                eq(user.getId()), anyList())).thenReturn(1L);
    }

    @Test
    void previewsAndDeletesAnInclusiveBucharestDateRangeWithoutDeletingTheAccount() {
        when(tradeRepository
                .findByUserIdAndAccountIdAndClosedAtGreaterThanEqualAndClosedAtLessThanOrderByClosedAtAsc(
                        eq(user.getId()), eq(account.getId()), any(), any()))
                .thenReturn(intervalTrades);
        TradeDataDeletionRequest request = rangeRequest(false, null);

        var preview = service.preview(request);

        assertThat(preview.tradeCount()).isEqualTo(2);
        assertThat(preview.realizedPnl()).isEqualByComparingTo("94.01");
        assertThat(preview.linkedJournalRecords()).isEqualTo(1);
        assertThat(preview.sourceDistribution()).containsEntry(TradeSource.TRADING212_CSV, 1L)
                .containsEntry(TradeSource.MANUAL, 1L);
        verify(tradeRepository).findByUserIdAndAccountIdAndClosedAtGreaterThanEqualAndClosedAtLessThanOrderByClosedAtAsc(
                user.getId(), account.getId(),
                OffsetDateTime.of(2026, 7, 13, 0, 0, 0, 0, ZoneOffset.ofHours(3)),
                OffsetDateTime.of(2026, 7, 17, 0, 0, 0, 0, ZoneOffset.ofHours(3)));

        var deleted = service.delete(rangeRequest(true, preview.previewToken()));

        assertThat(deleted.deletedTrades()).isEqualTo(2);
        assertThat(deleted.deletedRealizedPnl()).isEqualByComparingTo("94.01");
        verify(tradeRepository).deleteAll(intervalTrades);
        verify(tradeRepository).flush();
        verify(accountRepository, never()).delete(any());
        verify(eventPublisher, times(2)).publishEvent(any(LiveTradeEvidenceChangedEvent.class));
    }

    @Test
    void entireHistoryRequiresExactAccountNameAndAFreshPreview() {
        when(tradeRepository.findByUserIdAndAccountIdOrderByOpenedAtAsc(user.getId(), account.getId()))
                .thenReturn(intervalTrades);
        TradeDataDeletionRequest previewRequest = new TradeDataDeletionRequest(
                account.getId(), TradeDataDeletionRequest.Scope.ENTIRE_HISTORY,
                null, null, "Europe/Bucharest", false, null, null);
        var preview = service.preview(previewRequest);

        assertThatThrownBy(() -> service.delete(new TradeDataDeletionRequest(
                account.getId(), TradeDataDeletionRequest.Scope.ENTIRE_HISTORY,
                null, null, "Europe/Bucharest", true, "wrong", preview.previewToken())))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("account name exactly");
        assertThatThrownBy(() -> service.delete(new TradeDataDeletionRequest(
                account.getId(), TradeDataDeletionRequest.Scope.ENTIRE_HISTORY,
                null, null, "Europe/Bucharest", true, account.getName(), "stale")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("preview is stale");
    }

    @Test
    void rejectsAnotherUsersAccountAndInvalidRanges() {
        UUID inaccessible = UUID.randomUUID();
        when(accountRepository.findByIdAndUserId(inaccessible, user.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.preview(new TradeDataDeletionRequest(
                inaccessible, TradeDataDeletionRequest.Scope.ENTIRE_HISTORY,
                null, null, null, false, null, null)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("not found");
        assertThatThrownBy(() -> service.preview(new TradeDataDeletionRequest(
                account.getId(), TradeDataDeletionRequest.Scope.DATE_RANGE,
                LocalDate.of(2026, 7, 17), LocalDate.of(2026, 7, 13),
                "Europe/Bucharest", false, null, null)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("End date");
    }

    private TradeDataDeletionRequest rangeRequest(boolean confirmed, String token) {
        return new TradeDataDeletionRequest(account.getId(), TradeDataDeletionRequest.Scope.DATE_RANGE,
                LocalDate.of(2026, 7, 13), LocalDate.of(2026, 7, 16),
                "Europe/Bucharest", confirmed, null, token);
    }

    private Trade trade(String closedAt, String pnl, TradeSource source) {
        return Trade.builder().id(UUID.randomUUID()).user(user).account(account).source(source)
                .symbol("GER40").market(Market.CFD).status(TradeStatus.CLOSED)
                .openedAt(OffsetDateTime.parse(closedAt).minusHours(1))
                .closedAt(OffsetDateTime.parse(closedAt)).pnlNet(new BigDecimal(pnl)).build();
    }
}
