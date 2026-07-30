package com.tradevault.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.InstrumentAlias;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.TradeImportBatch;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeImportStatus;
import com.tradevault.domain.enums.TradeSource;
import com.tradevault.dto.tradeimport.Trading212ImportCommitRequest;
import com.tradevault.repository.AccountRepository;
import com.tradevault.repository.InstrumentAliasRepository;
import com.tradevault.repository.TradeImportBatchRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.service.trading212.Trading212CsvParser;
import com.tradevault.service.trading212.Trading212ExternalIdentity;
import com.tradevault.service.trading212.Trading212ImportLockService;
import com.tradevault.service.trading212.Trading212ParsedReport;
import com.tradevault.service.trading212.Trading212PnlReconciler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class Trading212TradeImportServiceTest {
    @Mock CurrentUserService currentUserService;
    @Mock TradeImportBatchRepository batchRepository;
    @Mock InstrumentAliasRepository aliasRepository;
    @Mock AccountRepository accountRepository;
    @Mock TradeRepository tradeRepository;
    @Mock Trading212ImportLockService importLockService;

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    private final Trading212ExternalIdentity externalIdentity = new Trading212ExternalIdentity();
    private Trading212TradeImportService service;
    private Trading212CsvParser parser;
    private Trading212ParsedReport report;
    private User user;
    private Account account;
    private InstrumentAlias mapping;
    private TradeImportBatch batch;

    @BeforeEach
    void setUp() throws Exception {
        parser = new Trading212CsvParser(new Trading212PnlReconciler());
        report = parser.parse(fixture(), 10_000);
        service = new Trading212TradeImportService(currentUserService, parser, objectMapper, batchRepository,
                aliasRepository, accountRepository, tradeRepository, externalIdentity, importLockService);
        user = User.builder().id(UUID.randomUUID()).email("trader@example.test").baseCurrency("EUR").build();
        account = Account.builder().id(UUID.randomUUID()).user(user).name("Trading 212 EUR")
                .broker("Trading 212").accountCurrency("EUR").build();
        mapping = InstrumentAlias.builder().id(UUID.randomUUID()).user(user).broker("Trading 212").brokerServer("")
                .externalSymbol("GER40").externalInstrumentName("Germany 40").internalSymbol("GER40")
                .market(Market.CFD).tradeCurrency("EUR").contractMultiplier(BigDecimal.ONE).active(true).build();
        batch = batch(report);
        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(accountRepository.findByIdAndUserId(account.getId(), user.getId())).thenReturn(Optional.of(account));
        when(batchRepository.findByIdAndUserId(batch.getId(), user.getId())).thenReturn(Optional.of(batch));
        when(batchRepository.save(any())).thenAnswer(invocation -> {
            TradeImportBatch saved = invocation.getArgument(0);
            if (saved.getId() == null) saved.setId(UUID.randomUUID());
            return saved;
        });
        when(aliasRepository.findMappings(user.getId(), "Trading 212", "", "GER40")).thenReturn(List.of(mapping));
        when(tradeRepository.save(any())).thenAnswer(invocation -> {
            Trade trade = invocation.getArgument(0);
            if (trade.getId() == null) trade.setId(UUID.randomUUID());
            return trade;
        });
        when(tradeRepository.saveAll(any())).thenAnswer(invocation -> {
            List<Trade> trades = invocation.getArgument(0);
            trades.forEach(trade -> {
                if (trade.getId() == null) trade.setId(UUID.randomUUID());
            });
            return trades;
        });
    }

    @Test
    void previewsTheRealFixtureWithAuthoritativeNetPnlAndInformationalSpread() throws Exception {
        var preview = service.preview(new MockMultipartFile("file", "trading212.csv", "text/csv", fixture()),
                account.getId());

        assertThat(preview.summary().positionsFound()).isEqualTo(3);
        assertThat(preview.summary().grossPnl()).isEqualByComparingTo("-147.60");
        assertThat(preview.summary().netPnl()).isEqualByComparingTo("-147.60");
        assertThat(preview.summary().reportedSpread()).isEqualByComparingTo("9.60");
        assertThat(preview.summary().costs()).isEqualByComparingTo("0");
        assertThat(preview.trades()).extracting("direction").containsOnly(com.tradevault.domain.enums.Direction.SHORT);
        assertThat(preview.trades()).extracting("externalPositionId")
                .containsExactly("POS54611997543", "POS54650170715", "POS54650174676");
        assertThat(preview.trades().get(0).rawSource())
                .containsEntry("Instrument", "Germany 40")
                .containsEntry("Position ID", "POS54611997543");
    }

    @Test
    void commitsThreeTradesWithoutFabricatingCostsOrJournalData() {
        when(tradeRepository.findByUserIdAndAccountIdAndSourceAndExternalTradeIdIn(
                eq(user.getId()), eq(account.getId()), eq(TradeSource.TRADING212_CSV), anyCollection()))
                .thenReturn(List.of());

        var result = service.commit(batch.getId(), request());

        assertThat(result.created()).isEqualTo(3);
        assertThat(result.updated()).isZero();
        assertThat(result.duplicatesSkipped()).isZero();
        assertThat(result.grossPnl()).isEqualByComparingTo("-147.60");
        assertThat(result.netPnl()).isEqualByComparingTo("-147.60");
        assertThat(result.costs()).isEqualByComparingTo("0");
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Iterable<Trade>> captor = ArgumentCaptor.forClass(Iterable.class);
        verify(tradeRepository).saveAll(captor.capture());
        List<Trade> saved = java.util.stream.StreamSupport.stream(
                captor.getValue().spliterator(), false).toList();
        assertThat(saved).allSatisfy(trade -> {
            assertThat(trade.getSource()).isEqualTo(TradeSource.TRADING212_CSV);
            assertThat(trade.getMarket()).isEqualTo(Market.CFD);
            assertThat(trade.getStopLossPrice()).isNull();
            assertThat(trade.getTakeProfitPrice()).isNull();
            assertThat(trade.getCommission()).isNull();
            assertThat(trade.getFees()).isNull();
            assertThat(trade.getSlippage()).isNull();
            assertThat(trade.getBrokerReportedSpread()).isNotNull();
            assertThat(trade.getPnlNet()).isEqualByComparingTo(trade.getBrokerReportedNetPnl());
            assertThat(trade.getNotes()).isNull();
            assertThat(trade.getRiskAmount()).isNull();
        });
    }

    @Test
    void secondImportSkipsUnchangedPositionsWithoutRewritingTrades() {
        when(tradeRepository.findByUserIdAndAccountIdAndSourceAndExternalTradeIdIn(
                eq(user.getId()), eq(account.getId()), eq(TradeSource.TRADING212_CSV), anyCollection()))
                .thenReturn(List.of());
        service.commit(batch.getId(), request());
        List<Trade> imported = mockingDetails(tradeRepository).getInvocations().stream()
                .filter(invocation -> invocation.getMethod().getName().equals("saveAll"))
                .flatMap(invocation -> ((List<Trade>) invocation.getArgument(0)).stream()).toList();
        clearInvocations(tradeRepository, batchRepository);

        TradeImportBatch secondBatch = batch(report);
        when(batchRepository.findByIdAndUserId(secondBatch.getId(), user.getId())).thenReturn(Optional.of(secondBatch));
        when(tradeRepository.findByUserIdAndAccountIdAndSourceAndExternalTradeIdIn(
                eq(user.getId()), eq(account.getId()), eq(TradeSource.TRADING212_CSV), anyCollection()))
                .thenReturn(imported);

        var result = service.commit(secondBatch.getId(), request());

        assertThat(result.created()).isZero();
        assertThat(result.updated()).isZero();
        assertThat(result.duplicatesSkipped()).isEqualTo(3);
        verify(tradeRepository, never()).saveAll(any());
    }

    @Test
    void explicitEmptySelectionImportsNothing() {
        var result = service.commit(batch.getId(), new Trading212ImportCommitRequest(
                account.getId(), List.of(), List.of(), List.of(), Map.of()));

        assertThat(result.created()).isZero();
        assertThat(result.updated()).isZero();
        assertThat(result.excluded()).isEqualTo(3);
        verify(tradeRepository, never()).saveAll(any());
    }

    @Test
    void reimportNeverOverwritesExistingBrokerOrJournalFields() throws Exception {
        Trade existing = Trade.builder().id(UUID.randomUUID()).user(user).account(account)
                .source(TradeSource.TRADING212_CSV).externalPositionId("POS54611997543")
                .externalOrderId("54650150042").externalInstrumentName("Germany 40").externalSymbol("GER40")
                .symbol("GER40").market(Market.CFD).direction(com.tradevault.domain.enums.Direction.SHORT)
                .status(com.tradevault.domain.enums.TradeStatus.CLOSED)
                .openedAt(report.closedPositions().get(0).openedAt()).closedAt(report.closedPositions().get(0).closedAt())
                .quantity(new BigDecimal("4")).entryPrice(new BigDecimal("24966.9")).exitPrice(new BigDecimal("25002.1"))
                .brokerReportedGrossPnl(new BigDecimal("-140.8")).brokerReportedNetPnl(new BigDecimal("-140.8"))
                .sourceExchangeRate(BigDecimal.ONE).brokerReportedSpread(new BigDecimal("4.2"))
                .fxFee(BigDecimal.ZERO).overnightInterest(BigDecimal.ZERO).dividendAdjustment(BigDecimal.ZERO)
                .profileCurrency("EUR").pnlProfileCurrency(new BigDecimal("-140.8"))
                .notes("My journal").setup("Breakout").stopLossPrice(new BigDecimal("25020"))
                .riskAmount(new BigDecimal("80")).build();
        existing.setExternalTradeId("54650150042");
        when(tradeRepository.findByUserIdAndAccountIdAndSourceAndExternalTradeIdIn(
                eq(user.getId()), eq(account.getId()), eq(TradeSource.TRADING212_CSV), anyCollection()))
                .thenReturn(List.of(existing));

        String correctedCsv = new String(fixture(), java.nio.charset.StandardCharsets.UTF_8)
                .replace("0.00,0.00,-140.80\n", "0.00,0.00,-141.80\n");
        Trading212ParsedReport corrected = parser.parse(correctedCsv.getBytes(java.nio.charset.StandardCharsets.UTF_8), 10_000);
        TradeImportBatch correctedBatch = batch(corrected);
        when(batchRepository.findByIdAndUserId(correctedBatch.getId(), user.getId())).thenReturn(Optional.of(correctedBatch));

        var result = service.commit(correctedBatch.getId(), new Trading212ImportCommitRequest(account.getId(),
                List.of(), List.of("54650150042"), List.of(), Map.of()));

        assertThat(result.updated()).isZero();
        assertThat(result.duplicatesSkipped()).isEqualTo(1);
        assertThat(existing.getBrokerReportedNetPnl()).isEqualByComparingTo("-140.80");
        assertThat(existing.getPnlProfileCurrency()).isEqualByComparingTo("-140.80");
        assertThat(existing.getNotes()).isEqualTo("My journal");
        assertThat(existing.getSetup()).isEqualTo("Breakout");
        assertThat(existing.getStopLossPrice()).isEqualByComparingTo("25020");
        assertThat(existing.getRiskAmount()).isEqualByComparingTo("80");
    }

    @Test
    void suggestsButNeverAutomaticallyLinksAnAccountScopedManualTrade() throws Exception {
        var position = report.closedPositions().get(0);
        Trade manual = Trade.builder().id(UUID.randomUUID()).user(user).account(account).source(TradeSource.MANUAL)
                .symbol("GER40").direction(position.direction()).quantity(position.units())
                .entryPrice(position.averagePrice()).exitPrice(position.closePrice())
                .openedAt(position.openedAt()).closedAt(position.closedAt()).notes("Keep this").build();
        when(tradeRepository.findByUserId(user.getId())).thenReturn(List.of(manual));

        var preview = service.preview(new MockMultipartFile("file", "report.csv", "text/csv", fixture()), account.getId());

        assertThat(preview.trades().get(0).potentialManualMatches()).extracting("tradeId").containsExactly(manual.getId());
        verify(tradeRepository, never()).save(any());
    }

    @Test
    void rejectsUnownedAccountsAndNonCsvUploads() {
        when(accountRepository.findByIdAndUserId(account.getId(), user.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.commit(batch.getId(), request()))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("Target account not found");
        assertThatThrownBy(() -> service.preview(
                new MockMultipartFile("file", "report.txt", "text/plain", fixture()), null))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("Only .csv");
    }

    private Trading212ImportCommitRequest request() {
        return new Trading212ImportCommitRequest(account.getId(),
                List.of(),
                report.closedPositions().stream()
                        .map(position -> externalIdentity.resolve(account.getId(), position)).toList(),
                List.of(), Map.of());
    }

    private TradeImportBatch batch(Trading212ParsedReport parsed) {
        return TradeImportBatch.builder().id(UUID.randomUUID()).user(user).source(TradeSource.TRADING212_CSV)
                .status(TradeImportStatus.PREVIEW).accountCurrency("EUR").broker("Trading 212")
                .parsedPayload(objectMapper.valueToTree(parsed)).build();
    }

    private static byte[] fixture() throws Exception {
        try (InputStream input = Trading212TradeImportServiceTest.class.getResourceAsStream(
                "/fixtures/trading212/from_2026-07-24_to_2026-07-24.csv")) {
            if (input == null) throw new IllegalStateException("Fixture missing");
            return input.readAllBytes();
        }
    }
}
