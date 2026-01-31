package com.tradevault.service;

import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.PnlBasis;
import com.tradevault.dto.trade.DailyPnlResponse;
import com.tradevault.repository.TradeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TradeCalendarService {
    private final TradeRepository tradeRepository;
    private final CurrentUserService currentUserService;
    private final TimezoneService timezoneService;

    public List<DailyPnlResponse> fetchDailyPnl(LocalDate from, LocalDate to, String tz, PnlBasis basis) {
        User user = currentUserService.getCurrentUser();
        ZoneId zone = timezoneService.resolveZone(tz, user);
        List<TradeRepository.DailyPnlAggregate> aggregates = switch (basis) {
            case OPEN -> tradeRepository.aggregateDailyPnlByOpenedDate(user.getId(), from, to, zone.getId());
            case CLOSE -> tradeRepository.aggregateDailyPnlByClosedDate(user.getId(), from, to, zone.getId());
        };
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
