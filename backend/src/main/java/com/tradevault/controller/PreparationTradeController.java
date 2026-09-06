package com.tradevault.controller;

import com.tradevault.service.CurrentUserService;
import com.tradevault.service.TradeService;
import com.tradevault.service.today.SessionReviewService;
import com.tradevault.dto.trade.TradeRequest;
import com.tradevault.dto.trade.TradeResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.*;
import java.util.*;

@RestController
@RequestMapping("/api/today/log-trade")
@RequiredArgsConstructor
public class PreparationTradeController {
    private final SessionReviewService reviews;
    private final TradeService trades;
    private final CurrentUserService users;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    public record Request(@NotNull UUID requestId, @NotNull UUID accountId, @NotNull LocalDate date,
        @NotNull String session, Integer preparationRevision, @NotNull @Valid TradeRequest trade) {}

    @GetMapping("/context/{tradeId}")
    public com.fasterxml.jackson.databind.JsonNode context(@PathVariable UUID tradeId) {
        trades.getById(tradeId);
        var rows=jdbc.queryForList("SELECT r.payload::text FROM preparation_trade_links l JOIN session_review_revisions r ON r.id=l.review_id WHERE l.trade_id=? AND l.user_id=?",String.class,tradeId,users.getCurrentUser().getId());
        if(rows.isEmpty()) return mapper.createObjectNode();
        try { return mapper.readTree(rows.get(0)); } catch(com.fasterxml.jackson.core.JsonProcessingException ex) { throw new IllegalStateException(ex); }
    }
    @PostMapping
    @Transactional
    public TradeResponse log(@RequestBody @Valid Request request) {
        UUID userId = users.getCurrentUser().getId();
        reviews.get(request.accountId(), request.date(), request.session());
        jdbc.queryForObject("SELECT id FROM users WHERE id=? FOR UPDATE", UUID.class, userId);
        String payload = mapper.valueToTree(request).toString();
        var previous = jdbc.queryForList("SELECT trade_id FROM preparation_trade_links WHERE user_id=? AND request_id=? AND request_payload=?::jsonb", UUID.class, userId, request.requestId(), payload);
        if (!previous.isEmpty()) return trades.getById(previous.get(0));
        if (Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM preparation_trade_links WHERE user_id=? AND request_id=?)", Boolean.class, userId, request.requestId())))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Retry payload changed; verify the prior trade first");
        UUID reviewId = null;
        if (request.preparationRevision() != null) {
            var ids = jdbc.queryForList("SELECT id FROM session_review_revisions WHERE user_id=? AND account_id=? AND session_date=? AND session_key=? AND revision=? AND jsonb_exists(payload, 'readyContext')", UUID.class, userId, request.accountId(), request.date(), request.session(), request.preparationRevision());
            if (ids.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ready preparation not found");
            reviewId = ids.get(0);
        }
        if (!request.accountId().equals(request.trade().getAccountRefId()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Account must match the selected session; use Trades for another account");
        request.trade().setStrategyVersionId(null);
        request.trade().setContextSnapshotId(null);
        if (reviewId != null && request.trade().getStrategyId() != null) {
            var snapshots = jdbc.queryForList("SELECT payload->'readyContext'->'strategyContext' FROM session_review_revisions WHERE id=?",String.class,reviewId);
            if (!snapshots.isEmpty() && snapshots.get(0) != null) {
                try {
                    var snapshot=mapper.readTree(snapshots.get(0));
                    if (request.trade().getStrategyId().toString().equals(snapshot.path("strategyId").asText()) && snapshot.hasNonNull("versionId")) request.trade().setStrategyVersionId(UUID.fromString(snapshot.path("versionId").asText()));
                } catch (com.fasterxml.jackson.core.JsonProcessingException ex) { throw new IllegalStateException(ex); }
            }
        }
        var trade = trades.createManual(request.trade());
        jdbc.update("INSERT INTO preparation_trade_links(user_id,request_id,request_payload,trade_id,review_id) VALUES (?,?,?::jsonb,?,?)", userId, request.requestId(), payload, trade.getId(), reviewId);
        return trade;
    }
}
