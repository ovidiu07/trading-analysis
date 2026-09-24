package com.tradevault.service.marketdata;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class TreasuryYieldProviderTest {
    @Test
    void parsesOfficialTreasuryYieldRowsAndOrdersNewestFirst() throws Exception {
        String xml = """
                <feed xmlns="http://www.w3.org/2005/Atom" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices">
                  <entry><content><m:properties><d:NEW_DATE>2026-09-22T00:00:00</d:NEW_DATE><d:BC_2YEAR>3.75</d:BC_2YEAR><d:BC_10YEAR>4.10</d:BC_10YEAR></m:properties></content></entry>
                  <entry><content><m:properties><d:NEW_DATE>2026-09-23T00:00:00</d:NEW_DATE><d:BC_2YEAR>3.80</d:BC_2YEAR><d:BC_10YEAR>4.05</d:BC_10YEAR></m:properties></content></entry>
                </feed>
                """;

        var rows = TreasuryYieldProvider.parseRows(xml);

        assertThat(rows).hasSize(2);
        assertThat(rows.get(0).date().toString()).isEqualTo("2026-09-23");
        assertThat(rows.get(0).twoYear()).isEqualByComparingTo("3.80");
        assertThat(rows.get(0).tenYear()).isEqualByComparingTo("4.05");
    }

    @Test
    void calculatesBasisPointChangeFromPercentDifference() {
        assertThat(TreasuryYieldProvider.basisPoints(new BigDecimal("4.05"), new BigDecimal("4.10")))
                .isEqualByComparingTo("-5.00");
        assertThat(TreasuryYieldProvider.basisPoints(new BigDecimal("4.05"), null)).isNull();
    }
}
