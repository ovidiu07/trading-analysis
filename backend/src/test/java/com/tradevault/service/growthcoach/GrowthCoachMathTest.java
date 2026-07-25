package com.tradevault.service.growthcoach;

import com.tradevault.domain.enums.Direction;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class GrowthCoachMathTest {

    @Test
    void calculatesFrozenPercentageTargetAndSeparatesRealisedProgress() {
        BigDecimal target = GrowthCoachMath.amountFromPercent(new BigDecimal("10000"), new BigDecimal("3"));

        assertEquals(0, new BigDecimal("300").compareTo(target));
        assertEquals(0, new BigDecimal("50").compareTo(
                GrowthCoachMath.progressPercent(new BigDecimal("150"), target)));
        assertEquals(0, new BigDecimal("150").compareTo(
                GrowthCoachMath.remainingTarget(new BigDecimal("150"), target)));
    }

    @Test
    void calculatesExpectancyProfitFactorAndBreakEvenWinRate() {
        assertEquals(0, new BigDecimal("0.250000").compareTo(
                GrowthCoachMath.expectancy(List.of(
                        new BigDecimal("2"), new BigDecimal("-1"),
                        new BigDecimal("1"), new BigDecimal("-1")))));
        assertEquals(0, new BigDecimal("2.500000").compareTo(
                GrowthCoachMath.profitFactor(new BigDecimal("500"), new BigDecimal("200"))));
        assertEquals(0, new BigDecimal("33.333333").compareTo(
                GrowthCoachMath.breakEvenWinRate(new BigDecimal("2"), BigDecimal.ONE)));
        assertNull(GrowthCoachMath.profitFactor(BigDecimal.ONE, BigDecimal.ZERO));
    }

    @Test
    void refusesMisleadingExpectedTimeForNonPositiveExpectancy() {
        assertNull(GrowthCoachMath.expectedTrades(new BigDecimal("500"), BigDecimal.ZERO));
        assertNull(GrowthCoachMath.expectedTrades(new BigDecimal("500"), new BigDecimal("-10")));
        assertNull(GrowthCoachMath.expectedTradingDays(new BigDecimal("5"), BigDecimal.ZERO));
    }

    @Test
    void calculatesRequiredTradesAndDaysForPositiveExpectancy() {
        BigDecimal requiredR = GrowthCoachMath.requiredR(new BigDecimal("600"), new BigDecimal("100"));
        BigDecimal expectedTrades = GrowthCoachMath.expectedTrades(new BigDecimal("600"), new BigDecimal("30"));
        BigDecimal expectedDays = GrowthCoachMath.expectedTradingDays(expectedTrades, new BigDecimal("2"));

        assertEquals(0, new BigDecimal("6").compareTo(requiredR));
        assertEquals(0, new BigDecimal("20").compareTo(expectedTrades));
        assertEquals(0, new BigDecimal("10").compareTo(expectedDays));
    }

    @Test
    void calculatesDirectionalOpenRiskAndRejectsInvalidStops() {
        assertEquals(0, new BigDecimal("100").compareTo(GrowthCoachMath.openRisk(
                Direction.LONG, new BigDecimal("100"), new BigDecimal("99"),
                new BigDecimal("10"), new BigDecimal("10"))));
        assertEquals(0, new BigDecimal("100").compareTo(GrowthCoachMath.openRisk(
                Direction.SHORT, new BigDecimal("100"), new BigDecimal("101"),
                new BigDecimal("10"), new BigDecimal("10"))));
        assertNull(GrowthCoachMath.openRisk(
                Direction.LONG, new BigDecimal("100"), new BigDecimal("101"),
                BigDecimal.ONE, BigDecimal.ONE));
        assertNull(GrowthCoachMath.openRisk(
                Direction.SHORT, new BigDecimal("100"), new BigDecimal("99"),
                BigDecimal.ONE, BigDecimal.ONE));
    }

    @Test
    void drawdownBufferNeverBecomesNegative() {
        assertEquals(0, new BigDecimal("500").compareTo(
                GrowthCoachMath.drawdownBuffer(new BigDecimal("9500"), new BigDecimal("9000"))));
        assertEquals(0, BigDecimal.ZERO.compareTo(
                GrowthCoachMath.drawdownBuffer(new BigDecimal("8500"), new BigDecimal("9000"))));
    }
}
