package com.tradevault.dto.market;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.util.List;

public record MarketWorkspaceResponse(
        OffsetDateTime retrievedAt,
        String selectedInstrument,
        String providerEnvironment,
        List<InstrumentQuote> quotes,
        List<MacroObservation> macroObservations,
        AnalysisMetrics analysis) {

    public MarketWorkspaceResponse(OffsetDateTime retrievedAt, String selectedInstrument, String providerEnvironment,
                                   List<InstrumentQuote> quotes) {
        this(retrievedAt, selectedInstrument, providerEnvironment, quotes, List.of(), null);
    }
    public MarketWorkspaceResponse(OffsetDateTime retrievedAt, String selectedInstrument, String providerEnvironment,
                                   List<InstrumentQuote> quotes, List<MacroObservation> macroObservations) {
        this(retrievedAt, selectedInstrument, providerEnvironment, quotes, macroObservations, null);
    }

    public enum Freshness { LIVE, INDICATIVE, DELAYED, CLOSE, STALE, MANUAL, UNAVAILABLE }

    public enum AvailabilityReason {
        NO_PROVIDER, NO_CREDENTIALS, PROVIDER_DISCONNECTED, NO_QUOTE, DISPLAY_NOT_AUTHORIZED, SYMBOL_NOT_SUPPORTED,
        MARKET_CLOSED, RATE_LIMIT, UPSTREAM_TIMEOUT, UPSTREAM_ERROR,
        NO_COMPLETED_REFERENCE, NO_PUBLISHED_EVENT_DATA, LICENSE_REQUIRED
    }

    public record InstrumentQuote(
            String canonicalInstrument,
            String provider,
            String providerSymbol,
            String instrumentType,
            String priceBasis,
            BigDecimal bid,
            BigDecimal ask,
            BigDecimal mid,
            BigDecimal spread,
            String unit,
            OffsetDateTime observedAt,
            OffsetDateTime retrievedAt,
            Freshness freshness,
            Boolean tradeable,
            String provenance,
            String sourceUrl,
            String delayDescription,
            AvailabilityReason availabilityReason) {}

    public record MacroObservation(
            String canonicalInstrument,
            String provider,
            String providerSymbol,
            String instrumentType,
            String priceBasis,
            BigDecimal value,
            BigDecimal previousValue,
            BigDecimal changeBasisPoints,
            String unit,
            LocalDate observationDate,
            OffsetDateTime retrievedAt,
            Freshness freshness,
            String provenance,
            String sourceUrl,
            AvailabilityReason availabilityReason) {}

    public record AnalysisMetrics(
            String canonicalInstrument,
            String provider,
            String providerSymbol,
            String sourceUrl,
            String priceBasis,
            String dailyAlignment,
            BigDecimal dailyOpen,
            OffsetDateTime dailyOpenObservedAt,
            BigDecimal previousDailyClose,
            OffsetDateTime previousDailyCloseObservedAt,
            BigDecimal changePercent,
            BigDecimal previousDayHigh,
            BigDecimal previousDayLow,
            LocalDate previousDayDate,
            AnalysisRange asia,
            AnalysisRange london,
            String currentWindow,
            OffsetDateTime retrievedAt,
            Freshness freshness,
            String provenance,
            AvailabilityReason availabilityReason) {}

    public record AnalysisRange(String window, LocalDate observationDate, OffsetDateTime startsAt, OffsetDateTime endsAt,
                                BigDecimal high, BigDecimal low, String completionState, int completedBarCount) {}
}
