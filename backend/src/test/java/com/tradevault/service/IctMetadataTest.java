package com.tradevault.service;

import com.tradevault.domain.entity.BacktestingTrade;
import com.tradevault.dto.backtesting.BacktestingTradeRequest;
import com.tradevault.service.backtesting.IctMetadata;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.enums.BacktestingTradeSource;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class IctMetadataTest {
    @Test void validatesNumbersAndAllowsZeroAndNullWithoutPercentageConversion() {
        BacktestingTrade trade = new BacktestingTrade();
        IctMetadata.apply(trade, Map.of("gapSizePercent", new BigDecimal("0.07"), "gapSizePoints", new BigDecimal("12.5"), "fvgAge", 0));
        assertThat(trade.getGapSizePercent()).isEqualByComparingTo("0.07");
        assertThat(trade.getGapSizePoints()).isEqualByComparingTo("12.5");
        assertThat(trade.getFvgAge()).isZero();
        for (Object invalid : List.of(-1, 1.5, Double.NaN, Double.POSITIVE_INFINITY, 2147483648L, "2"))
            assertThatThrownBy(() -> IctMetadata.apply(trade, Map.of("fvgAge", invalid))).isInstanceOf(IllegalArgumentException.class);
        for (Object invalid : List.of(-0.01, Double.NaN, new BigDecimal("0.0000001"), new BigDecimal("1000000")))
            assertThatThrownBy(() -> IctMetadata.apply(trade, Map.of("gapSizePercent", invalid))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> IctMetadata.apply(trade, Map.of("gapSizePoints", -1))).isInstanceOf(IllegalArgumentException.class);
        IctMetadata.apply(trade, Collections.singletonMap("gapSizePercent", null));
        assertThat(trade.getGapSizePercent()).isNull();
    }
    @Test void patchIsAtomicRejectsExecutionKeysAndKeepsUnknownDistinctFromNone() {
        BacktestingTrade trade = new BacktestingTrade();
        Map<String,Object> patch = new LinkedHashMap<>(); patch.put("htfTrend", "BEARISH"); patch.put("sweepLevel", "invented");
        assertThatThrownBy(() -> IctMetadata.apply(trade, patch)).isInstanceOf(IllegalArgumentException.class);
        assertThat(trade.getHtfTrend()).isNull();
        assertThatThrownBy(() -> IctMetadata.apply(trade, Map.of("netPnl", 10))).isInstanceOf(IllegalArgumentException.class);
        IctMetadata.apply(trade, Map.of("structureConfirmation", "NONE", "sweepConfirmation", "NO_SWEEP"));
        assertThat(trade.getStructureConfirmation()).isEqualTo("NONE"); assertThat(trade.getSweepConfirmation()).isEqualTo("NO_SWEEP");
        IctMetadata.apply(trade, Collections.singletonMap("structureConfirmation", null)); assertThat(trade.getStructureConfirmation()).isNull();
    }
    @Test void keepsHistoricalCategoricalValuesAndCanonicalizesNewChoices() {
        BacktestingTrade trade = BacktestingTrade.builder().gapTimeframe("120").session("Custom London window").build();
        IctMetadata.apply(trade, Map.of("gapTimeframe", "120", "session", "Custom London window"));
        assertThat(trade.getGapTimeframe()).isEqualTo("120"); assertThat(trade.getSession()).isEqualTo("Custom London window");
        IctMetadata.apply(trade, Map.of("gapTimeframe", "5M", "session", "Asia", "setupType", "Reversal"));
        assertThat(trade.getGapTimeframe()).isEqualTo("5m"); assertThat(trade.getSetupType()).isEqualTo("REVERSAL");
        assertThatThrownBy(() -> IctMetadata.apply(new BacktestingTrade(), Map.of("gapTimeframe", "invented"))).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void explicitCsvColumnsShareValidationAndDoNotImplyAnyMissingField() {
        var patch = IctMetadata.csv(Map.of("Setup Type", "Reversal", "HTF Trend", "Bearish", "FVG Age at Entry", "2", "FVG Size (%)", "0.07", "Sweep Level", "PDL"));
        BacktestingTrade trade = new BacktestingTrade(); IctMetadata.apply(trade, patch);
        assertThat(trade.getSetupType()).isEqualTo("REVERSAL"); assertThat(trade.getFvgAge()).isEqualTo(2);
        assertThat(trade.getGapSizePercent()).isEqualByComparingTo("0.07"); assertThat(trade.getLiquidityType()).isNull();
        assertThat(IctMetadata.csv(Map.of("Gap size pips", "12.5"))).isEmpty();
    }
    @Test void fullRequestRejectsFractionalAgeInsteadOfJacksonTruncation() throws Exception {
        BacktestingTradeRequest request = new ObjectMapper().readValue("{\"fvgAge\":2.5}", BacktestingTradeRequest.class);
        assertThatThrownBy(() -> IctMetadata.apply(new BacktestingTrade(), IctMetadata.values(request))).isInstanceOf(IllegalArgumentException.class);
    }
}
