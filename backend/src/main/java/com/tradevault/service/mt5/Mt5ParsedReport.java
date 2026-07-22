package com.tradevault.service.mt5;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record Mt5ParsedReport(
        Metadata metadata,
        List<Position> positions,
        List<Order> orders,
        List<Deal> deals,
        Map<String, String> accountSnapshot,
        Map<String, String> performanceSummary,
        List<String> warnings
) {
    public record Metadata(String accountName, String externalAccountId, String currency, String brokerServer,
                           String company, String accountType, String accountingMode, String reportGeneratedAt) {}

    public record Position(String openedAt, String externalPositionId, String symbol, String type, String comment,
                           BigDecimal volume, BigDecimal entryPrice, BigDecimal stopLoss, BigDecimal takeProfit,
                           String closedAt, BigDecimal exitPrice, BigDecimal commission, BigDecimal swap,
                           BigDecimal profit, Map<String, String> raw) {}

    public record Order(String openedAt, String externalOrderId, String externalPositionId, String symbol,
                        String type, BigDecimal requestedVolume, BigDecimal filledVolume, BigDecimal requestedPrice,
                        BigDecimal stopLoss, BigDecimal takeProfit, String completedAt, String state, String comment,
                        Map<String, String> raw) {}

    public record Deal(String executedAt, String externalDealId, String externalOrderId, String externalPositionId,
                       String symbol, String type, String direction, BigDecimal volume, BigDecimal price,
                       BigDecimal cost, BigDecimal commission, BigDecimal fee, BigDecimal swap, BigDecimal profit,
                       BigDecimal balance, String comment, Map<String, String> raw) {
        @JsonIgnore
        public boolean isTradingExecution() {
            String normalized = type == null ? "" : type.trim().toLowerCase();
            return symbol != null && !symbol.isBlank()
                    && (normalized.equals("buy") || normalized.equals("sell"));
        }
    }
}
