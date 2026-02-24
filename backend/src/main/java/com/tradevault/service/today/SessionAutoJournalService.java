package com.tradevault.service.today;

import com.tradevault.domain.entity.SessionAutoTradeEvent;
import com.tradevault.domain.entity.TodaySession;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.AutoJournalState;
import com.tradevault.domain.enums.AutoTradeEventType;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.QuoteSide;
import com.tradevault.dto.session.LiveQuoteResponse;
import com.tradevault.dto.session.QuoteAvailabilityReason;
import com.tradevault.dto.session.SessionAutoJournalArmRequest;
import com.tradevault.dto.session.SessionAutoJournalStatusDto;
import com.tradevault.repository.SessionAutoTradeEventRepository;
import com.tradevault.repository.TodaySessionRepository;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.QuoteService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class SessionAutoJournalService {
    private static final BigDecimal DEFAULT_TOLERANCE_PIPS = BigDecimal.ZERO;
    private static final int DEFAULT_TIMEOUT_MINUTES = 30;
    private static final int MAX_TIMEOUT_MINUTES = 24 * 60;

    private final TodaySessionRepository todaySessionRepository;
    private final SessionAutoTradeEventRepository sessionAutoTradeEventRepository;
    private final CurrentUserService currentUserService;
    private final QuoteService quoteService;

    @Transactional
    public SessionAutoJournalStatusDto arm(UUID sessionId, SessionAutoJournalArmRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSession(user, sessionId);

        String symbol = normalizeSymbol(request == null ? null : request.getSymbol());
        if (symbol == null) {
            throw new IllegalArgumentException("Set a symbol before arming auto journal.");
        }
        Direction side = request == null ? null : request.getSide();
        if (side == null) {
            throw new IllegalArgumentException("Direction is required before arming auto journal.");
        }

        BigDecimal entry = normalizePositivePrice(request == null ? null : request.getEntry(), "Entry");
        BigDecimal sl = normalizePositivePrice(request == null ? null : request.getSl(), "Stop loss");
        BigDecimal tp = normalizePositivePrice(request == null ? null : request.getTp(), "Take profit");
        BigDecimal tolerancePips = normalizeTolerancePips(request == null ? null : request.getTolerancePips());
        int timeoutMinutes = normalizeTimeoutMinutes(request == null ? null : request.getTimeoutMin());

        LiveQuoteResponse quote = quoteService.getLiveQuoteForUser(user.getId(), symbol);
        if (!quote.isAvailable() || quote.getBid() == null || quote.getAsk() == null) {
            String quoteReason = normalizeReason(quote.getReason());
            throw new IllegalArgumentException("Auto journal needs bid/ask quotes. " + quoteReason);
        }

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        session.setAutoJournalState(AutoJournalState.ARMED);
        session.setAutoJournalSymbol(symbol);
        session.setAutoJournalSide(side);
        session.setAutoJournalEntryPrice(entry);
        session.setAutoJournalSlPrice(sl);
        session.setAutoJournalTpPrice(tp);
        session.setAutoJournalTolerancePips(tolerancePips);
        session.setAutoJournalTimeoutMin(timeoutMinutes);
        session.setAutoJournalArmedAt(now);
        session.setAutoJournalLastError(null);
        session.setAutoJournalLastEventAt(now);
        todaySessionRepository.save(session);

        logEvent(session, AutoTradeEventType.ARMED, null, null, "Auto journal armed.");
        return toStatusDto(session, quote);
    }

    @Transactional
    public SessionAutoJournalStatusDto disarm(UUID sessionId) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSession(user, sessionId);
        return disarmSession(session, "Auto journal disarmed.");
    }

    @Transactional(readOnly = true)
    public SessionAutoJournalStatusDto getStatus(UUID sessionId) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireSession(user, sessionId);
        LiveQuoteResponse quote = loadQuote(session);
        return toStatusDto(session, quote);
    }

    @Scheduled(fixedDelayString = "${session.auto-journal.poll-ms:500}")
    @Transactional
    public void monitorArmedSessions() {
        List<TodaySession> sessions = todaySessionRepository.findByAutoJournalStateIn(
                List.of(AutoJournalState.ARMED, AutoJournalState.ACTIVE)
        );
        if (sessions.isEmpty()) {
            return;
        }

        for (TodaySession session : sessions) {
            try {
                processSessionTick(session);
            } catch (Exception ex) {
                log.warn("Auto journal monitor failed [sessionId={}]: {}", session.getId(), ex.getMessage());
                session.setAutoJournalLastError("Auto journal monitor error: " + ex.getMessage());
                todaySessionRepository.save(session);
                logEvent(session, AutoTradeEventType.ERROR, null, null, ex.getMessage());
            }
        }
    }

    private void processSessionTick(TodaySession session) {
        AutoJournalState state = session.getAutoJournalState();
        if (state != AutoJournalState.ARMED && state != AutoJournalState.ACTIVE) {
            return;
        }

        if (session.getAutoJournalSymbol() == null || session.getAutoJournalSide() == null) {
            disarmSession(session, "Auto journal config invalidated. Disarmed.");
            return;
        }

        LiveQuoteResponse quote = loadQuote(session);
        if (!quote.isAvailable() || quote.getBid() == null || quote.getAsk() == null) {
            session.setAutoJournalLastError(normalizeReason(quote.getReason()));
            todaySessionRepository.save(session);
            return;
        }

        if (state == AutoJournalState.ARMED && isTimedOut(session, OffsetDateTime.now(ZoneOffset.UTC))) {
            disarmSession(session, "Auto journal disarmed after timeout.");
            logEvent(session, AutoTradeEventType.TIMEOUT, null, null, "Auto journal disarmed after timeout.");
            return;
        }

        BigDecimal tolerance = toTolerancePoints(session.getAutoJournalSymbol(), session.getAutoJournalTolerancePips());
        Direction side = session.getAutoJournalSide();

        if (state == AutoJournalState.ARMED) {
            if (isEntryTouched(side, quote, session.getAutoJournalEntryPrice(), tolerance)) {
                QuoteSide fillSide = side == Direction.LONG ? QuoteSide.ASK : QuoteSide.BID;
                BigDecimal fillPrice = fillSide == QuoteSide.ASK ? quote.getAsk() : quote.getBid();
                session.setAutoJournalState(AutoJournalState.ACTIVE);
                session.setAutoJournalLastError(null);
                session.setAutoJournalLastEventAt(OffsetDateTime.now(ZoneOffset.UTC));
                todaySessionRepository.save(session);
                logEvent(session, AutoTradeEventType.ENTRY_FILLED, fillSide, fillPrice, "Entry touched.");
            }
            return;
        }

        boolean slTouched = isStopLossTouched(side, quote, session.getAutoJournalSlPrice(), tolerance);
        boolean tpTouched = isTakeProfitTouched(side, quote, session.getAutoJournalTpPrice(), tolerance);
        if (!slTouched && !tpTouched) {
            return;
        }

        AutoTradeEventType outcome = slTouched ? AutoTradeEventType.SL_HIT : AutoTradeEventType.TP_HIT;
        QuoteSide closeSide = side == Direction.LONG ? QuoteSide.BID : QuoteSide.ASK;
        BigDecimal closePrice = closeSide == QuoteSide.ASK ? quote.getAsk() : quote.getBid();

        session.setAutoJournalState(AutoJournalState.CLOSED);
        session.setAutoJournalLastError(null);
        session.setAutoJournalLastEventAt(OffsetDateTime.now(ZoneOffset.UTC));
        todaySessionRepository.save(session);
        logEvent(session, outcome, closeSide, closePrice, slTouched ? "Stop loss touched." : "Take profit touched.");
    }

    private SessionAutoJournalStatusDto disarmSession(TodaySession session, String note) {
        session.setAutoJournalState(AutoJournalState.DISARMED);
        session.setAutoJournalArmedAt(null);
        session.setAutoJournalLastError(null);
        session.setAutoJournalLastEventAt(OffsetDateTime.now(ZoneOffset.UTC));
        todaySessionRepository.save(session);
        logEvent(session, AutoTradeEventType.DISARMED, null, null, note);
        LiveQuoteResponse quote = loadQuote(session);
        return toStatusDto(session, quote);
    }

    private LiveQuoteResponse loadQuote(TodaySession session) {
        if (session.getAutoJournalSymbol() == null || session.getAutoJournalSymbol().isBlank()) {
            return LiveQuoteResponse.builder()
                    .symbol("")
                    .source("OANDA")
                    .available(false)
                    .reason(QuoteAvailabilityReason.SYMBOL_NOT_SUPPORTED)
                    .build();
        }
        try {
            return quoteService.getLiveQuoteForUser(session.getUser().getId(), session.getAutoJournalSymbol());
        } catch (IllegalArgumentException ex) {
            return LiveQuoteResponse.builder()
                    .symbol(session.getAutoJournalSymbol())
                    .source("OANDA")
                    .available(false)
                    .reason(QuoteAvailabilityReason.SYMBOL_NOT_SUPPORTED)
                    .build();
        }
    }

    private SessionAutoJournalStatusDto toStatusDto(TodaySession session, LiveQuoteResponse quote) {
        return SessionAutoJournalStatusDto.builder()
                .sessionId(session.getId())
                .state(defaultState(session.getAutoJournalState()))
                .symbol(session.getAutoJournalSymbol())
                .side(session.getAutoJournalSide())
                .entry(session.getAutoJournalEntryPrice())
                .sl(session.getAutoJournalSlPrice())
                .tp(session.getAutoJournalTpPrice())
                .tolerancePips(session.getAutoJournalTolerancePips())
                .timeoutMin(session.getAutoJournalTimeoutMin())
                .armedAt(session.getAutoJournalArmedAt())
                .lastEventAt(session.getAutoJournalLastEventAt())
                .lastError(session.getAutoJournalLastError())
                .quoteAvailable(quote.isAvailable() && quote.getBid() != null && quote.getAsk() != null)
                .quoteReason(quote.getReason() == null ? null : quote.getReason().name())
                .bid(quote.getBid())
                .ask(quote.getAsk())
                .spread(quote.getSpread())
                .quoteTsUtc(quote.getTsUtc())
                .quoteSource(quote.getSource())
                .build();
    }

    private void logEvent(TodaySession session,
                          AutoTradeEventType type,
                          QuoteSide side,
                          BigDecimal price,
                          String note) {
        SessionAutoTradeEvent event = SessionAutoTradeEvent.builder()
                .todaySession(session)
                .user(session.getUser())
                .trade(null)
                .eventType(type)
                .priceSide(side)
                .price(price == null ? null : price.setScale(8, RoundingMode.HALF_UP))
                .note(trimToNull(note))
                .build();
        sessionAutoTradeEventRepository.save(event);
    }

    private boolean isEntryTouched(Direction side, LiveQuoteResponse quote, BigDecimal entry, BigDecimal tolerance) {
        if (entry == null || quote.getAsk() == null || quote.getBid() == null) {
            return false;
        }
        if (side == Direction.LONG) {
            return quote.getAsk().compareTo(entry.subtract(tolerance)) >= 0;
        }
        return quote.getBid().compareTo(entry.add(tolerance)) <= 0;
    }

    private boolean isStopLossTouched(Direction side, LiveQuoteResponse quote, BigDecimal sl, BigDecimal tolerance) {
        if (sl == null || quote.getAsk() == null || quote.getBid() == null) {
            return false;
        }
        if (side == Direction.LONG) {
            return quote.getBid().compareTo(sl.add(tolerance)) <= 0;
        }
        return quote.getAsk().compareTo(sl.subtract(tolerance)) >= 0;
    }

    private boolean isTakeProfitTouched(Direction side, LiveQuoteResponse quote, BigDecimal tp, BigDecimal tolerance) {
        if (tp == null || quote.getAsk() == null || quote.getBid() == null) {
            return false;
        }
        if (side == Direction.LONG) {
            return quote.getBid().compareTo(tp.subtract(tolerance)) >= 0;
        }
        return quote.getAsk().compareTo(tp.add(tolerance)) <= 0;
    }

    private boolean isTimedOut(TodaySession session, OffsetDateTime nowUtc) {
        OffsetDateTime armedAt = session.getAutoJournalArmedAt();
        if (armedAt == null) {
            return false;
        }
        int timeoutMinutes = normalizeTimeoutMinutes(session.getAutoJournalTimeoutMin());
        return armedAt.plusMinutes(timeoutMinutes).isBefore(nowUtc);
    }

    private BigDecimal toTolerancePoints(String symbol, BigDecimal tolerancePips) {
        BigDecimal pips = tolerancePips == null ? DEFAULT_TOLERANCE_PIPS : tolerancePips;
        return inferPipSize(symbol).multiply(pips).setScale(8, RoundingMode.HALF_UP);
    }

    private BigDecimal inferPipSize(String symbolRaw) {
        String symbol = normalizeSymbol(symbolRaw);
        if (symbol == null) {
            return BigDecimal.valueOf(0.0001);
        }
        if (symbol.contains("JPY")) {
            return BigDecimal.valueOf(0.01);
        }
        if (symbol.contains("XAU") || symbol.contains("XAG")) {
            return BigDecimal.valueOf(0.1);
        }
        return BigDecimal.valueOf(0.0001);
    }

    private TodaySession requireSession(User user, UUID sessionId) {
        return todaySessionRepository.findByIdAndUser_Id(sessionId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Session not found"));
    }

    private String normalizeSymbol(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return normalized.isBlank() ? null : normalized;
    }

    private BigDecimal normalizePositivePrice(BigDecimal value, String label) {
        if (value == null || value.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException(label + " is required before arming auto journal.");
        }
        return value.setScale(8, RoundingMode.HALF_UP);
    }

    private BigDecimal normalizeTolerancePips(BigDecimal value) {
        if (value == null) {
            return DEFAULT_TOLERANCE_PIPS;
        }
        if (value.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Tolerance must be >= 0.");
        }
        return value.setScale(4, RoundingMode.HALF_UP);
    }

    private int normalizeTimeoutMinutes(Integer value) {
        int resolved = value == null ? DEFAULT_TIMEOUT_MINUTES : value;
        if (resolved <= 0 || resolved > MAX_TIMEOUT_MINUTES) {
            throw new IllegalArgumentException("Timeout must be between 1 and " + MAX_TIMEOUT_MINUTES + " minutes.");
        }
        return resolved;
    }

    private AutoJournalState defaultState(AutoJournalState state) {
        return state == null ? AutoJournalState.DISARMED : state;
    }

    private String normalizeReason(QuoteAvailabilityReason reason) {
        if (reason == null || reason == QuoteAvailabilityReason.OK) {
            return "Spread unavailable for this symbol";
        }
        return switch (reason) {
            case NO_PROVIDER -> "Quotes provider is not configured";
            case NO_CREDENTIALS -> "Quotes credentials are missing or invalid";
            case SYMBOL_NOT_SUPPORTED -> "Spread unavailable for this symbol";
            case RATE_LIMIT -> "Quotes rate limit reached";
            case UPSTREAM_ERROR -> "Quotes provider is unavailable";
            case OK -> "Spread unavailable for this symbol";
        };
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
