package com.tradevault.service.trading212;

import com.tradevault.domain.enums.Direction;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Component
public class Trading212PnlReconciler {
    public static final BigDecimal TOLERANCE = new BigDecimal("0.01");

    public Result reconcile(Direction direction, BigDecimal units, BigDecimal entryPrice, BigDecimal exitPrice,
                            BigDecimal exchangeRate, BigDecimal reportedResult, BigDecimal resultAfterFxFee,
                            BigDecimal fxFee, BigDecimal overnightInterest,
                            BigDecimal dividendAdjustment, BigDecimal totalResult) {
        BigDecimal priceMove = direction == Direction.SHORT
                ? entryPrice.subtract(exitPrice)
                : exitPrice.subtract(entryPrice);
        BigDecimal sourceRate = exchangeRate == null ? BigDecimal.ONE : exchangeRate;
        BigDecimal priceDerived = priceMove.multiply(units).multiply(sourceRate);
        BigDecimal priceDifference = reportedResult.subtract(priceDerived);
        BigDecimal reconciledTotal = resultAfterFxFee
                .add(zero(overnightInterest))
                .add(zero(dividendAdjustment));
        BigDecimal totalDifference = totalResult.subtract(reconciledTotal);
        List<String> warnings = new ArrayList<>();
        if (priceDifference.abs().compareTo(TOLERANCE) > 0) {
            warnings.add("Price-derived P&L differs from Trading 212 Result by " + priceDifference.toPlainString());
        }
        if (fxFee != null) {
            BigDecimal expectedAfterFxFee = reportedResult.subtract(fxFee.abs());
            if (resultAfterFxFee.subtract(expectedAfterFxFee).abs().compareTo(TOLERANCE) > 0) {
                warnings.add("Trading 212 Result after FX fee does not match the reported FX fee sign convention");
            }
        }
        if (totalDifference.abs().compareTo(TOLERANCE) > 0) {
            warnings.add("Trading 212 Total result does not reconcile by " + totalDifference.toPlainString()
                    + "; the reported Total result remains authoritative");
        }
        return new Result(priceDerived, priceDifference, totalDifference, List.copyOf(warnings));
    }

    private static BigDecimal zero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    public record Result(BigDecimal priceDerivedPnl, BigDecimal pricePnlDifference,
                         BigDecimal totalReconciliationDifference, List<String> warnings) {
    }
}
