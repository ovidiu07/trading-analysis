package com.tradevault.service.signalintel;

import com.tradevault.dto.signalintel.SignalAnalyticsSummaryResponse;
import com.tradevault.dto.signalintel.SignalBreakdownResponse;
import com.tradevault.dto.signalintel.SignalRecommendationListResponse;
import com.tradevault.dto.signalintel.SignalSymbolTimeframeResponse;

import java.time.OffsetDateTime;

public interface SignalAnalyticsService {
    SignalAnalyticsSummaryResponse summary(OffsetDateTime from,
                                          OffsetDateTime to,
                                          String symbol,
                                          String timeframe);

    SignalRecommendationListResponse recommendations(String symbol,
                                                     String timeframe,
                                                     String regime);

    SignalBreakdownResponse bySetup(OffsetDateTime from,
                                    OffsetDateTime to,
                                    String symbol,
                                    String timeframe);

    SignalBreakdownResponse byRegime(OffsetDateTime from,
                                     OffsetDateTime to,
                                     String symbol,
                                     String timeframe);

    SignalSymbolTimeframeResponse bySymbolTimeframe(OffsetDateTime from,
                                                    OffsetDateTime to);
}
