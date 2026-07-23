package com.tradevault.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.*;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeImportStatus;
import com.tradevault.domain.enums.TradeSource;
import com.tradevault.dto.tradeimport.Mt5ImportCommitRequest;
import com.tradevault.repository.*;
import com.tradevault.service.mt5.Mt5HtmlParser;
import com.tradevault.service.mt5.Mt5ParsedReport;
import com.tradevault.service.mt5.Mt5TradeReconstructor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.ZoneId;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class Mt5TradeImportServiceTest {
    @Mock CurrentUserService currentUserService;
    @Mock TradeImportBatchRepository batchRepository;
    @Mock InstrumentAliasRepository aliasRepository;
    @Mock AccountRepository accountRepository;
    @Mock TradeRepository tradeRepository;
    @Mock ImportedTradeExecutionRepository executionRepository;
    @Mock ImportedTradeOrderRepository orderRepository;

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    private Mt5TradeImportService service;
    private User user;
    private Account account;
    private TradeImportBatch batch;
    private Mt5ParsedReport report;
    private InstrumentAlias mapping;

    @BeforeEach
    void setUp() throws Exception {
        Mt5HtmlParser parser = new Mt5HtmlParser();
        report = parser.parse(fixture());
        service = new Mt5TradeImportService(currentUserService, parser, new Mt5TradeReconstructor(), objectMapper,
                batchRepository, aliasRepository, accountRepository, tradeRepository, executionRepository, orderRepository);
        user = User.builder().id(UUID.randomUUID()).email("trader@example.test").build();
        account = Account.builder().id(UUID.randomUUID()).user(user).name("Main").build();
        batch = TradeImportBatch.builder().id(UUID.randomUUID()).user(user).source(TradeSource.MT5_HTML)
                .status(TradeImportStatus.PREVIEW).parsedPayload(objectMapper.valueToTree(report)).build();
        mapping = InstrumentAlias.builder().id(UUID.randomUUID()).user(user).broker("TRDX (Pty) Ltd")
                .brokerServer("TRDX-Server").externalSymbol("GECEUR").internalSymbol("GER40")
                .market(Market.CFD).tradeCurrency("EUR").contractMultiplier(BigDecimal.ONE).active(true).build();
        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(batchRepository.findByIdAndUserId(batch.getId(), user.getId())).thenReturn(Optional.of(batch));
        when(accountRepository.findByIdAndUserId(account.getId(), user.getId())).thenReturn(Optional.of(account));
        when(aliasRepository.findMappings(user.getId(), "TRDX (Pty) Ltd", "TRDX-Server", "GECEUR")).thenReturn(List.of(mapping));
        when(batchRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(tradeRepository.save(any())).thenAnswer(invocation -> {
            Trade trade = invocation.getArgument(0);
            if (trade.getId() == null) trade.setId(UUID.randomUUID());
            return trade;
        });
        when(executionRepository.findByUserIdAndSourceAndBrokerServerIgnoreCaseAndExternalAccountIdAndExternalDealId(any(), any(), anyString(), anyString(), anyString())).thenReturn(Optional.empty());
        when(orderRepository.findByUserIdAndSourceAndBrokerServerIgnoreCaseAndExternalAccountIdAndExternalOrderId(any(), any(), anyString(), anyString(), anyString())).thenReturn(Optional.empty());
        when(accountRepository.findByUserIdAndExternalAccountIdAndBrokerServerIgnoreCase(any(), anyString(), anyString())).thenReturn(List.of());
    }

    @Test
    void commitsFourTradesAndPreservesAllDealsAndOrdersForAudit() {
        when(tradeRepository.findByUserIdAndSourceAndSourceBrokerServerIgnoreCaseAndExternalAccountIdAndExternalPositionId(
                eq(user.getId()), eq(TradeSource.MT5_HTML), eq("TRDX-Server"), eq("7785088"), anyString())).thenReturn(Optional.empty());

        var result = service.commit(batch.getId(), request());

        assertThat(result.created()).isEqualTo(4);
        assertThat(result.updated()).isZero();
        assertThat(result.netPnl()).isEqualByComparingTo("-222.71");
        assertThat(account.getExternalAccountId()).isEqualTo("7785088");
        assertThat(account.getBrokerServer()).isEqualTo("TRDX-Server");
        assertThat(account.getBrokerTimezone()).isEqualTo("UTC");
        assertThat(account.getAccountCurrency()).isEqualTo("USD");
        verify(tradeRepository, times(4)).save(any(Trade.class));
        verify(executionRepository, times(9)).save(any(ImportedTradeExecution.class));
        verify(orderRepository, times(9)).save(any(ImportedTradeOrder.class));
        verify(executionRepository, times(9))
                .findByUserIdAndSourceAndBrokerServerIgnoreCaseAndExternalAccountIdAndExternalDealId(
                        eq(user.getId()), eq(TradeSource.MT5_HTML), eq("TRDX-Server"), eq("7785088"), anyString());
        verify(orderRepository, times(9))
                .findByUserIdAndSourceAndBrokerServerIgnoreCaseAndExternalAccountIdAndExternalOrderId(
                        eq(user.getId()), eq(TradeSource.MT5_HTML), eq("TRDX-Server"), eq("7785088"), anyString());
        verify(tradeRepository, times(4)).save(argThat(trade ->
                trade.getAccount() == account
                        && trade.getUser() == user
                        && "7785088".equals(trade.getExternalAccountId())
                        && "7785088".equals(trade.getBrokerAccountId())));
        verify(executionRepository, times(9)).save(argThat(execution -> execution.getUser() == user));
        verify(orderRepository, times(9)).save(argThat(order -> order.getUser() == user));
    }

    @Test
    void reimportUpdatesExternalTradesWithoutOverwritingJournalFields() {
        Map<String, Trade> existing = new HashMap<>();
        report.positions().forEach(position -> existing.put(position.externalPositionId(), Trade.builder()
                .id(UUID.randomUUID()).user(user).source(TradeSource.MT5_HTML).externalPositionId(position.externalPositionId())
                .notes("My journal note").setup("A setup").strategyTag("My strategy").build()));
        when(tradeRepository.findByUserIdAndSourceAndSourceBrokerServerIgnoreCaseAndExternalAccountIdAndExternalPositionId(
                eq(user.getId()), eq(TradeSource.MT5_HTML), eq("TRDX-Server"), eq("7785088"), anyString()))
                .thenAnswer(invocation -> Optional.of(existing.get(invocation.getArgument(4))));
        when(executionRepository.findByUserIdAndSourceAndBrokerServerIgnoreCaseAndExternalAccountIdAndExternalDealId(
                any(), any(), anyString(), anyString(), anyString())).thenAnswer(invocation -> Optional.of(
                ImportedTradeExecution.builder().id(UUID.randomUUID()).externalDealId(invocation.getArgument(4)).build()));
        when(orderRepository.findByUserIdAndSourceAndBrokerServerIgnoreCaseAndExternalAccountIdAndExternalOrderId(
                any(), any(), anyString(), anyString(), anyString())).thenAnswer(invocation -> Optional.of(
                ImportedTradeOrder.builder().id(UUID.randomUUID()).externalOrderId(invocation.getArgument(4)).build()));

        var result = service.commit(batch.getId(), request());

        assertThat(result.created()).isZero();
        assertThat(result.updated()).isEqualTo(4);
        assertThat(result.duplicatesSkipped()).isEqualTo(4);
        assertThat(existing.values()).allSatisfy(trade -> {
            assertThat(trade.getNotes()).isEqualTo("My journal note");
            assertThat(trade.getSetup()).isEqualTo("A setup");
            assertThat(trade.getStrategyTag()).isEqualTo("My strategy");
        });
        verify(executionRepository, times(9)).save(argThat(execution -> execution.getId() != null));
        verify(orderRepository, times(9)).save(argThat(order -> order.getId() != null));
    }

    @Test
    void rejectsWrongFileExtensionsBeforeParsing() {
        MockMultipartFile file = new MockMultipartFile("file", "report.txt", "text/plain", "<html></html>".getBytes());

        assertThatThrownBy(() -> service.preview(file, null, null))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Only .html and .htm");
    }

    @Test
    void rejectsOversizedAndNonHtmlUploads() {
        MockMultipartFile oversized = new MockMultipartFile("file", "report.html", "text/html", new byte[10 * 1024 * 1024 + 1]);
        MockMultipartFile invalid = new MockMultipartFile("file", "report.html", "text/html", "not a report".getBytes());

        assertThatThrownBy(() -> service.preview(oversized, null, null))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("10 MB");
        assertThatThrownBy(() -> service.preview(invalid, null, null))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("not recognizable HTML");
    }

    @Test
    void acceptsUtf16HtmlAndLetsTheParserValidateItsDecodedContent() throws Exception {
        byte[] utf8 = fixture();
        byte[] encoded = new String(utf8, StandardCharsets.UTF_8).getBytes(StandardCharsets.UTF_16LE);
        byte[] utf16 = new byte[encoded.length + 2];
        utf16[0] = (byte) 0xFF;
        utf16[1] = (byte) 0xFE;
        System.arraycopy(encoded, 0, utf16, 2, encoded.length);

        var preview = service.preview(new MockMultipartFile("file", "report.html", "text/html", utf16), account.getId(), "UTC");

        assertThat(preview.summary().positionsFound()).isEqualTo(4);
        assertThat(preview.summary().netPnl()).isEqualByComparingTo("-222.71");
    }

    @Test
    void suggestsButDoesNotAutomaticallyMergeManualTrades() throws Exception {
        var candidate = new Mt5TradeReconstructor().reconstruct(report, ZoneId.of("UTC")).get(0);
        Trade manual = Trade.builder().id(UUID.randomUUID()).user(user).source(TradeSource.MANUAL)
                .symbol("GER40").direction(candidate.direction()).quantity(candidate.quantity())
                .entryPrice(candidate.entryPrice()).exitPrice(candidate.exitPrice())
                .openedAt(candidate.openedAt()).closedAt(candidate.closedAt()).notes("Keep me separate").build();
        when(tradeRepository.findByUserId(user.getId())).thenReturn(List.of(manual));

        var preview = service.preview(new MockMultipartFile("file", "report.html", "text/html", fixture()), account.getId(), "UTC");

        assertThat(preview.trades().get(0).potentialManualMatches()).extracting("tradeId").containsExactly(manual.getId());
        verify(tradeRepository, never()).save(any());
    }

    @Test
    void rejectsAccountsNotOwnedByTheCurrentUser() {
        when(accountRepository.findByIdAndUserId(account.getId(), user.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.commit(batch.getId(), request()))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("Target account not found");
        verify(tradeRepository, never()).save(any());
    }

    @Test
    void previewReusesTheUniqueOwnedExternalAccountMappingAndItsTimezone() throws Exception {
        account.setExternalAccountId("7785088");
        account.setBrokerServer("TRDX-Server");
        account.setBrokerTimezone("Europe/London");
        when(accountRepository.findFirstByUserIdAndExternalAccountIdAndBrokerServerIgnoreCase(
                user.getId(), "7785088", "TRDX-Server")).thenReturn(Optional.of(account));

        var preview = service.preview(new MockMultipartFile("file", "report.html", "text/html", fixture()), null, null);

        assertThat(preview.targetAccountId()).isEqualTo(account.getId());
        assertThat(preview.sourceTimezone()).isEqualTo("Europe/London");
    }

    @Test
    void refusesToCreateAnAmbiguousExternalAccountMapping() {
        Account other = Account.builder().id(UUID.randomUUID()).user(user).name("Other").build();
        when(accountRepository.findByUserIdAndExternalAccountIdAndBrokerServerIgnoreCase(
                user.getId(), "7785088", "TRDX-Server")).thenReturn(List.of(other));

        assertThatThrownBy(() -> service.commit(batch.getId(), request()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already mapped to another TradeJAudit account");
    }

    @Test
    void persistenceFailurePreventsBatchFinalizationSoTheTransactionCanRollBack() {
        when(tradeRepository.findByUserIdAndSourceAndSourceBrokerServerIgnoreCaseAndExternalAccountIdAndExternalPositionId(
                eq(user.getId()), eq(TradeSource.MT5_HTML), eq("TRDX-Server"), eq("7785088"), anyString())).thenReturn(Optional.empty());
        doThrow(new IllegalStateException("write failed")).when(tradeRepository).save(any());

        assertThatThrownBy(() -> service.commit(batch.getId(), request()))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("write failed");
        verify(batchRepository, never()).save(any());
        assertThat(batch.getStatus()).isEqualTo(TradeImportStatus.PREVIEW);
    }

    @Test
    void blocksCommitWhenMandatorySymbolMappingIsUnresolvedWithoutWritingTrades() {
        when(aliasRepository.findMappings(user.getId(), "TRDX (Pty) Ltd", "TRDX-Server", "GECEUR")).thenReturn(List.of());

        assertThatThrownBy(() -> service.commit(batch.getId(), request()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Resolve symbol mapping for GECEUR");
        verify(tradeRepository, never()).save(any());
    }

    private Mt5ImportCommitRequest request() {
        return new Mt5ImportCommitRequest(account.getId(), "UTC", report.positions().stream().map(Mt5ParsedReport.Position::externalPositionId).toList(),
                List.of(), Map.of(), true);
    }

    private static byte[] fixture() throws Exception {
        try (InputStream input = Mt5TradeImportServiceTest.class.getResourceAsStream("/fixtures/mt5/mt5-trade-history-report.html")) {
            if (input == null) throw new IllegalStateException("Fixture missing");
            return input.readAllBytes();
        }
    }
}
