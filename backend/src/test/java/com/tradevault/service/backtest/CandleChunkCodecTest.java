package com.tradevault.service.backtest;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CandleChunkCodecTest {

    @Test
    void encodeDecodeRoundTripKeepsCandles() {
        CandleChunkCodec codec = new CandleChunkCodec(new ObjectMapper().findAndRegisterModules());
        List<CanonicalCandle> candles = List.of(
                new CanonicalCandle(
                        BacktestCandleSource.CSV,
                        "dataset-1",
                        "EURUSD",
                        "CSV:EURUSD",
                        BacktestTimeframe.M1,
                        OffsetDateTime.parse("2026-02-01T00:00:00Z"),
                        new BigDecimal("1.1000"),
                        new BigDecimal("1.1010"),
                        new BigDecimal("1.0990"),
                        new BigDecimal("1.1005"),
                        new BigDecimal("100")
                ),
                new CanonicalCandle(
                        BacktestCandleSource.CSV,
                        "dataset-1",
                        "EURUSD",
                        "CSV:EURUSD",
                        BacktestTimeframe.M1,
                        OffsetDateTime.parse("2026-02-01T00:01:00Z"),
                        new BigDecimal("1.1005"),
                        new BigDecimal("1.1015"),
                        new BigDecimal("1.0995"),
                        new BigDecimal("1.1010"),
                        new BigDecimal("120")
                )
        );

        byte[] payload = codec.encode(candles);
        List<CanonicalCandle> decoded = codec.decode(
                payload,
                BacktestCandleSource.CSV,
                "dataset-1",
                "EURUSD",
                "CSV:EURUSD",
                BacktestTimeframe.M1
        );

        assertThat(decoded).hasSize(2);
        assertThat(decoded.get(0).open()).isEqualByComparingTo("1.1000");
        assertThat(decoded.get(1).close()).isEqualByComparingTo("1.1010");
        assertThat(decoded.get(1).volume()).isEqualByComparingTo("120");
    }
}
