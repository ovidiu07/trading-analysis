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
    void rejectsDuplicateHeadersMalformedTimestampsAndRowsBeyondTheLimit() {
        String duplicate = "Record Type,record type\nClosed position,Closed position\n";
        String malformed = "Record Type,Account currency,Instrument,Symbol,Instrument currency,Direction,Units,"
                + "Position ID,Date opened (UTC),Date closed (UTC),Average price (instrument currency),"
                + "Close price (instrument currency),Result (account currency),Total result (account currency)\n"
                + "Closed position,EUR,X,X,EUR,Buy,1,POS,not-a-time,2026-07-24 08:01:00+00:00,1,2,1,1\n";

        assertThatThrownBy(() -> parser.parse(duplicate.getBytes(), 10))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("duplicate header");
        assertThatThrownBy(() -> parser.parse(malformed.getBytes(), 10))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("invalid offset timestamp");
        assertThatThrownBy(() -> parser.parse(fixture(), 2))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("row limit");
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
