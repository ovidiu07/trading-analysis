package com.tradevault.service.backtest;

import com.tradevault.domain.entity.BacktestDataset;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;
import com.tradevault.dto.backtest.BacktestDatasetResponse;
import com.tradevault.repository.BacktestDatasetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BacktestDemoService {
    private static final String DEMO_SOURCE_ID = "DEMO";

    private final BacktestDatasetRepository datasetRepository;
    private final BacktestDatasetService datasetService;
    private final CandleChunkStoreService candleChunkStoreService;

    @Transactional
    public List<BacktestDatasetResponse> ensureDemoDatasets(User user) {
        List<BacktestDataset> existing = datasetRepository.findByUser_IdAndProviderOrderByCreatedAtDesc(user.getId(), BacktestCandleSource.DEMO);
        if (!existing.isEmpty()) {
            return existing.stream().map(datasetService::toResponse).toList();
        }

        List<BacktestDataset> created = new ArrayList<>();
        created.add(generateDataset(user, "EURUSD", "DEMO:EURUSD", new BigDecimal("1.0870"), new BigDecimal("0.00008"), 5, 1_200));
        created.add(generateDataset(user, "GER40", "DEMO:GER40", new BigDecimal("17620"), new BigDecimal("0.9"), 2, 4_000));
        return created.stream().map(datasetService::toResponse).toList();
    }

    @Transactional
    public void resetDemo(UUID userId) {
        candleChunkStoreService.deleteSource(userId, BacktestCandleSource.DEMO, DEMO_SOURCE_ID);
        datasetRepository.deleteByUser_IdAndProvider(userId, BacktestCandleSource.DEMO);
    }

    private BacktestDataset generateDataset(User user,
                                            String symbolCanonical,
                                            String symbolDisplay,
                                            BigDecimal startPrice,
                                            BigDecimal step,
                                            int scale,
                                            int baseVolume) {
        BacktestTimeframe timeframe = BacktestTimeframe.M5;
        OffsetDateTime from = OffsetDateTime.of(2025, 11, 1, 0, 0, 0, 0, ZoneOffset.UTC);
        int bars = 60 * 24 * 12;

        Random random = new Random(symbolCanonical.hashCode());
        BigDecimal previousClose = startPrice;
        List<CanonicalCandle> candles = new ArrayList<>(bars);

        for (int i = 0; i < bars; i++) {
            OffsetDateTime ts = from.plusMinutes(5L * i);
            BigDecimal seasonal = step.multiply(BigDecimal.valueOf(Math.sin(i / 55.0) * 1.8 + Math.cos(i / 233.0) * 0.7));
            BigDecimal noise = step.multiply(BigDecimal.valueOf((random.nextDouble() - 0.5) * 2.3));
            BigDecimal drift = step.multiply(BigDecimal.valueOf(i % 1440 < 720 ? 0.12 : -0.09));

            BigDecimal open = previousClose;
            BigDecimal close = open.add(seasonal).add(noise).add(drift).setScale(scale, RoundingMode.HALF_UP);
            BigDecimal highWick = step.multiply(BigDecimal.valueOf(0.8 + random.nextDouble() * 1.4));
            BigDecimal lowWick = step.multiply(BigDecimal.valueOf(0.8 + random.nextDouble() * 1.4));
            BigDecimal high = open.max(close).add(highWick).setScale(scale, RoundingMode.HALF_UP);
            BigDecimal low = open.min(close).subtract(lowWick).setScale(scale, RoundingMode.HALF_UP);
            if (low.compareTo(BigDecimal.ZERO) <= 0) {
                low = step;
            }

            BigDecimal volume = BigDecimal.valueOf(baseVolume + (int) (Math.abs(Math.sin(i / 18.0)) * baseVolume * 0.35) + random.nextInt(120));

            candles.add(new CanonicalCandle(
                    BacktestCandleSource.DEMO,
                    DEMO_SOURCE_ID,
                    symbolCanonical,
                    symbolDisplay,
                    timeframe,
                    ts,
                    open,
                    high,
                    low,
                    close,
                    volume
            ));
            previousClose = close;
        }

        candleChunkStoreService.saveCandles(
                user.getId(),
                BacktestCandleSource.DEMO,
                DEMO_SOURCE_ID,
                symbolCanonical,
                symbolDisplay,
                timeframe,
                candles
        );

        return datasetService.upsertDataset(
                user,
                BacktestCandleSource.DEMO,
                DEMO_SOURCE_ID,
                "Demo %s %s".formatted(symbolCanonical, timeframe.name()),
                symbolCanonical,
                symbolDisplay,
                timeframe,
                candles.get(0).tsUtc(),
                candles.get(candles.size() - 1).tsUtc(),
                candles.size(),
                List.of()
        );
    }
}
