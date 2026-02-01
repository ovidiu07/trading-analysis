package com.tradevault.service;

import com.tradevault.domain.enums.TradeStatus;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

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

        var stopLimitBuy = TradeCsvImportService.classifyAction("  Stop limit buy ");
        assertTrue(stopLimitBuy.isBuy());
        assertFalse(stopLimitBuy.isSell());

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
}
