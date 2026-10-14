package com.tradevault.service.backtesting;

import com.tradevault.domain.entity.BacktestingTrade;
import com.tradevault.domain.enums.BacktestingGapType;
import com.tradevault.domain.enums.BacktestingTradeDirection;
import com.tradevault.domain.enums.BacktestingTradeScope;
import com.tradevault.domain.enums.BacktestingTradeSource;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;

/** Versioned facts emitted by the Five Sessions strategy, preserved in native CSV Signal cells. */
public final class FvgSignalMetadata {
    private static final String MARKER = " | FVGv1 ";
    private FvgSignalMetadata() {}

    public static boolean hasPayload(String signal) {
        return signal != null && signal.contains(MARKER);
    }

    public static void apply(BacktestingTrade trade) {
        String signal = trade.getEntrySignal();
        if (!hasPayload(signal)) return;
        try {
            Map<String, String> values = tokens(signal);
            BigDecimal low = number(values, "lo", 8, 12), high = number(values, "hi", 8, 12);
            BigDecimal width = high.subtract(low);
            BigDecimal size = number(values, "size", 8, 12);
            BigDecimal sizePercent = number(values, "sizePct", 6, 6);
            BigDecimal plannedDepth = number(values, "depth", 6, 3);
            BigDecimal configuredRR = number(values, "rr", 8, 8);
            String timeframe = values.get("tf");
            long created = Long.parseLong(values.get("created"));
            if (low.signum() <= 0 || width.signum() <= 0 || size.compareTo(width) != 0 || sizePercent.signum() < 0
                    || timeframe == null || !timeframe.matches("[A-Za-z0-9]+") || timeframe.length() > 40 || created <= 0)
                throw new IllegalArgumentException("invalid gap geometry, timeframe or creation timestamp");
            if (!"TOUCH".equals(values.get("mode")) && !"DEPTH".equals(values.get("mode"))
                    || plannedDepth.signum() < 0 || plannedDepth.compareTo(BigDecimal.valueOf(100)) > 0 || configuredRR.signum() <= 0)
                throw new IllegalArgumentException("invalid entry configuration");
            beLockPercent(values);
            Instant confirmedAt = Instant.ofEpochMilli(created);
            if (confirmedAt.atZone(ZoneId.of("UTC")).getYear() > 9999)
                throw new IllegalArgumentException("creation timestamp out of range");
            BigDecimal depth = trade.getDirection() == BacktestingTradeDirection.LONG
                    ? high.subtract(trade.getEntryPrice()) : trade.getEntryPrice().subtract(low);
            depth = depth.multiply(BigDecimal.valueOf(100)).divide(width, 6, RoundingMode.HALF_UP);
            trade.setGapPresent(true);
            trade.setGapType(trade.getDirection() == BacktestingTradeDirection.LONG ? BacktestingGapType.BULLISH : BacktestingGapType.BEARISH);
            trade.setGapTimeframe(timeframe);
            trade.setGapLow(low);
            trade.setGapHigh(high);
            trade.setGapMidpoint(low.add(high).divide(BigDecimal.valueOf(2), 8, RoundingMode.HALF_UP));
            trade.setGapSizePercent(sizePercent);
            // The editable field accepts 0..100. Out-of-zone fills remain unclamped in the source/export diagnostics.
            if (depth.signum() >= 0 && depth.compareTo(BigDecimal.valueOf(100)) <= 0)
                trade.setGapEntryPositionPercent(depth);
            if (trade.getSourceTimezone() != null && !trade.getSourceTimezone().isBlank())
                trade.setGapCreatedAt(confirmedAt.atZone(ZoneId.of(trade.getSourceTimezone())).toLocalTime());
            // A native Signal has price width, not the configured point/pip divisor. First-touch clock is also absent.
            // Keep gapSizePoints, gapMitigatedAt and gapFillStatus unavailable rather than inventing them.
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException("Invalid FVGv1 signal: " + ex.getMessage(), ex);
        }
    }

    /** Protected share of the full entry-to-TP distance; null when no enabled source configuration exists. */
    public static BigDecimal protectedProfitPercent(String signal) {
        if (!hasPayload(signal)) return null;
        try {
            return beLockPercent(tokens(signal));
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException("Invalid FVGv1 signal: " + ex.getMessage(), ex);
        }
    }

    private static Map<String, String> tokens(String signal) {
        Map<String, String> values = new HashMap<>();
        for (String token : signal.substring(signal.indexOf(MARKER) + MARKER.length()).split("\\s+")) {
            String[] pair = token.split("=", 2);
            if (pair.length != 2 || values.putIfAbsent(pair[0], pair[1]) != null)
                throw new IllegalArgumentException("invalid or duplicate token");
        }
        return values;
    }

    private static BigDecimal beLockPercent(Map<String, String> values) {
        if ("OFF".equals(values.get("BE"))) return null;
        String[] be = values.getOrDefault("BE", "").split("/", -1);
        if (be.length != 2) throw new IllegalArgumentException("invalid BE configuration");
        BigDecimal trigger = new BigDecimal(be[0]), lock = new BigDecimal(be[1]);
        if (trigger.signum() <= 0 || trigger.compareTo(BigDecimal.valueOf(100)) > 0 || lock.signum() < 0 || lock.compareTo(trigger) >= 0)
            throw new IllegalArgumentException("invalid BE configuration");
        return lock;
    }

    private static BigDecimal number(Map<String, String> values, String key, int scale, int integerDigits) {
        String raw = values.get(key);
        if (raw == null || !raw.matches("-?\\d+(?:\\.\\d+)?")) throw new IllegalArgumentException("invalid " + key);
        BigDecimal value = new BigDecimal(raw);
        if (value.scale() > scale || value.precision() - value.scale() > integerDigits)
            throw new IllegalArgumentException(key + " exceeds supported precision");
        return value;
    }

    /** A repeat export may add source facts, but must not replace existing research annotations. */
    public static boolean canEnrich(BacktestingTrade existing, BacktestingTrade incoming) {
        return existing.getSource() == BacktestingTradeSource.IMPORT && existing.getTradeScope() == BacktestingTradeScope.REPLAY
                && ReplayCsvParser.FORMAT.equals(existing.getImportFormat())
                && incoming.isGapPresent() && hasPayload(incoming.getEntrySignal()) && !hasPayload(existing.getEntrySignal())
                && !existing.isGapPresent() && existing.getGapType() == null && existing.getGapTimeframe() == null
                && existing.getGapLow() == null && existing.getGapHigh() == null && existing.getGapMidpoint() == null
                && existing.getGapSizePoints() == null && existing.getGapSizePercent() == null
                && existing.getGapEntryPositionPercent() == null && existing.getGapCreatedAt() == null
                && existing.getGapMitigatedAt() == null && existing.getGapFillStatus() == null
                && existing.getGapRelationToLiquidity() == null
                && (existing.getGapConfluenceNotes() == null || existing.getGapConfluenceNotes().isBlank());
    }

    public static void enrich(BacktestingTrade existing, BacktestingTrade incoming) {
        existing.setEntrySignal(incoming.getEntrySignal());
        existing.setExitSignal(incoming.getExitSignal());
        // Keep the original import timezone, execution identity, PnL, R, notes and tags.
        apply(existing);
    }
}
