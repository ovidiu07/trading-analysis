package com.tradevault.service.growthcoach;

import com.tradevault.domain.enums.Direction;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

public final class GrowthCoachMath {
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final int SCALE = 6;

    private GrowthCoachMath() {
    }

    public static BigDecimal amountFromPercent(BigDecimal reference, BigDecimal percent) {
        if (reference == null || percent == null) return null;
        return reference.multiply(percent).divide(HUNDRED, SCALE, RoundingMode.HALF_UP);
    }

    public static BigDecimal progressPercent(BigDecimal realised, BigDecimal target) {
        if (realised == null || target == null || target.signum() <= 0) return BigDecimal.ZERO;
        return realised.multiply(HUNDRED).divide(target, SCALE, RoundingMode.HALF_UP);
    }

    public static BigDecimal remainingTarget(BigDecimal realised, BigDecimal target) {
        if (realised == null || target == null) return null;
        return target.subtract(realised).max(BigDecimal.ZERO);
    }

    public static BigDecimal expectancy(List<BigDecimal> netOutcomes) {
        if (netOutcomes == null || netOutcomes.isEmpty()) return BigDecimal.ZERO;
        return netOutcomes.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(netOutcomes.size()), SCALE, RoundingMode.HALF_UP);
    }

    public static BigDecimal profitFactor(BigDecimal grossProfit, BigDecimal grossLoss) {
        if (grossProfit == null || grossLoss == null || grossLoss.signum() == 0) return null;
        return grossProfit.divide(grossLoss.abs(), SCALE, RoundingMode.HALF_UP);
    }

    public static BigDecimal breakEvenWinRate(BigDecimal averageWinnerR, BigDecimal averageLoserR) {
        if (averageWinnerR == null || averageLoserR == null) return null;
        BigDecimal loss = averageLoserR.abs();
        BigDecimal denominator = averageWinnerR.add(loss);
        if (denominator.signum() == 0) return null;
        return loss.multiply(HUNDRED).divide(denominator, SCALE, RoundingMode.HALF_UP);
    }

    public static BigDecimal requiredR(BigDecimal remainingTarget, BigDecimal riskAmount) {
        if (remainingTarget == null || riskAmount == null || riskAmount.signum() <= 0) return null;
        return remainingTarget.divide(riskAmount, SCALE, RoundingMode.HALF_UP);
    }

    public static BigDecimal expectedTrades(BigDecimal remainingTarget, BigDecimal positiveExpectancyMoney) {
        if (remainingTarget == null || positiveExpectancyMoney == null || positiveExpectancyMoney.signum() <= 0) return null;
        return remainingTarget.divide(positiveExpectancyMoney, SCALE, RoundingMode.HALF_UP);
    }

    public static BigDecimal expectedTradingDays(BigDecimal expectedTrades, BigDecimal tradesPerActiveDay) {
        if (expectedTrades == null || tradesPerActiveDay == null || tradesPerActiveDay.signum() <= 0) return null;
        return expectedTrades.divide(tradesPerActiveDay, SCALE, RoundingMode.HALF_UP);
    }

    public static BigDecimal openRisk(Direction direction,
                                      BigDecimal entry,
                                      BigDecimal stop,
                                      BigDecimal quantity,
                                      BigDecimal multiplier) {
        if (direction == null || entry == null || stop == null || quantity == null || multiplier == null
                || quantity.signum() <= 0 || multiplier.signum() <= 0) {
            return null;
        }
        if (direction == Direction.LONG && stop.compareTo(entry) >= 0) return null;
        if (direction == Direction.SHORT && stop.compareTo(entry) <= 0) return null;
        return entry.subtract(stop).abs().multiply(quantity).multiply(multiplier);
    }

    public static BigDecimal drawdownBuffer(BigDecimal equity, BigDecimal boundary) {
        if (equity == null || boundary == null) return null;
        return equity.subtract(boundary).max(BigDecimal.ZERO);
    }
}
