package com.tradevault.service.growthcoach;

import com.tradevault.dto.growthcoach.GrowthCoachResponse.CoachMessage;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class GrowthCoachMessageEngineTest {
    private final GrowthCoachMessageEngine engine = new GrowthCoachMessageEngine();

    @Test
    void prioritizesUnknownOpenRiskAndDoesNotRecommendCatchingUp() {
        List<CoachMessage> messages = engine.evaluate(context(
                false, "UNKNOWN", "UNLIKELY", new BigDecimal("-0.20"), 30, 2));

        assertEquals("OPEN_TRADE_WITHOUT_STOP", messages.get(0).key());
        assertTrue(messages.get(0).blocking());
        assertTrue(messages.stream().anyMatch(message -> message.key().equals("DO_NOT_INCREASE_TO_CATCH_UP")));
        assertTrue(messages.stream().noneMatch(message -> message.key().contains("INCREASE_RISK")));
    }

    @Test
    void targetReachedSuppressesBehindTargetMessages() {
        List<CoachMessage> messages = engine.evaluate(context(
                true, "STANDARD", "CONSERVATIVE", new BigDecimal("0.30"), 50, 0));

        assertTrue(messages.stream().anyMatch(message -> message.key().equals("TARGET_REACHED")));
        assertTrue(messages.stream().noneMatch(message -> message.key().startsWith("BEHIND_")));
        assertTrue(messages.stream().noneMatch(message -> message.key().equals("DO_NOT_INCREASE_TO_CATCH_UP")));
    }

    @Test
    void negativeExpectancyProducesNoCompletionPromiseMessage() {
        List<CoachMessage> messages = engine.evaluate(context(
                false, "REDUCED", "UNLIKELY", new BigDecimal("-0.10"), 20, 0));

        assertTrue(messages.stream().anyMatch(message -> message.key().equals("NEGATIVE_EXPECTANCY")));
        assertTrue(messages.stream().noneMatch(message -> message.key().equals("ENOUGH_TIME")));
    }

    private GrowthCoachMessageEngine.Context context(boolean reached,
                                                     String riskState,
                                                     String feasibility,
                                                     BigDecimal expectancyR,
                                                     int sample,
                                                     int unknownRisk) {
        return new GrowthCoachMessageEngine.Context(
                new BigDecimal("10000"),
                unknownRisk == 0,
                unknownRisk == 0 ? 0 : 2,
                unknownRisk,
                riskState,
                new BigDecimal("200"),
                reached,
                reached ? new BigDecimal("100") : new BigDecimal("-200"),
                5,
                new BigDecimal("3"),
                new BigDecimal("300"),
                reached ? new BigDecimal("120") : new BigDecimal("20"),
                new BigDecimal("50"),
                feasibility,
                new BigDecimal("5"),
                8,
                BigDecimal.ZERO,
                new BigDecimal("0.5"),
                new BigDecimal("0.5"),
                new BigDecimal("50"),
                0,
                expectancyR,
                sample,
                0,
                new BigDecimal("5"),
                new BigDecimal("0.02")
        );
    }
}
