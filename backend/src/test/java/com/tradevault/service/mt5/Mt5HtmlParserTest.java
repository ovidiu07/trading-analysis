package com.tradevault.service.mt5;

import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class Mt5HtmlParserTest {
    private final Mt5HtmlParser parser = new Mt5HtmlParser();
    private final Mt5TradeReconstructor reconstructor = new Mt5TradeReconstructor();

    @Test
    void parsesProvidedReportShapeAndExcludesAccountTransactions() throws Exception {
        Mt5ParsedReport report = parser.parse(fixture());

        assertThat(report.metadata().externalAccountId()).isEqualTo("7785088");
        assertThat(report.metadata().currency()).isEqualTo("USD");
        assertThat(report.metadata().brokerServer()).isEqualTo("TRDX-Server");
        assertThat(report.metadata().company()).isEqualTo("TRDX (Pty) Ltd");
        assertThat(report.metadata().accountingMode()).isEqualTo("Netting");
        assertThat(report.positions()).hasSize(4);
        assertThat(report.orders()).hasSize(9);
        assertThat(report.deals()).hasSize(9);
        assertThat(report.deals().stream().filter(Mt5ParsedReport.Deal::isTradingExecution)).hasSize(8);
        assertThat(report.deals().stream().filter(d -> "balance".equalsIgnoreCase(d.type()))).hasSize(1);
        assertThat(report.positions().get(0).comment()).isEqualTo("Trade #1");
        assertThat(Mt5HtmlParser.decimal("50\u00a0000.00")).isEqualByComparingTo("50000.00");
    }

    @Test
    void toleratesAnUnannouncedOptionalPositionCommentColumn() throws Exception {
        String html = new String(fixture(), java.nio.charset.StandardCharsets.UTF_8)
                .replace("<th>Type</th><th>Comment</th><th>Volume</th>", "<th>Type</th><th>Volume</th>");

        Mt5ParsedReport report = parser.parse(html.getBytes(java.nio.charset.StandardCharsets.UTF_8));

        assertThat(report.positions()).hasSize(4);
        assertThat(report.positions().get(0).comment()).isEqualTo("Trade #1");
        assertThat(report.positions().get(0).volume()).isEqualByComparingTo("7");
    }

    @Test
    void parsesUtf16BrokerExportWithCombinedAccountMetadataAndUnlinkedDeals() {
        String html = """
                <html><body><table>
                <tr><th>Name:</th><th>Example Account</th></tr>
                <tr><th>Account:</th><th>12345678 (USD, Broker-Server, real, Netting)</th></tr>
                <tr><th>Company:</th><th>Example Broker</th></tr>
                <tr><th>Date:</th><th>2026.07.22 17:08</th></tr>
                <tr><th>Positions</th></tr>
                <tr><td>Time</td><td>Position</td><td>Symbol</td><td>Type</td><td>Volume</td><td>Price</td><td>S / L</td><td>T / P</td><td>Time</td><td>Price</td><td>Commission</td><td>Swap</td><td>Profit</td></tr>
                <tr><td>2026.07.20 12:54:38</td><td>670367</td><td>GECEUR</td><td>sell</td><td></td><td>7.92</td><td>24910.95</td><td>24910.00</td><td>24859.00</td><td>2026.07.20 13:17:57</td><td>24863.72</td><td>-23.76</td><td>0.00</td><td>427.61</td></tr>
                <tr><th>Orders</th></tr>
                <tr><td>Open Time</td><td>Order</td><td>Symbol</td><td>Type</td><td>Volume</td><td>Price</td><td>S / L</td><td>T / P</td><td>Time</td><td>State</td><td>Comment</td></tr>
                <tr><td>2026.07.20 12:54:38</td><td>670367</td><td>GECEUR</td><td>sell</td><td>7.92 / 7.92</td><td>market</td><td>24934.00</td><td>24874.00</td><td>2026.07.20 12:54:38</td><td>filled</td><td></td></tr>
                <tr><td>2026.07.20 13:17:57</td><td>670518</td><td>GECEUR</td><td>buy</td><td>7.92 / 7.92</td><td>market</td><td></td><td></td><td>2026.07.20 13:17:57</td><td>filled</td><td></td></tr>
                <tr><th>Deals</th></tr>
                <tr><td>Time</td><td>Deal</td><td>Symbol</td><td>Type</td><td>Direction</td><td>Volume</td><td>Price</td><td>Order</td><td>Cost</td><td>Commission</td><td>Fee</td><td>Swap</td><td>Profit</td><td>Balance</td><td>Comment</td></tr>
                <tr><td>2026.07.20 12:54:38</td><td>644058</td><td>GECEUR</td><td>sell</td><td>in</td><td>7.92</td><td>24910.95</td><td>670367</td><td></td><td>-23.76</td><td>0.00</td><td>0.00</td><td>0.00</td><td>49349.68</td><td></td></tr>
                <tr><td>2026.07.20 13:17:57</td><td>644190</td><td>GECEUR</td><td>buy</td><td>out</td><td>7.92</td><td>24863.72</td><td>670518</td><td></td><td>0.00</td><td>0.00</td><td>0.00</td><td>427.61</td><td>49777.29</td><td></td></tr>
                </table></body></html>
                """;
        byte[] encoded = html.getBytes(StandardCharsets.UTF_16LE);
        byte[] bytes = new byte[encoded.length + 2];
        bytes[0] = (byte) 0xFF;
        bytes[1] = (byte) 0xFE;
        System.arraycopy(encoded, 0, bytes, 2, encoded.length);

        Mt5ParsedReport report = parser.parse(bytes);
        List<Mt5TradeCandidate> trades = reconstructor.reconstruct(report, ZoneId.of("UTC"));

        assertThat(report.metadata().externalAccountId()).isEqualTo("12345678");
        assertThat(report.metadata().currency()).isEqualTo("USD");
        assertThat(report.metadata().brokerServer()).isEqualTo("Broker-Server");
        assertThat(report.metadata().accountType()).isEqualTo("real");
        assertThat(report.metadata().accountingMode()).isEqualTo("Netting");
        assertThat(report.positions()).hasSize(1);
        assertThat(report.positions().get(0).stopLoss()).isEqualByComparingTo("24910.00");
        assertThat(report.positions().get(0).takeProfit()).isEqualByComparingTo("24859.00");
        assertThat(report.orders()).hasSize(2);
        assertThat(report.deals()).hasSize(2);
        assertThat(trades).hasSize(1);
        assertThat(trades.get(0).externalPositionId()).isEqualTo("670367");
        assertThat(trades.get(0).brokerReportedNetPnl()).isEqualByComparingTo("403.85");
    }

    @Test
    void reconstructsFourTradesAndReconcilesBrokerNetPnl() throws Exception {
        List<Mt5TradeCandidate> trades = reconstructor.reconstruct(parser.parse(fixture()), ZoneId.of("UTC"));

        assertThat(trades).hasSize(4);
        assertTrade(trades.get(0), "645906", "7", "25098.93", "25134.45", "-284.19", "21.00", "-305.19");
        assertTrade(trades.get(1), "659613", "7.5", "24866.79", "24851.08", "-135.11", "22.50", "-157.61");
        assertTrade(trades.get(2), "660174", "3.33", "24872.17", "24831.90", "-153.77", "9.99", "-163.76");
        assertTrade(trades.get(3), "670367", "7.92", "24910.95", "24863.72", "427.61", "23.76", "403.85");
        assertThat(trades.get(0).entryOrderType()).isEqualTo("sell stop");
        assertThat(trades.get(0).requestedEntryPrice()).isEqualByComparingTo("25099.70");
        assertThat(trades.get(0).exitReason()).isEqualTo("STOP_LOSS");
        assertThat(trades.get(2).initialStopLossPrice()).isEqualByComparingTo("24833.00");
        assertThat(trades.get(2).finalStopLossPrice()).isEqualByComparingTo("24826.70");
        assertThat(trades.get(3).initialTakeProfitPrice()).isEqualByComparingTo("24874.00");
        assertThat(trades.get(3).finalTakeProfitPrice()).isEqualByComparingTo("24859.00");

        BigDecimal totalGross = trades.stream().map(Mt5TradeCandidate::brokerReportedGrossPnl).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalCommission = trades.stream().map(Mt5TradeCandidate::commission).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalNet = trades.stream().map(Mt5TradeCandidate::brokerReportedNetPnl).reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(totalGross).isEqualByComparingTo("-145.46");
        assertThat(totalCommission).isEqualByComparingTo("77.25");
        assertThat(totalNet).isEqualByComparingTo("-222.71");
    }

    @Test
    void reconstructsDealOnlyReportsAndTreatsPositiveSwapAsIncome() {
        Mt5ParsedReport.Deal entry = new Mt5ParsedReport.Deal("2026.07.20 10:00:00", "d1", "o1", "p1", "EURUSD", "buy", "in",
                new BigDecimal("2"), new BigDecimal("1.10"), BigDecimal.ZERO, new BigDecimal("-1"), BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, null, null, Map.of());
        Mt5ParsedReport.Deal exit = new Mt5ParsedReport.Deal("2026.07.20 11:00:00", "d2", "o2", "p1", "EURUSD", "sell", "out",
                new BigDecimal("2"), new BigDecimal("1.11"), BigDecimal.ZERO, new BigDecimal("-1"), BigDecimal.ZERO,
                new BigDecimal("3"), new BigDecimal("20"), null, null, Map.of());
        Mt5ParsedReport report = new Mt5ParsedReport(new Mt5ParsedReport.Metadata("A", "1", "USD", "S", "B", "real", "Netting", null),
                List.of(), List.of(), List.of(entry, exit), Map.of(), Map.of(), List.of());

        List<Mt5TradeCandidate> trades = reconstructor.reconstruct(report, ZoneId.of("UTC"));

        assertThat(trades).hasSize(1);
        assertThat(trades.get(0).commission()).isEqualByComparingTo("2");
        assertThat(trades.get(0).otherCosts()).isEqualByComparingTo("0");
        assertThat(trades.get(0).brokerReportedNetPnl()).isEqualByComparingTo("21");
    }

    private static void assertTrade(Mt5TradeCandidate trade, String id, String qty, String entry, String exit,
                                    String gross, String commission, String net) {
        assertThat(trade.externalPositionId()).isEqualTo(id);
        assertThat(trade.quantity()).isEqualByComparingTo(qty);
        assertThat(trade.entryPrice()).isEqualByComparingTo(entry);
        assertThat(trade.exitPrice()).isEqualByComparingTo(exit);
        assertThat(trade.brokerReportedGrossPnl()).isEqualByComparingTo(gross);
        assertThat(trade.commission()).isEqualByComparingTo(commission);
        assertThat(trade.brokerReportedNetPnl()).isEqualByComparingTo(net);
    }

    private static byte[] fixture() throws Exception {
        try (InputStream input = Mt5HtmlParserTest.class.getResourceAsStream("/fixtures/mt5/mt5-trade-history-report.html")) {
            if (input == null) throw new IllegalStateException("Fixture missing");
            return input.readAllBytes();
        }
    }
}
