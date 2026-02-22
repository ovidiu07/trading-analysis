package com.tradevault.service.backtest;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

@Component
@RequiredArgsConstructor
public class CandleChunkCodec {
    private static final TypeReference<List<CandlePoint>> CANDLE_POINTS = new TypeReference<>() {};

    private final ObjectMapper objectMapper;

    public byte[] encode(List<CanonicalCandle> candles) {
        try {
            List<CandlePoint> points = candles == null ? List.of() : candles.stream()
                    .sorted(Comparator.comparing(CanonicalCandle::tsUtc))
                    .map(item -> new CandlePoint(
                            item.tsUtc() == null ? null : item.tsUtc().withOffsetSameInstant(ZoneOffset.UTC).toString(),
                            item.open(),
                            item.high(),
                            item.low(),
                            item.close(),
                            item.volume()
                    ))
                    .toList();
            byte[] json = objectMapper.writeValueAsBytes(points);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (GZIPOutputStream gzip = new GZIPOutputStream(out)) {
                gzip.write(json);
            }
            return out.toByteArray();
        } catch (Exception ex) {
            throw new IllegalStateException("Could not encode candle chunk payload", ex);
        }
    }

    public List<CanonicalCandle> decode(byte[] payload,
                                        BacktestCandleSource provider,
                                        String sourceId,
                                        String symbolCanonical,
                                        String symbolDisplay,
                                        BacktestTimeframe timeframe) {
        if (payload == null || payload.length == 0) {
            return List.of();
        }
        try {
            ByteArrayInputStream input = new ByteArrayInputStream(payload);
            List<CandlePoint> points;
            try (GZIPInputStream gzip = new GZIPInputStream(input)) {
                byte[] json = gzip.readAllBytes();
                if (json.length == 0) {
                    return List.of();
                }
                points = objectMapper.readValue(new String(json, StandardCharsets.UTF_8), CANDLE_POINTS);
            }
            if (points == null) {
                return List.of();
            }
            return points.stream()
                    .map(item -> new CanonicalCandle(
                            provider,
                            sourceId,
                            symbolCanonical,
                            symbolDisplay,
                            timeframe,
                            parseTs(item.tsUtc()),
                            item.open(),
                            item.high(),
                            item.low(),
                            item.close(),
                            item.volume()
                    ))
                    .filter(item -> item.tsUtc() != null)
                    .sorted(Comparator.comparing(CanonicalCandle::tsUtc))
                    .toList();
        } catch (Exception ex) {
            throw new IllegalStateException("Could not decode candle chunk payload", ex);
        }
    }

    private OffsetDateTime parseTs(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(value).withOffsetSameInstant(ZoneOffset.UTC);
        } catch (Exception ex) {
            return null;
        }
    }

    private record CandlePoint(
            String tsUtc,
            BigDecimal open,
            BigDecimal high,
            BigDecimal low,
            BigDecimal close,
            BigDecimal volume
    ) {
    }
}
