package com.tradevault.service.backtest;

import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

public final class BacktestRangeResolver {
    private BacktestRangeResolver() {
    }

    public static Duration defaultWindow(BacktestTimeframe timeframe) {
        BacktestTimeframe safe = timeframe == null ? BacktestTimeframe.M1 : timeframe;
        return switch (safe) {
            case M1, M5 -> Duration.ofDays(7);
            case M15, H1 -> Duration.ofDays(30);
            case D1 -> Duration.ofDays(180);
        };
    }

    public static int defaultWindowDays(BacktestTimeframe timeframe) {
        return Math.toIntExact(defaultWindow(timeframe).toDays());
    }

    public static EffectiveRange resolveDatasetRange(BacktestCandleSource source,
                                                     BacktestTimeframe timeframe,
                                                     OffsetDateTime datasetFromRaw,
                                                     OffsetDateTime datasetToRaw,
                                                     OffsetDateTime requestedFromRaw,
                                                     OffsetDateTime requestedToRaw,
                                                     OffsetDateTime nowRaw) {
        OffsetDateTime nowUtc = normalize(nowRaw == null ? OffsetDateTime.now(ZoneOffset.UTC) : nowRaw);
        OffsetDateTime datasetFrom = normalize(datasetFromRaw);
        OffsetDateTime datasetTo = normalize(datasetToRaw);
        OffsetDateTime requestedFrom = normalize(requestedFromRaw);
        OffsetDateTime requestedTo = normalize(requestedToRaw);

        OffsetDateTime effectiveTo = requestedTo;
        if (effectiveTo == null) {
            if (source == BacktestCandleSource.CSV || source == BacktestCandleSource.DEMO) {
                effectiveTo = firstNonNull(datasetTo, datasetFrom, nowUtc);
            } else {
                effectiveTo = datasetTo != null && datasetTo.isBefore(nowUtc) ? datasetTo : nowUtc;
            }
        }

        OffsetDateTime effectiveFrom = requestedFrom;
        if (effectiveFrom == null) {
            effectiveFrom = effectiveTo.minus(defaultWindow(timeframe));
        }

        if (datasetFrom != null && effectiveFrom.isBefore(datasetFrom)) {
            effectiveFrom = datasetFrom;
        }
        if (datasetTo != null && effectiveTo.isAfter(datasetTo)) {
            effectiveTo = datasetTo;
        }

        boolean empty = effectiveFrom.isAfter(effectiveTo);
        return new EffectiveRange(effectiveFrom, effectiveTo, empty);
    }

    private static OffsetDateTime normalize(OffsetDateTime value) {
        return value == null ? null : value.withOffsetSameInstant(ZoneOffset.UTC);
    }

    private static OffsetDateTime firstNonNull(OffsetDateTime... values) {
        if (values == null) {
            return null;
        }
        for (OffsetDateTime value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    public record EffectiveRange(OffsetDateTime fromUtc, OffsetDateTime toUtc, boolean empty) {
    }
}
