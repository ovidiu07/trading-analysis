package com.tradevault.service.mt5;

import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeStatus;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

@Component
public class Mt5TradeReconstructor {
    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
    );

    public List<Mt5TradeCandidate> reconstruct(Mt5ParsedReport report, ZoneId sourceZone) {
        List<Mt5TradeCandidate> result = new ArrayList<>();
        for (Mt5ParsedReport.Position position : positionsWithDealOnlyFallbacks(report)) {
            List<Mt5ParsedReport.Deal> deals = matchingDeals(position, report.deals());
            List<Mt5ParsedReport.Deal> tradingDeals = deals.stream().filter(Mt5ParsedReport.Deal::isTradingExecution).toList();
            Direction direction = direction(position, tradingDeals);
            List<Mt5ParsedReport.Deal> entries = tradingDeals.stream().filter(d -> isEntry(d, direction)).toList();
            List<Mt5ParsedReport.Deal> exits = tradingDeals.stream().filter(d -> isExit(d, direction)).toList();
            List<Mt5ParsedReport.Order> orders = matchingOrders(position, tradingDeals, report.orders());
            Mt5ParsedReport.Order entryOrder = orders.stream().filter(this::isFilled).filter(o -> isEntryOrder(o, direction))
                    .min(Comparator.comparing(o -> localDate(o.openedAt()), Comparator.nullsLast(Comparator.naturalOrder()))).orElse(null);
            Mt5ParsedReport.Order exitOrder = orders.stream().filter(this::isFilled).filter(o -> !isEntryOrder(o, direction))
                    .max(Comparator.comparing(o -> localDate(o.completedAt()), Comparator.nullsLast(Comparator.naturalOrder()))).orElse(null);

            BigDecimal quantity = positive(firstNonNull(sumVolumes(entries), position.volume()));
            BigDecimal entryPrice = firstNonNull(weightedPrice(entries), position.entryPrice());
            BigDecimal exitPrice = firstNonNull(weightedPrice(exits), position.exitPrice());
            String openedOriginal = entries.stream().map(Mt5ParsedReport.Deal::executedAt).filter(Objects::nonNull)
                    .min(Comparator.comparing(this::localDate, Comparator.nullsLast(Comparator.naturalOrder()))).orElse(position.openedAt());
            String closedOriginal = exits.stream().map(Mt5ParsedReport.Deal::executedAt).filter(Objects::nonNull)
                    .max(Comparator.comparing(this::localDate, Comparator.nullsLast(Comparator.naturalOrder()))).orElse(position.closedAt());
            OffsetDateTime openedAt = toUtc(openedOriginal, sourceZone);
            OffsetDateTime closedAt = toUtc(closedOriginal, sourceZone);
            TradeStatus status = closedAt != null && exitPrice != null ? TradeStatus.CLOSED : TradeStatus.OPEN;

            BigDecimal commissionImpact = sum(tradingDeals.stream().map(Mt5ParsedReport.Deal::commission).toList());
            if ((commissionImpact == null || commissionImpact.signum() == 0) && position.commission() != null) commissionImpact = position.commission();
            BigDecimal otherImpact = sum(tradingDeals.stream()
                    .flatMap(d -> java.util.stream.Stream.of(d.fee(), d.cost(), d.swap())).toList());
            if ((otherImpact == null || otherImpact.signum() == 0) && position.swap() != null) otherImpact = position.swap();
            BigDecimal commission = expenseFromImpact(commissionImpact);
            BigDecimal otherCosts = expenseFromImpact(otherImpact);
            BigDecimal gross = firstNonNull(position.profit(), sum(exits.stream().map(Mt5ParsedReport.Deal::profit).toList()));
            BigDecimal net = gross == null ? null : gross.add(zero(commissionImpact)).add(zero(otherImpact));
            BigDecimal requestedEntry = entryOrder == null ? null : entryOrder.requestedPrice();
            BigDecimal requestedExit = exitOrder == null ? null : exitOrder.requestedPrice();
            BigDecimal entrySlippage = requestedEntry == null || entryPrice == null ? null : entryPrice.subtract(requestedEntry);
            BigDecimal exitSlippage = requestedExit == null || exitPrice == null ? null : exitPrice.subtract(requestedExit);
            String exitReason = inferExitReason(exits, exitOrder);
            String note = meaningfulComment(position.comment(), orders, tradingDeals);
            List<String> warnings = new ArrayList<>();
            if (entries.isEmpty()) warnings.add("Entry price/time used the Position fallback because no entry deal was linked");
            if (status == TradeStatus.CLOSED && exits.isEmpty()) warnings.add("Exit price/time used the Position fallback because no exit deal was linked");
            if (position.stopLoss() == null) warnings.add("Final stop loss is unavailable");
            if (position.takeProfit() == null) warnings.add("Final take profit is unavailable");
            warnings.add("Risk amount and capital used were not inferred without complete contract metadata");

            result.add(new Mt5TradeCandidate(
                    position.externalPositionId(), position.symbol(), direction, status, openedOriginal, openedAt,
                    closedOriginal, closedAt, quantity, entryPrice, exitPrice,
                    entryOrder == null ? position.stopLoss() : firstNonNull(entryOrder.stopLoss(), position.stopLoss()),
                    entryOrder == null ? position.takeProfit() : firstNonNull(entryOrder.takeProfit(), position.takeProfit()),
                    position.stopLoss(), position.takeProfit(), gross, commission, otherCosts, net,
                    entryOrder == null ? null : entryOrder.type(), requestedEntry, requestedExit,
                    entrySlippage, exitSlippage, exitReason, note,
                    tradingDeals.stream().map(Mt5ParsedReport.Deal::externalDealId).filter(Objects::nonNull).toList(),
                    orders.stream().map(Mt5ParsedReport.Order::externalOrderId).filter(Objects::nonNull).toList(),
                    warnings));
        }
        return result;
    }

    private List<Mt5ParsedReport.Deal> matchingDeals(Mt5ParsedReport.Position position, List<Mt5ParsedReport.Deal> all) {
        List<Mt5ParsedReport.Deal> direct = clean(position.externalPositionId()).isBlank() ? List.of() : all.stream()
                .filter(d -> Objects.equals(clean(d.externalPositionId()), clean(position.externalPositionId()))).toList();
        if (!direct.isEmpty()) return direct;
        LocalDateTime open = localDate(position.openedAt());
        LocalDateTime close = localDate(position.closedAt());
        return all.stream().filter(Mt5ParsedReport.Deal::isTradingExecution)
                .filter(d -> equalsIgnoreCase(d.symbol(), position.symbol()))
                .filter(d -> {
                    LocalDateTime time = localDate(d.executedAt());
                    return time != null && (open == null || !time.isBefore(open.minusSeconds(2)))
                            && (close == null || !time.isAfter(close.plusSeconds(2)));
                }).toList();
    }

    private List<Mt5ParsedReport.Order> matchingOrders(Mt5ParsedReport.Position position, List<Mt5ParsedReport.Deal> deals,
                                                        List<Mt5ParsedReport.Order> all) {
        Set<String> dealOrderIds = new HashSet<>(deals.stream().map(Mt5ParsedReport.Deal::externalOrderId).filter(Objects::nonNull).toList());
        List<Mt5ParsedReport.Order> direct = all.stream().filter(order ->
                Objects.equals(clean(order.externalPositionId()), clean(position.externalPositionId()))
                        || dealOrderIds.contains(order.externalOrderId())).toList();
        if (!direct.isEmpty()) return direct;
        LocalDateTime open = localDate(position.openedAt());
        LocalDateTime close = localDate(position.closedAt());
        return all.stream().filter(order -> equalsIgnoreCase(order.symbol(), position.symbol()) && within(order.openedAt(), open, close))
                .toList();
    }

    private boolean within(String raw, LocalDateTime open, LocalDateTime close) {
        LocalDateTime value = localDate(raw);
        return value != null && (open == null || !value.isBefore(open.minusHours(24))) && (close == null || !value.isAfter(close.plusHours(24)));
    }

    private Direction direction(Mt5ParsedReport.Position position, List<Mt5ParsedReport.Deal> deals) {
        String type = clean(position.type()).toLowerCase(Locale.ROOT);
        if (type.contains("sell")) return Direction.SHORT;
        if (type.contains("buy")) return Direction.LONG;
        return deals.stream().filter(d -> clean(d.direction()).toLowerCase(Locale.ROOT).startsWith("in"))
                .findFirst().map(d -> clean(d.type()).equalsIgnoreCase("sell") ? Direction.SHORT : Direction.LONG)
                .orElse(Direction.LONG);
    }

    private boolean isEntry(Mt5ParsedReport.Deal deal, Direction direction) {
        String entry = clean(deal.direction()).toLowerCase(Locale.ROOT);
        if (entry.equals("in") || entry.startsWith("in ")) return true;
        if (entry.equals("out") || entry.startsWith("out")) return false;
        return (direction == Direction.LONG && equalsIgnoreCase(deal.type(), "buy"))
                || (direction == Direction.SHORT && equalsIgnoreCase(deal.type(), "sell"));
    }

    private boolean isExit(Mt5ParsedReport.Deal deal, Direction direction) { return !isEntry(deal, direction); }
    private boolean isFilled(Mt5ParsedReport.Order order) { return clean(order.state()).toLowerCase(Locale.ROOT).contains("fill"); }
    private boolean isEntryOrder(Mt5ParsedReport.Order order, Direction direction) {
        String type = clean(order.type()).toLowerCase(Locale.ROOT);
        return direction == Direction.LONG ? type.startsWith("buy") : type.startsWith("sell");
    }

    private static BigDecimal weightedPrice(List<Mt5ParsedReport.Deal> deals) {
        BigDecimal quantity = BigDecimal.ZERO;
        BigDecimal notional = BigDecimal.ZERO;
        for (Mt5ParsedReport.Deal deal : deals) {
            if (deal.volume() == null || deal.price() == null) continue;
            BigDecimal volume = deal.volume().abs();
            quantity = quantity.add(volume);
            notional = notional.add(volume.multiply(deal.price()));
        }
        return quantity.signum() == 0 ? null : notional.divide(quantity, 10, RoundingMode.HALF_UP).stripTrailingZeros();
    }

    private static BigDecimal sumVolumes(List<Mt5ParsedReport.Deal> deals) {
        if (deals.isEmpty()) return null;
        return deals.stream().map(Mt5ParsedReport.Deal::volume).filter(Objects::nonNull).map(BigDecimal::abs)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal sum(List<BigDecimal> values) {
        List<BigDecimal> present = values.stream().filter(Objects::nonNull).toList();
        return present.isEmpty() ? null : present.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal expenseFromImpact(BigDecimal impact) {
        return impact != null && impact.signum() < 0 ? impact.abs() : BigDecimal.ZERO;
    }

    private List<Mt5ParsedReport.Position> positionsWithDealOnlyFallbacks(Mt5ParsedReport report) {
        List<Mt5ParsedReport.Position> positions = new ArrayList<>(report.positions());
        Set<String> represented = positions.stream().map(Mt5ParsedReport.Position::externalPositionId)
                .filter(Objects::nonNull).map(Mt5TradeReconstructor::clean).collect(java.util.stream.Collectors.toSet());
        Map<String, List<Mt5ParsedReport.Deal>> missing = report.deals().stream().filter(Mt5ParsedReport.Deal::isTradingExecution)
                .filter(d -> d.externalPositionId() == null || !represented.contains(clean(d.externalPositionId())))
                .collect(java.util.stream.Collectors.groupingBy(d -> !clean(d.externalPositionId()).isBlank()
                        ? clean(d.externalPositionId()) : "DEALS-" + clean(d.symbol())));
        for (Map.Entry<String, List<Mt5ParsedReport.Deal>> entry : missing.entrySet()) {
            List<Mt5ParsedReport.Deal> deals = entry.getValue().stream()
                    .sorted(Comparator.comparing(d -> localDate(d.executedAt()), Comparator.nullsLast(Comparator.naturalOrder()))).toList();
            Mt5ParsedReport.Deal first = deals.get(0);
            List<Mt5ParsedReport.Deal> entries = deals.stream().filter(d -> clean(d.direction()).toLowerCase(Locale.ROOT).startsWith("in")).toList();
            List<Mt5ParsedReport.Deal> exits = deals.stream().filter(d -> clean(d.direction()).toLowerCase(Locale.ROOT).startsWith("out")).toList();
            BigDecimal volume = sumVolumes(entries.isEmpty() ? List.of(first) : entries);
            String close = exits.isEmpty() ? null : exits.get(exits.size() - 1).executedAt();
            positions.add(new Mt5ParsedReport.Position(first.executedAt(), entry.getKey(), first.symbol(), first.type(),
                    first.comment(), volume, weightedPrice(entries), null, null, close, weightedPrice(exits),
                    null, null, sum(exits.stream().map(Mt5ParsedReport.Deal::profit).toList()), Map.of("source", "deals-only")));
        }
        return positions;
    }

    private static BigDecimal positive(BigDecimal value) { return value == null ? null : value.abs(); }
    private static BigDecimal zero(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }

    private String inferExitReason(List<Mt5ParsedReport.Deal> exits, Mt5ParsedReport.Order exitOrder) {
        String comments = exits.stream().map(Mt5ParsedReport.Deal::comment).filter(Objects::nonNull).reduce("", (a, b) -> a + " " + b).toLowerCase(Locale.ROOT);
        if (comments.contains("[sl") || comments.contains("stop loss")) return "STOP_LOSS";
        if (comments.contains("[tp") || comments.contains("take profit")) return "TAKE_PROFIT";
        String type = exitOrder == null ? "" : clean(exitOrder.type()).toLowerCase(Locale.ROOT);
        if (type.contains("stop")) return "STOP_LOSS";
        if (type.contains("limit")) return "TAKE_PROFIT";
        return exits.isEmpty() ? null : "MANUAL_OR_OTHER";
    }

    private String meaningfulComment(String positionComment, List<Mt5ParsedReport.Order> orders, List<Mt5ParsedReport.Deal> deals) {
        List<String> comments = new ArrayList<>();
        comments.add(positionComment);
        orders.forEach(o -> comments.add(o.comment()));
        deals.forEach(d -> comments.add(d.comment()));
        return comments.stream().map(Mt5TradeReconstructor::clean).filter(v -> !v.isBlank())
                .filter(v -> !v.matches("(?i)^\\[(sl|tp).*]$")).filter(v -> !v.matches("(?i)^(sl|tp) .*"))
                .findFirst().orElse(null);
    }

    public OffsetDateTime toUtc(String raw, ZoneId sourceZone) {
        LocalDateTime local = localDate(raw);
        return local == null ? null : local.atZone(sourceZone).withZoneSameInstant(ZoneOffset.UTC).toOffsetDateTime();
    }

    private LocalDateTime localDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        for (DateTimeFormatter formatter : DATE_FORMATS) {
            try { return LocalDateTime.parse(clean(raw), formatter); } catch (DateTimeParseException ignored) { }
        }
        return null;
    }

    private static boolean equalsIgnoreCase(String a, String b) { return a != null && b != null && a.equalsIgnoreCase(b); }
    private static String clean(String value) { return value == null ? "" : value.replace('\u00a0', ' ').trim(); }
    private static <T> T firstNonNull(T a, T b) { return a != null ? a : b; }
}
