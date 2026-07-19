package com.tradevault.service.backtesting;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class InstrumentAliasServiceTest {
    private final InstrumentAliasService service = new InstrumentAliasService();

    @Test
    void resolvesConfiguredDaxIndexAliasesAndSafeBrokerSuffixes() {
        for (String alias : new String[]{"DAX", "DAX30", "DAX40", "GER30", "GER40", "DE30", "DE40",
                "DEU40", "Germany 40", "Germany40", "GER40.cash", "broker:DE40-CFD"}) {
            assertThat(service.resolveCanonicalInstrument(alias))
                    .as(alias)
                    .hasValueSatisfying(value -> assertThat(value.id()).isEqualTo(InstrumentAliasService.DAX_INDEX));
        }
    }

    @Test
    void keepsDaxFuturesFamiliesDistinctFromTheIndexFamily() {
        assertThat(service.resolveCanonicalInstrument("FDAX").orElseThrow().id())
                .isEqualTo(InstrumentAliasService.DAX_FUTURES_FULL);
        assertThat(service.resolveCanonicalInstrument("FDXM").orElseThrow().id())
                .isEqualTo(InstrumentAliasService.DAX_FUTURES_MINI);
        assertThat(service.resolveCanonicalInstrument("FDXS").orElseThrow().id())
                .isEqualTo(InstrumentAliasService.DAX_FUTURES_MICRO);
        assertThat(service.resolveCanonicalInstrument("FDXM").orElseThrow().id())
                .isNotEqualTo(service.resolveCanonicalInstrument("GER40").orElseThrow().id());
    }

    @Test
    void returnsUnknownInsteadOfGuessingUnrelatedSymbols() {
        assertThat(service.resolveCanonicalInstrument("NQ")).isEmpty();
        assertThat(service.resolveCanonicalInstrument("DAXM")).isEmpty();
        assertThat(service.resolveCanonicalInstrument("GER50.cash")).isEmpty();
    }
}
