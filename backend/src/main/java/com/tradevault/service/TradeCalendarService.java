package com.tradevault.service;

import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.PnlBasis;
import com.tradevault.dto.trade.DailyPnlResponse;
import com.tradevault.dto.trade.MonthlyPnlSummaryResponse;
import com.tradevault.repository.TradeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class TradeCalendarService {
    private static final Logger log = LoggerFactory.getLogger(TradeCalendarService.class);

    private final TradeRepository tradeRepository;
    private final CurrentUserService currentUserService;
    private final TimezoneService timezoneService;

    public List<DailyPnlResponse> fetchDailyPnl(LocalDate from, LocalDate to, String tz, PnlBasis basis) {
        User user = currentUserService.getCurrentUser();
        ZoneId zone = timezoneService.resolveZone(tz, user);
        String statusExpectation = (basis == PnlBasis.CLOSE) ? "CLOSED" : "OPEN";
        /*log.info("[CALENDAR] fetchDailyPnl userId={}, from={}, to={}, tz={}, basis={}, statusExpectation={}",
                user.getId(), from, to, zone.getId(), basis, statusExpectation);*/

        List<TradeRepository.DailyPnlAggregate> aggregates = switch (basis) {
            case OPEN -> tradeRepository.aggregateDailyPnlByOpenedDate(user.getId(), from, to, zone.getId());
            case CLOSE -> tradeRepository.aggregateDailyPnlByClosedDate(user.getId(), from, to, zone.getId());
        };

        /*log.info("[CALENDAR] fetchDailyPnl result size={}", (aggregates != null ? aggregates.size() : 0));*/

        return aggregates.stream()
                .map(row -> new DailyPnlResponse(
                        row.getDate(),
                        row.getNetPnl(),
                        row.getTradeCount(),
                        row.getWins(),
                        row.getLosses()
                ))
                .toList();
    }

    public MonthlyPnlSummaryResponse fetchMonthlySummary(int year, int month, String tz, PnlBasis basis) {
        User user = currentUserService.getCurrentUser();
        ZoneId zone = timezoneService.resolveZone(tz, user);
        LocalDate monthStart = LocalDate.of(year, month, 1);
        LocalDate monthEnd = monthStart.with(TemporalAdjusters.lastDayOfMonth());

        TradeRepository.MonthlyPnlAggregate aggregate = switch (basis) {
            case CLOSE -> tradeRepository.aggregateMonthlyPnlByClosedDate(user.getId(), monthStart, monthEnd, zone.getId());
            case OPEN -> throw new IllegalArgumentException("Monthly summary supports CLOSE basis only");
        };

        BigDecimal netPnl = aggregate != null && aggregate.getNetPnl() != null ? aggregate.getNetPnl() : BigDecimal.ZERO;
        BigDecimal grossPnl = aggregate != null && aggregate.getGrossPnl() != null ? aggregate.getGrossPnl() : BigDecimal.ZERO;
        long tradeCount = aggregate != null ? aggregate.getTradeCount() : 0;
        long tradingDays = aggregate != null ? aggregate.getTradingDays() : 0;

        return new MonthlyPnlSummaryResponse(
                year,
                month,
                zone.getId(),
                netPnl,
                grossPnl,
                tradeCount,
                tradingDays
        );
    }
}
