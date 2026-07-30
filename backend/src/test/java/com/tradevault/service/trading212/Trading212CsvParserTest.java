package com.tradevault.service.trading212;

import com.tradevault.domain.enums.Direction;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class Trading212CsvParserTest {
    private Trading212CsvParser parser;

    @BeforeEach
    void setUp() {
        parser = new Trading212CsvParser(new Trading212PnlReconciler());
    }

    @Test
    void parsesTheSuppliedTrading212ExportAndReconcilesEveryPosition() throws Exception {
        Trading212ParsedReport report = parser.parse(fixture(), 10_000);

        assertThat(report.headers()).hasSize(22);
        assertThat(report.rows()).hasSize(3);
        assertThat(report.closedPositions()).hasSize(3);
        assertThat(report.accountCurrency()).isEqualTo("EUR");
        assertThat(report.unknownHeaders()).isEmpty();
        assertThat(report.closedPositions()).allSatisfy(position -> {
            assertThat(position.recordType()).isEqualTo("Closed position");
            assertThat(position.instrument()).isEqualTo("Germany 40");
            assertThat(position.symbol()).isEqualTo("GER40");
            assertThat(position.instrumentCurrency()).isEqualTo("EUR");
            assertThat(position.direction()).isEqualTo(Direction.SHORT);
            assertThat(position.exchangeRate()).isEqualByComparingTo(BigDecimal.ONE);
            assertThat(position.pricePnlDifference()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(position.totalReconciliationDifference()).isEqualByComparingTo(BigDecimal.ZERO);
        });
        assertThat(report.closedPositions()).extracting(Trading212ClosedPosition::positionId)
                .containsExactly("POS54611997543", "POS54650170715", "POS54650174676");
        assertThat(report.closedPositions()).extracting(Trading212ClosedPosition::orderId)
                .containsExactly("54650150042", "54650179424", "54650186134");
        assertThat(report.closedPositions()).extracting(Trading212ClosedPosition::result)
                .containsExactly(new BigDecimal("-140.80"), new BigDecimal("-2.40"), new BigDecimal("-4.40"));
        assertThat(report.closedPositions()).extracting(Trading212ClosedPosition::totalResult)
                .containsExactly(new BigDecimal("-140.80"), new BigDecimal("-2.40"), new BigDecimal("-4.40"));
        assertThat(report.closedPositions()).extracting(position -> Duration.between(position.openedAt(), position.closedAt()))
                .containsExactly(Duration.ofMinutes(14).plusSeconds(48), Duration.ofMinutes(56).plusSeconds(12),
                        Duration.ofHours(1).plusMinutes(29).plusSeconds(9));
        assertThat(sum(report, Trading212ClosedPosition::units)).isEqualByComparingTo("8");
        assertThat(sum(report, Trading212ClosedPosition::result)).isEqualByComparingTo("-147.60");
        assertThat(sum(report, Trading212ClosedPosition::totalResult)).isEqualByComparingTo("-147.60");
        assertThat(sum(report, Trading212ClosedPosition::spread)).isEqualByComparingTo("9.60");
        assertThat(sum(report, Trading212ClosedPosition::totalResult)).isNotEqualByComparingTo("-157.20");
    }

    @Test
    void supportsUtf8BomQuotedValuesAndPreservesUnsupportedAndUnknownRows() {
        String csv = "\uFEFFRecord Type,Account currency,Instrument,Symbol,Instrument currency,Direction,Units,"
                + "Position ID,Date opened (UTC),Date closed (UTC),Average price (instrument currency),"
                + "Close price (instrument currency),Result (account currency),Total result (account currency),Extra\n"
                + "Dividend,EUR,\"Acme, Inc\",ACME,EUR,Buy,,,,,,,,,=2+2\n"
                + "Closed position,EUR,\"Acme, Inc\",ACME,EUR,Buy,0.5,POS-1,2026-07-24 08:00:00+00:00,"
                + "2026-07-24 08:01:00+00:00,10,11,0.5,0.5,plain\n";

        Trading212ParsedReport report = parser.parse(csv.getBytes(java.nio.charset.StandardCharsets.UTF_8), 10);

        assertThat(report.closedPositions()).hasSize(1);
        assertThat(report.rows()).hasSize(2);
        assertThat(report.rows().get(0).supported()).isFalse();
        assertThat(report.rows().get(0).raw().get("Extra")).isEqualTo("=2+2");
        assertThat(report.unknownHeaders()).containsExactly("extra");
        assertThat(report.closedPositions().get(0).units()).isEqualByComparingTo("0.5");
    }

    @Test
    void rejectsDuplicateHeadersAndRowsBeyondTheLimitButReportsMalformedRows() {
        String duplicate = "Record Type,record type\nClosed position,Closed position\n";
        String malformed = "Record Type,Account currency,Instrument,Symbol,Instrument currency,Direction,Units,"
                + "Position ID,Date opened (UTC),Date closed (UTC),Average price (instrument currency),"
                + "Close price (instrument currency),Result (account currency),Total result (account currency)\n"
                + "Closed position,EUR,X,X,EUR,Buy,1,POS,not-a-time,2026-07-24 08:01:00+00:00,1,2,1,1\n";

        assertThatThrownBy(() -> parser.parse(duplicate.getBytes(), 10))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("duplicate header");
        Trading212ParsedReport malformedReport = parser.parse(malformed.getBytes(), 10);
        assertThat(malformedReport.closedPositions()).isEmpty();
        assertThat(malformedReport.rows()).singleElement().satisfies(row -> {
            assertThat(row.supported()).isTrue();
            assertThat(row.valid()).isFalse();
            assertThat(row.errors()).anyMatch(error -> error.contains("invalid offset timestamp"));
        });
        assertThatThrownBy(() -> parser.parse(fixture(), 2))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("row limit");
    }

    @Test
    void reportsInvalidDecimalsAndDuplicateOrdersWithoutDiscardingOtherRows() {
        String header = "Record Type,Account currency,Instrument,Symbol,Instrument currency,Direction,Units,"
                + "Position ID,Order ID,Date opened (UTC),Date closed (UTC),"
                + "Average price (instrument currency),Close price (instrument currency),"
                + "Result (account currency),Total result (account currency)\n";
        String csv = header
                + "Closed position,EUR,X,X,EUR,Buy,1,POS-1,ORDER-1,2026-07-24 08:00:00+00:00,"
                + "2026-07-24 08:01:00+00:00,10,11,1,1\n"
                + "Closed position,EUR,X,X,EUR,Buy,bad,POS-2,ORDER-2,2026-07-24 08:00:00+00:00,"
                + "2026-07-24 08:01:00+00:00,10,11,1,1\n"
                + "Closed position,EUR,X,X,EUR,Buy,1,POS-3,ORDER-1,2026-07-24 08:00:00+00:00,"
                + "2026-07-24 08:02:00+00:00,10,11,1,1\n";

        Trading212ParsedReport report = parser.parse(csv.getBytes(java.nio.charset.StandardCharsets.UTF_8), 10);

        assertThat(report.closedPositions()).singleElement()
                .extracting(Trading212ClosedPosition::orderId).isEqualTo("ORDER-1");
        assertThat(report.rows()).hasSize(3);
        assertThat(report.rows()).filteredOn(row -> !row.valid()).hasSize(2);
        assertThat(report.rows().get(1).errors()).anyMatch(error -> error.contains("invalid decimal"));
        assertThat(report.rows().get(2).errors()).anyMatch(error -> error.contains("Duplicate Trading 212 Order ID"));
    }

    @Test
    void reportsAnOverwideRowAndContinuesWithLaterValidRows() {
        String header = "Record Type,Account currency,Instrument,Symbol,Instrument currency,Direction,Units,"
                + "Position ID,Order ID,Date opened (UTC),Date closed (UTC),"
                + "Average price (instrument currency),Close price (instrument currency),"
                + "Result (account currency),Total result (account currency)\n";
        String csv = header
                + "Closed position,EUR,X,X,EUR,Buy,1,POS-BAD,ORDER-BAD,2026-07-24 08:00:00+00:00,"
                + "2026-07-24 08:01:00+00:00,10,11,1,1,unexpected\n"
                + "Closed position,EUR,X,X,EUR,Buy,1,POS-GOOD,ORDER-GOOD,2026-07-24 08:00:00+00:00,"
                + "2026-07-24 08:01:00+00:00,10,11,1,1\n";

        Trading212ParsedReport report = parser.parse(csv.getBytes(java.nio.charset.StandardCharsets.UTF_8), 10);

        assertThat(report.rows()).hasSize(2);
        assertThat(report.rows().get(0).valid()).isFalse();
        assertThat(report.rows().get(0).errors()).containsExactly("Row 2 has more values than the header");
        assertThat(report.closedPositions()).singleElement()
                .extracting(Trading212ClosedPosition::orderId).isEqualTo("ORDER-GOOD");
    }

    @Test
    void keepsRepeatedPositionIdsWhenOrderIdsDifferAndAllowsBlankOrderForFallbackIdentity() {
        String header = "Record Type,Account currency,Instrument,Symbol,Instrument currency,Direction,Units,"
                + "Position ID,Order ID,Date opened (UTC),Date closed (UTC),"
                + "Average price (instrument currency),Close price (instrument currency),"
                + "Result (account currency),Total result (account currency)\n";
        String csv = header
                + "Closed position,EUR,X,X,EUR,Sell,1,POS-SHARED,ORDER-1,2026-07-24 08:00:00+00:00,"
                + "2026-07-24 08:01:00+00:00,10,11,-1,-1\n"
                + "Closed position,EUR,X,X,EUR,Sell,2,POS-SHARED,ORDER-2,2026-07-24 08:00:00+00:00,"
                + "2026-07-24 08:02:00+00:00,10,11,-2,-2\n"
                + "Closed position,EUR,X,X,EUR,Sell,3,POS-BLANK,,2026-07-24 08:00:00+00:00,"
                + "2026-07-24 08:03:00+00:00,10,11,-3,-3\n";

        Trading212ParsedReport report = parser.parse(csv.getBytes(java.nio.charset.StandardCharsets.UTF_8), 10);

        assertThat(report.closedPositions()).hasSize(3);
        assertThat(report.closedPositions()).filteredOn(position -> position.positionId().equals("POS-SHARED"))
                .extracting(Trading212ClosedPosition::orderId).containsExactly("ORDER-1", "ORDER-2");
        Trading212ClosedPosition blankOrder = report.closedPositions().get(2);
        assertThat(blankOrder.orderId()).isNull();
        Trading212ExternalIdentity identity = new Trading212ExternalIdentity();
        java.util.UUID accountId = java.util.UUID.randomUUID();
        assertThat(identity.resolve(accountId, blankOrder)).startsWith("sha256:")
                .isEqualTo(identity.resolve(accountId, blankOrder));
    }

    private static BigDecimal sum(Trading212ParsedReport report,
                                  java.util.function.Function<Trading212ClosedPosition, BigDecimal> mapper) {
        return report.closedPositions().stream().map(mapper).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static byte[] fixture() throws Exception {
        try (InputStream input = Trading212CsvParserTest.class.getResourceAsStream(
                "/fixtures/trading212/from_2026-07-24_to_2026-07-24.csv")) {
            if (input == null) throw new IllegalStateException("Fixture missing");
            return input.readAllBytes();
        }
    }
}
