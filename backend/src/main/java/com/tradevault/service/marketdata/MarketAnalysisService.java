package com.tradevault.service.marketdata;

import com.tradevault.dto.market.MarketWorkspaceResponse.AnalysisMetrics;
import com.tradevault.dto.market.MarketWorkspaceResponse.AnalysisRange;
import com.tradevault.dto.market.MarketWorkspaceResponse.AvailabilityReason;
import com.tradevault.dto.market.MarketWorkspaceResponse.Freshness;
import com.tradevault.service.backtest.BacktestCandle;
import com.tradevault.domain.enums.BacktestTimeframe;
import com.tradevault.service.backtest.CanonicalCandle;
import com.tradevault.service.backtest.OandaCandleProvider;
import com.tradevault.service.backtest.OandaEnvironment;
import com.tradevault.exception.BacktestDomainException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class MarketAnalysisService {
    private static final ZoneId DAILY_ALIGNMENT_ZONE = ZoneId.of("America/New_York");
    private static final Duration CACHE_TTL = Duration.ofMinutes(2);
    private static final String ALIGNMENT = "17:00 America/New_York";
    private final OandaCandleProvider oanda;
    private final Map<String, CachedCandles> cache = new ConcurrentHashMap<>();

    @Value("${marketdata.oanda-candle-derivations-enabled:false}")
    private boolean derivationsEnabled;

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public AnalysisMetrics analyze(UUID userId, UUID workspaceAccountId, String token, String providerAccountId,
                                   OandaEnvironment environment, String canonicalInstrument, String providerSymbol,
                                   LocalDate workspaceDate, OandaCandleProvider.OandaQuote currentQuote) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if (!derivationsEnabled) return unavailable(canonicalInstrument, providerSymbol, now, AvailabilityReason.LICENSE_REQUIRED);
        try {
            String cacheKey = userId + "|" + workspaceAccountId + "|" + environment + "|" + providerAccountId + "|" + providerSymbol + "|" + workspaceDate;
            CachedCandles cached = cache.get(cacheKey);
            if (cached == null || Duration.between(cached.retrievedAt(), now).compareTo(CACHE_TTL) >= 0) {
                cache.entrySet().removeIf(entry -> Duration.between(entry.getValue().retrievedAt(), now).compareTo(Duration.ofMinutes(10)) > 0);
                OffsetDateTime from = workspaceDate.minusDays(3).atStartOfDay(ZoneOffset.UTC).toOffsetDateTime();
                OffsetDateTime to = workspaceDate.plusDays(2).atStartOfDay(ZoneOffset.UTC).toOffsetDateTime();
                List<CanonicalCandle> m5 = oanda.getCandles(token, providerAccountId, canonicalInstrument,
                        canonicalInstrument, BacktestTimeframe.M5, from, to, environment);
                List<CanonicalCandle> daily = oanda.getCandles(token, providerAccountId, canonicalInstrument,
                        canonicalInstrument, BacktestTimeframe.D1, from.minusDays(10), to, environment);
                cached = new CachedCandles(now, m5, daily);
                cache.put(cacheKey, cached);
            }
            return calculate(canonicalInstrument, providerSymbol, workspaceDate, currentQuote, cached, now);
        } catch (RuntimeException ex) {
            AvailabilityReason reason = ex instanceof BacktestDomainException domain && domain.getStatus().value() == 429
                    ? AvailabilityReason.RATE_LIMIT
                    : ex instanceof BacktestDomainException domain && domain.getStatus().is5xxServerError()
                    ? AvailabilityReason.UPSTREAM_TIMEOUT : AvailabilityReason.UPSTREAM_ERROR;
            return unavailable(canonicalInstrument, providerSymbol, now, reason);
        }
    }

    private AnalysisMetrics calculate(String canonical, String providerSymbol, LocalDate date,
                                      OandaCandleProvider.OandaQuote quote, CachedCandles data, OffsetDateTime now) {
        Instant dayStart = date.minusDays(1).atTime(17, 0).atZone(DAILY_ALIGNMENT_ZONE).toInstant();
        Instant dayEnd = date.atTime(17, 0).atZone(DAILY_ALIGNMENT_ZONE).toInstant();
        List<BacktestCandle> providerDayBars = data.m5().stream().map(CanonicalCandle::toBacktestCandle)
                .filter(candle -> !candle.timestamp().toInstant().isBefore(dayStart) && candle.timestamp().toInstant().isBefore(dayEnd))
                .sorted(Comparator.comparing(BacktestCandle::timestamp)).toList();
        BacktestCandle openBar = providerDayBars.isEmpty() ? null : providerDayBars.get(0);
        CanonicalCandle previousDaily = data.daily().stream().filter(candle -> candle.tsUtc().toInstant().isBefore(dayStart))
                .max(Comparator.comparing(CanonicalCandle::tsUtc)).orElse(null);
        BigDecimal previousClose = previousDaily == null ? null : previousDaily.close();
        BigDecimal changePercent = null;
        BigDecimal currentMid = quote == null || quote.bid() == null || quote.ask() == null ? null
                : quote.bid().add(quote.ask()).divide(BigDecimal.valueOf(2), 8, RoundingMode.HALF_UP);
        if (quote != null && "MID".equals(quote.priceBasis()) && quote.tsUtc() != null && currentMid != null
                && previousClose != null && previousClose.signum() != 0) {
            changePercent = currentMid.subtract(previousClose).multiply(BigDecimal.valueOf(100))
                    .divide(previousClose, 6, RoundingMode.HALF_UP);
        }
        List<BacktestCandle> m5 = data.m5().stream().map(CanonicalCandle::toBacktestCandle).toList();
        var asia = range(AnalysisWindowCalculator.calculate(AnalysisWindowCalculator.ASIA, date, m5, now.toInstant()));
        var london = range(AnalysisWindowCalculator.calculate(AnalysisWindowCalculator.LONDON, date, m5, now.toInstant()));
        return new AnalysisMetrics(canonical, "OANDA", providerSymbol, "https://developer.oanda.com/rest-live-v20/instrument-ep/",
                quote == null ? null : quote.priceBasis(),
                ALIGNMENT, openBar == null ? null : openBar.open(), openBar == null ? null : openBar.timestamp(),
                previousClose, previousDaily == null ? null : previousDaily.tsUtc(), changePercent,
                previousDaily == null ? null : previousDaily.high(), previousDaily == null ? null : previousDaily.low(),
                previousDaily == null ? null : previousDaily.tsUtc().toLocalDate(), asia, london,
                AnalysisWindowCalculator.currentWindow(now.toInstant()), now, Freshness.CLOSE,
                "USER_CONNECTED", previousDaily == null ? AvailabilityReason.NO_COMPLETED_REFERENCE : null);
    }

    private AnalysisRange range(AnalysisWindowCalculator.WindowRange range) {
        return new AnalysisRange(range.name(), range.observationDate(), OffsetDateTime.ofInstant(range.startsAt(), ZoneOffset.UTC),
                OffsetDateTime.ofInstant(range.endsAt(), ZoneOffset.UTC), range.high(), range.low(), range.completionState(), range.completedBarCount());
    }

    public AnalysisMetrics unavailable(String canonical, String providerSymbol, OffsetDateTime now, AvailabilityReason reason) {
        return new AnalysisMetrics(canonical, "OANDA", providerSymbol, "https://developer.oanda.com/rest-live-v20/instrument-ep/",
                null, ALIGNMENT, null, null, null, null,
                null, null, null, null, null, null, AnalysisWindowCalculator.currentWindow(now.toInstant()), now,
                Freshness.UNAVAILABLE, "USER_CONNECTED", reason);
    }

    private record CachedCandles(OffsetDateTime retrievedAt, List<CanonicalCandle> m5, List<CanonicalCandle> daily) {}
}
