package com.tradevault.service;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.TradeImportRow;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.repository.TradeImportRowRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.security.AuthenticatedUserResolver;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.mock.web.MockMultipartFile;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TradeCsvImportServiceTest {

    @Test
    void weightedAverageUsesShareWeights() {
        OffsetDateTime time = OffsetDateTime.parse("2024-01-01T10:00:00Z");
        List<TradeCsvImportService.ParsedRow> rows = List.of(
                new TradeCsvImportService.ParsedRow("Market buy", "market buy", true, false, time, "ISIN1", "AAA", "tx1",
                        new BigDecimal("10"), new BigDecimal("100"), null),
                new TradeCsvImportService.ParsedRow("Market buy", "market buy", true, false, time.plusMinutes(1), "ISIN1", "AAA", "tx2",
                        new BigDecimal("20"), new BigDecimal("110"), null)
        );

        BigDecimal weighted = TradeCsvImportService.weightedAverage(rows);

        assertEquals(new BigDecimal("106.6666666667"), weighted);
    }

    @Test
    void classifiesBuySellActionsBySuffix() {
        var marketBuy = TradeCsvImportService.classifyAction("Market buy");
        assertTrue(marketBuy.isBuy());
        assertFalse(marketBuy.isSell());

        var stopBuy = TradeCsvImportService.classifyAction("Stop buy");
        assertTrue(stopBuy.isBuy());
        assertFalse(stopBuy.isSell());

        var limitBuy = TradeCsvImportService.classifyAction("Limit buy");
        assertTrue(limitBuy.isBuy());
        assertFalse(limitBuy.isSell());

        var stopLimitBuy = TradeCsvImportService.classifyAction("  Stop limit buy ");
        assertTrue(stopLimitBuy.isBuy());
        assertFalse(stopLimitBuy.isSell());

        var marketSell = TradeCsvImportService.classifyAction("Market sell");
        assertTrue(marketSell.isSell());
        assertFalse(marketSell.isBuy());

        var stopSell = TradeCsvImportService.classifyAction("Stop sell");
        assertTrue(stopSell.isSell());
        assertFalse(stopSell.isBuy());

        var limitSell = TradeCsvImportService.classifyAction("LIMIT SELL");
        assertTrue(limitSell.isSell());
        assertFalse(limitSell.isBuy());
    }

    @Test
    void computeGroupClosesWhenSellSharesMatch() {
        OffsetDateTime buyTime = OffsetDateTime.parse("2024-01-01T10:00:00Z");
        OffsetDateTime sellTime = OffsetDateTime.parse("2024-01-02T10:00:00Z");
        List<TradeCsvImportService.ParsedRow> rows = List.of(
                new TradeCsvImportService.ParsedRow("Stop buy", "stop buy", true, false, buyTime, "ISIN1", "AAA", "tx1",
                        new BigDecimal("10"), new BigDecimal("100"), null),
                new TradeCsvImportService.ParsedRow("Limit sell", "limit sell", false, true, sellTime, "ISIN1", "AAA", "tx2",
                        new BigDecimal("10"), new BigDecimal("110"), new BigDecimal("100"))
        );

        TradeCsvImportService.GroupComputation computation = TradeCsvImportService.computeGroup(rows);

        assertFalse(computation.skipped());
        TradeCsvImportService.GroupMetrics metrics = computation.metrics();
        assertNotNull(metrics);
        assertEquals(TradeStatus.CLOSED, metrics.status());
        assertEquals(sellTime, metrics.closedAt());
        assertEquals(new BigDecimal("110.0000000000"), metrics.exitPrice());
        assertEquals(new BigDecimal("100"), metrics.pnlGross());
    }

    @Test
    void computeGroupKeepsOpenOnPartialSell() {
        OffsetDateTime buyTime = OffsetDateTime.parse("2024-01-01T10:00:00Z");
        OffsetDateTime sellTime = OffsetDateTime.parse("2024-01-02T10:00:00Z");
        List<TradeCsvImportService.ParsedRow> rows = List.of(
                new TradeCsvImportService.ParsedRow("Limit buy", "limit buy", true, false, buyTime, "ISIN1", "AAA", "tx1",
                        new BigDecimal("10"), new BigDecimal("100"), null),
                new TradeCsvImportService.ParsedRow("Stop sell", "stop sell", false, true, sellTime, "ISIN1", "AAA", "tx2",
                        new BigDecimal("5"), new BigDecimal("110"), new BigDecimal("50"))
        );

        TradeCsvImportService.GroupComputation computation = TradeCsvImportService.computeGroup(rows);

        assertFalse(computation.skipped());
        TradeCsvImportService.GroupMetrics metrics = computation.metrics();
        assertNotNull(metrics);
        assertEquals(TradeStatus.OPEN, metrics.status());
        assertNull(metrics.closedAt());
    }

    @Test
    void computeGroupSkipsWhenSellSharesExceedBuyShares() {
        OffsetDateTime buyTime = OffsetDateTime.parse("2024-01-01T10:00:00Z");
        OffsetDateTime sellTime = OffsetDateTime.parse("2024-01-02T10:00:00Z");
        List<TradeCsvImportService.ParsedRow> rows = List.of(
                new TradeCsvImportService.ParsedRow("Market buy", "market buy", true, false, buyTime, "ISIN1", "AAA", "tx1",
                        new BigDecimal("10"), new BigDecimal("100"), null),
                new TradeCsvImportService.ParsedRow("Market sell", "market sell", false, true, sellTime, "ISIN1", "AAA", "tx2",
                        new BigDecimal("12"), new BigDecimal("110"), new BigDecimal("120"))
        );

        TradeCsvImportService.GroupComputation computation = TradeCsvImportService.computeGroup(rows);

        assertTrue(computation.skipped());
    }

    @Test
    void importCsvUsesAllRowsForComputationEvenWhenTransactionAlreadyImported() throws Exception {
        TradeRepository tradeRepository = Mockito.mock(TradeRepository.class);
        TradeImportRowRepository tradeImportRowRepository = Mockito.mock(TradeImportRowRepository.class);
        AuthenticatedUserResolver authenticatedUserResolver = Mockito.mock(AuthenticatedUserResolver.class);

        User user = User.builder().id(UUID.randomUUID()).email("user@example.com").build();
        when(authenticatedUserResolver.getCurrentUser()).thenReturn(user);

        TradeImportRow existing = TradeImportRow.builder()
                .id(UUID.randomUUID())
                .user(user)
                .transactionId("buy-tx")
                .importedAt(OffsetDateTime.parse("2024-01-01T12:00:00Z"))
                .build();
        when(tradeImportRowRepository.findAllByUserIdAndTransactionIdIn(eq(user.getId()), any()))
                .thenReturn(List.of(existing));
        when(tradeRepository.save(any(Trade.class))).thenAnswer(invocation -> invocation.getArgument(0, Trade.class));

        TradeCsvImportService service = new TradeCsvImportService(tradeRepository, tradeImportRowRepository, authenticatedUserResolver);

        String csv = String.join("\n",
                "Action,Time,ISIN,Ticker,Name,ID,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result,Currency (Result),Total,Currency (Total)",
                "Market buy,2024-01-01 10:00:00,ISIN1,AAA,Name,buy-tx,10,100,USD,1,,USD,1000,USD",
                "Stop sell,2024-01-02 10:00:00,ISIN1,AAA,Name,sell-tx,10,110,USD,1,100,USD,1100,USD"
        );
        MockMultipartFile file = new MockMultipartFile("file", "trades.csv", "text/csv", csv.getBytes());

        service.importCsv(file);

        ArgumentCaptor<Trade> tradeCaptor = ArgumentCaptor.forClass(Trade.class);
        verify(tradeRepository).save(tradeCaptor.capture());
        Trade saved = tradeCaptor.getValue();
        assertEquals(TradeStatus.CLOSED, saved.getStatus());

        ArgumentCaptor<List<TradeImportRow>> importCaptor = ArgumentCaptor.forClass(List.class);
        verify(tradeImportRowRepository).saveAll(importCaptor.capture());
        List<TradeImportRow> savedRows = importCaptor.getValue();
        assertEquals(1, savedRows.size());
        assertEquals("sell-tx", savedRows.get(0).getTransactionId());
    }
}
