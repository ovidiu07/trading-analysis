package com.tradevault.service;

import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.TradeSource;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.trade.TradeDataDeletionPreviewResponse;
import com.tradevault.dto.trade.TradeDataDeletionRequest;
import com.tradevault.dto.trade.TradeDataDeletionResponse;
import com.tradevault.repository.AccountRepository;
import com.tradevault.repository.NotebookNoteRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.service.backtesting.LiveTradeEvidenceChangedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TradeDataManagementService {
    private final CurrentUserService currentUserService;
    private final AccountRepository accountRepository;
    private final TradeRepository tradeRepository;
    private final NotebookNoteRepository notebookNoteRepository;
    private final TimezoneService timezoneService;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public TradeDataDeletionPreviewResponse preview(TradeDataDeletionRequest request) {
        User user = currentUserService.getCurrentUser();
        Account account = ownedAccount(request.accountId(), user.getId());
        DeletionSelection selection = select(request, user, account);
        return toPreview(request, account, selection);
    }

    @Transactional
    public TradeDataDeletionResponse delete(TradeDataDeletionRequest request) {
        if (!request.confirmed()) {
            throw badRequest("Explicit deletion confirmation is required");
        }
        User user = currentUserService.getCurrentUser();
        Account account = ownedAccount(request.accountId(), user.getId());
        if (request.scope() == TradeDataDeletionRequest.Scope.ENTIRE_HISTORY
                && !Objects.equals(account.getName(), normalize(request.confirmationText()))) {
            throw badRequest("Type the selected account name exactly to delete its entire trade history");
        }

        DeletionSelection selection = select(request, user, account);
        String expectedToken = token(user.getId(), account.getId(), request.scope(), selection);
        if (request.previewToken() == null || !MessageDigest.isEqual(
                expectedToken.getBytes(StandardCharsets.US_ASCII),
                request.previewToken().getBytes(StandardCharsets.US_ASCII))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "The deletion preview is stale. Preview the operation again before confirming.");
        }

        List<UUID> deletedIds = selection.trades().stream().map(Trade::getId).toList();
        tradeRepository.deleteAll(selection.trades());
        tradeRepository.flush();
        deletedIds.forEach(tradeId ->
                eventPublisher.publishEvent(new LiveTradeEvidenceChangedEvent(tradeId, user.getId(), true)));

        OffsetDateTime deletedAt = OffsetDateTime.now();
        log.warn("Account trade history deleted userId={} accountId={} scope={} trades={} realizedPnl={} from={} to={}",
                user.getId(), account.getId(), request.scope(), selection.trades().size(),
                selection.realizedPnl(), selection.startInclusive(), selection.endExclusive());
        return new TradeDataDeletionResponse(account.getId(), account.getName(), selection.trades().size(),
                selection.realizedPnl(), deletedAt);
    }

    private DeletionSelection select(TradeDataDeletionRequest request, User user, Account account) {
        if (request.scope() == null) throw badRequest("Deletion scope is required");
        ZoneId zone = timezoneService.resolveZone(firstNonBlank(request.timezone(), account.getBrokerTimezone()), user);
        List<Trade> trades;
        OffsetDateTime startInclusive = null;
        OffsetDateTime endExclusive = null;
        if (request.scope() == TradeDataDeletionRequest.Scope.DATE_RANGE) {
            if (request.startDate() == null || request.endDate() == null) {
                throw badRequest("Start date and end date are required");
            }
            if (request.endDate().isBefore(request.startDate())) {
                throw badRequest("End date must be on or after start date");
            }
            startInclusive = request.startDate().atStartOfDay(zone).toOffsetDateTime();
            endExclusive = request.endDate().plusDays(1).atStartOfDay(zone).toOffsetDateTime();
            trades = tradeRepository
                    .findByUserIdAndAccountIdAndClosedAtGreaterThanEqualAndClosedAtLessThanOrderByClosedAtAsc(
                            user.getId(), account.getId(), startInclusive, endExclusive);
        } else {
            trades = tradeRepository.findByUserIdAndAccountIdOrderByOpenedAtAsc(user.getId(), account.getId());
        }
        BigDecimal realizedPnl = trades.stream()
                .filter(trade -> trade.getStatus() == TradeStatus.CLOSED)
                .map(Trade::getPnlNet)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<UUID> ids = trades.stream().map(Trade::getId).toList();
        long linkedNotes = ids.isEmpty() ? 0
                : notebookNoteRepository.countByUserIdAndRelatedTrade_IdInAndIsDeletedFalse(user.getId(), ids);
        return new DeletionSelection(List.copyOf(trades), zone, startInclusive, endExclusive,
                realizedPnl, linkedNotes);
    }

    private TradeDataDeletionPreviewResponse toPreview(
            TradeDataDeletionRequest request, Account account, DeletionSelection selection) {
        Comparator<OffsetDateTime> comparator = Comparator.naturalOrder();
        OffsetDateTime earliest = selection.trades().stream().map(TradeDataManagementService::effectiveTimestamp)
                .filter(Objects::nonNull).min(comparator).orElse(null);
        OffsetDateTime latest = selection.trades().stream().map(TradeDataManagementService::effectiveTimestamp)
                .filter(Objects::nonNull).max(comparator).orElse(null);
        Map<TradeSource, Long> distribution = selection.trades().stream().collect(Collectors.groupingBy(
                trade -> trade.getSource() == null ? TradeSource.MANUAL : trade.getSource(),
                LinkedHashMap::new,
                Collectors.counting()));
        String previewToken = token(account.getUser().getId(), account.getId(), request.scope(), selection);
        return new TradeDataDeletionPreviewResponse(
                account.getId(), account.getName(), request.scope(), request.startDate(), request.endDate(),
                selection.zone().getId(), selection.trades().size(), earliest, latest, selection.realizedPnl(),
                selection.linkedNotes(), distribution, previewToken);
    }

    private Account ownedAccount(UUID accountId, UUID userId) {
        return accountRepository.findByIdAndUserId(accountId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Trading account was not found"));
    }

    private static String token(UUID userId, UUID accountId, TradeDataDeletionRequest.Scope scope,
                                DeletionSelection selection) {
        String tradeIds = selection.trades().stream().map(Trade::getId).sorted()
                .map(UUID::toString).collect(Collectors.joining(","));
        String value = String.join("|", userId.toString(), accountId.toString(), scope.name(),
                selection.zone().getId(), String.valueOf(selection.startInclusive()),
                String.valueOf(selection.endExclusive()), tradeIds);
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    private static OffsetDateTime effectiveTimestamp(Trade trade) {
        if (trade.getClosedAt() != null) return trade.getClosedAt();
        if (trade.getOpenedAt() != null) return trade.getOpenedAt();
        return trade.getCreatedAt();
    }

    private static String firstNonBlank(String primary, String fallback) {
        return primary == null || primary.isBlank() ? fallback : primary;
    }

    private static String normalize(String value) {
        return value == null ? null : value.trim();
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private record DeletionSelection(
            List<Trade> trades,
            ZoneId zone,
            OffsetDateTime startInclusive,
            OffsetDateTime endExclusive,
            BigDecimal realizedPnl,
            long linkedNotes
    ) {
    }
}
