package com.tradevault.service;

import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.PnlBasis;
import com.tradevault.dto.trade.DailyPnlResponse;
import com.tradevault.repository.TradeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

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
        log.info("[CALENDAR] fetchDailyPnl userId={}, from={}, to={}, tz={}, basis={}, statusExpectation={}",
                user.getId(), from, to, zone.getId(), basis, statusExpectation);

        List<TradeRepository.DailyPnlAggregate> aggregates = switch (basis) {
            case OPEN -> tradeRepository.aggregateDailyPnlByOpenedDate(user.getId(), from, to, zone.getId());
            case CLOSE -> tradeRepository.aggregateDailyPnlByClosedDate(user.getId(), from, to, zone.getId());
        };

        log.info("[CALENDAR] fetchDailyPnl result size={}", (aggregates != null ? aggregates.size() : 0));

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
}
