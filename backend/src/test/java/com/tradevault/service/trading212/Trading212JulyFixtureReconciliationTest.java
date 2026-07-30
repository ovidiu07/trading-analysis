package com.tradevault.service.trading212;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfSystemProperty(named = "trading212.fixture", matches = ".+")
class Trading212JulyFixtureReconciliationTest {
    private final Trading212CsvParser parser = new Trading212CsvParser(new Trading212PnlReconciler());

    @Test
    void reconcilesTheAuthoritativeJulyFixtureExactly() throws Exception {
        Path fixture = Path.of(System.getProperty("trading212.fixture"));
        assertThat(Files.isRegularFile(fixture)).isTrue();
        Trading212ParsedReport report = parser.parse(Files.readAllBytes(fixture), 10_000);

        assertThat(report.rows()).hasSize(109);
        assertThat(report.closedPositions()).hasSize(109);
        assertThat(report.closedPositions()).extracting(Trading212ClosedPosition::recordType)
                .containsOnly("Closed position");
        assertThat(report.closedPositions()).extracting(Trading212ClosedPosition::accountCurrency)
                .containsOnly("EUR");
        assertThat(report.closedPositions()).extracting(Trading212ClosedPosition::orderId)
                .doesNotHaveDuplicates().hasSize(109);
        assertThat(report.closedPositions()).extracting(Trading212ClosedPosition::closedAt)
                .doesNotHaveDuplicates().hasSize(109);
        assertThat(report.closedPositions().stream().map(Trading212ClosedPosition::positionId).distinct())
                .hasSize(107);

        assertThat(sum(report, Trading212ClosedPosition::result)).isEqualByComparingTo("1084.70");
        assertThat(sum(report, Trading212ClosedPosition::fxFee)).isEqualByComparingTo("-17.45");
        assertThat(sum(report, Trading212ClosedPosition::resultAfterFxFee)).isEqualByComparingTo("1067.25");
        assertThat(sum(report, Trading212ClosedPosition::overnightInterest)).isEqualByComparingTo("-362.09");
        assertThat(sum(report, Trading212ClosedPosition::dividendAdjustment)).isEqualByComparingTo("0.00");
        assertThat(sum(report, Trading212ClosedPosition::totalResult)).isEqualByComparingTo("705.16");

        Map<String, Long> symbols = report.closedPositions().stream().collect(Collectors.groupingBy(
                Trading212ClosedPosition::symbol, LinkedHashMap::new, Collectors.counting()));
        assertThat(symbols).containsEntry("GER40", 67L)
                .containsEntry("INTC", 25L)
                .containsEntry("TECH100", 16L)
                .containsEntry("MU", 1L);

        ZoneId zone = ZoneId.of("Europe/Bucharest");
        Map<String, Daily> daily = new LinkedHashMap<>();
        report.closedPositions().forEach(position -> daily.compute(
                position.closedAt().atZoneSameInstant(zone).toLocalDate().toString(),
                (date, value) -> value == null
                        ? new Daily(1, position.totalResult())
                        : new Daily(value.count() + 1, value.total().add(position.totalResult()))));
        assertThat(daily).containsExactlyEntriesOf(expectedDaily());

        var interval = report.closedPositions().stream().filter(position -> {
            String date = position.closedAt().atZoneSameInstant(zone).toLocalDate().toString();
            return date.compareTo("2026-07-13") >= 0 && date.compareTo("2026-07-16") <= 0;
        }).toList();
        assertThat(interval).hasSize(15);
        assertThat(interval.stream().map(Trading212ClosedPosition::totalResult)
                .reduce(BigDecimal.ZERO, BigDecimal::add)).isEqualByComparingTo("94.01");

        assertThat(report.closedPositions())
                .filteredOn(position -> position.positionId().equals("POS50350545098"))
                .extracting(Trading212ClosedPosition::orderId)
                .containsExactly("53558774332", "54105775833", "54260110609");
    }

    private static Map<String, Daily> expectedDaily() {
        Map<String, Daily> expected = new LinkedHashMap<>();
        expected.put("2026-07-01", new Daily(11, new BigDecimal("617.43")));
        expected.put("2026-07-02", new Daily(14, new BigDecimal("-832.66")));
        expected.put("2026-07-03", new Daily(2, new BigDecimal("-60.40")));
        expected.put("2026-07-06", new Daily(5, new BigDecimal("111.44")));
        expected.put("2026-07-07", new Daily(4, new BigDecimal("41.16")));
        expected.put("2026-07-08", new Daily(3, new BigDecimal("68.61")));
        expected.put("2026-07-09", new Daily(3, new BigDecimal("521.44")));
        expected.put("2026-07-10", new Daily(1, new BigDecimal("167.20")));
        expected.put("2026-07-13", new Daily(4, new BigDecimal("-430.52")));
        expected.put("2026-07-14", new Daily(5, new BigDecimal("203.11")));
        expected.put("2026-07-15", new Daily(2, new BigDecimal("217.20")));
        expected.put("2026-07-16", new Daily(4, new BigDecimal("104.22")));
        expected.put("2026-07-17", new Daily(2, new BigDecimal("4.96")));
        expected.put("2026-07-20", new Daily(1, new BigDecimal("187.20")));
        expected.put("2026-07-21", new Daily(4, new BigDecimal("164.03")));
        expected.put("2026-07-22", new Daily(1, new BigDecimal("508.00")));
        expected.put("2026-07-23", new Daily(4, new BigDecimal("27.69")));
        expected.put("2026-07-24", new Daily(5, new BigDecimal("106.00")));
        expected.put("2026-07-27", new Daily(10, new BigDecimal("-224.57")));
        expected.put("2026-07-28", new Daily(11, new BigDecimal("-667.45")));
        expected.put("2026-07-29", new Daily(2, new BigDecimal("218.80")));
        expected.put("2026-07-30", new Daily(11, new BigDecimal("-347.73")));
        return expected;
    }

    private static BigDecimal sum(Trading212ParsedReport report,
                                  java.util.function.Function<Trading212ClosedPosition, BigDecimal> mapper) {
        return report.closedPositions().stream().map(mapper).filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private record Daily(int count, BigDecimal total) {
    }
}
