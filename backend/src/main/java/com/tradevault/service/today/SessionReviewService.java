package com.tradevault.service.today;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.domain.entity.Account;
import com.tradevault.repository.AccountRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.repository.UserStrategyRepository;
import com.tradevault.service.CurrentUserService;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SessionReviewService {
    private final CurrentUserService currentUserService;
    private final AccountRepository accounts;
    private final TradeRepository trades;
    private final UserStrategyRepository strategies;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public record Assessment(@NotNull UUID tradeId, @NotNull @Pattern(regexp="FOLLOWED|DEVIATED|CANNOT_ASSESS") String decision,
                             @Size(max=2000) String note) {}
    public record Request(@NotNull @Min(0) Integer revision,
                          @NotNull @Pattern(regexp="PREPARE|TRADE|REVIEW|COMPLETE") String state,
                          @Size(max=500) String instruments, UUID strategyId,
                          @Size(max=2000) String focus, @Size(max=2000) String nextFocus,
                          @Pattern(regexp="REPEAT|CHANGE|COLLECT") String carryForward,
                          @Size(max=500) List<@jakarta.validation.Valid Assessment> assessments) {}
    public record Response(int revision, JsonNode data) {}

    private Account account(UUID accountId) {
        return accounts.findByIdAndUserId(accountId, currentUserService.getCurrentUser().getId())
                .orElseThrow(() -> new EntityNotFoundException("Account not found"));
    }
    public Response get(UUID accountId, LocalDate date) {
        account(accountId);
        return latest(currentUserService.getCurrentUser().getId(), accountId, date);
    }
    public List<Response> history(UUID accountId, LocalDate date) {
        account(accountId);
        return jdbc.query("SELECT revision, payload::text FROM session_review_revisions WHERE user_id=? AND account_id=? AND session_date=? ORDER BY revision DESC LIMIT 100",
                (rs, index) -> {
                    try { return new Response(rs.getInt(1), mapper.readTree(rs.getString(2))); }
                    catch (Exception ex) { throw new IllegalStateException("Invalid stored review", ex); }
                }, currentUserService.getCurrentUser().getId(), accountId, date);
    }
    private Response latest(UUID userId, UUID accountId, LocalDate date) {
        var rows = jdbc.query("SELECT revision, payload::text FROM session_review_revisions WHERE user_id=? AND account_id=? AND session_date=? ORDER BY revision DESC LIMIT 1",
                (rs, index) -> {
                    try { return new Response(rs.getInt(1), mapper.readTree(rs.getString(2))); }
                    catch (Exception ex) { throw new IllegalStateException("Invalid stored review", ex); }
                }, userId, accountId, date);
        if (!rows.isEmpty()) return rows.get(0);
        var prior = jdbc.queryForList("SELECT payload->>'nextFocus' FROM session_review_revisions WHERE user_id=? AND account_id=? AND session_date<? AND payload->>'state'='COMPLETE' ORDER BY session_date DESC, revision DESC LIMIT 1", String.class, userId, accountId, date);
        ObjectNode empty = mapper.createObjectNode();
        if (!prior.isEmpty()) empty.put("focus", prior.get(0));
        return new Response(0, empty);
    }
    @Transactional
    public Response save(UUID accountId, LocalDate date, Request request) {
        var account = account(accountId);
        var user = currentUserService.getCurrentUser();
        // Serialize revisions per account and reject stale-tab writes rather than losing work.
        jdbc.queryForObject("SELECT id FROM accounts WHERE id=? AND user_id=? FOR UPDATE", UUID.class, accountId, user.getId());
        Response previous = latest(user.getId(), accountId, date);
        if (previous.revision() != request.revision()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Review changed; reload before saving");
        String timezone = account.getBrokerTimezone() != null ? account.getBrokerTimezone() : user.getTimezone() != null ? user.getTimezone() : "Europe/Bucharest";
        if (previous.data().hasNonNull("timezone")) timezone = previous.data().path("timezone").asText();
        ZoneId zone = ZoneId.of(timezone);
        ObjectNode data = mapper.valueToTree(request);
        data.put("timezone", timezone);
        data.put("savedAt", OffsetDateTime.now().toString());
        // This is assessment-time context, not an assertion of rules at execution time.
        data.put("contextBasis", "USER_ASSESSMENT_AT_REVIEW_TIME");
        if (request.strategyId() != null) {
            var strategy = strategies.findByIdAndUser_Id(request.strategyId(), user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Strategy not found"));
            if (previous.data().path("strategyId").asText().equals(request.strategyId().toString()) && previous.data().has("strategyContext")) {
                data.set("strategyContext", previous.data().get("strategyContext"));
            } else {
                var snapshot = data.putObject("strategyContext");
                snapshot.put("name", strategy.getName());
                snapshot.put("entry", strategy.getEntryConditionsRich());
                snapshot.put("invalidation", strategy.getInvalidationLogic());
                snapshot.put("noTrade", strategy.getNoTradeRules());
                snapshot.put("capturedAt", OffsetDateTime.now().toString());
            }
        }
        Set<UUID> seen = new HashSet<>();
        var assessmentSnapshots = data.putArray("assessmentContexts");
        for (Assessment item : request.assessments() == null ? List.<Assessment>of() : request.assessments()) {
            if (!seen.add(item.tradeId())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Duplicate assessment");
            var trade = trades.findByIdAndUserId(item.tradeId(), user.getId()).orElseThrow(() -> new EntityNotFoundException("Trade not found"));
            if (trade.getAccount() == null || !accountId.equals(trade.getAccount().getId())) throw new EntityNotFoundException("Trade not found");
            var time = trade.getClosedAt() != null ? trade.getClosedAt() : trade.getOpenedAt();
            if (time == null || !time.atZoneSameInstant(zone).toLocalDate().equals(date)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trade outside review date");
            JsonNode priorContext = null;
            for (JsonNode candidate : previous.data().path("assessmentContexts")) {
                if (item.tradeId().toString().equals(candidate.path("tradeId").asText())) { priorContext = candidate; break; }
            }
            if (priorContext != null) { assessmentSnapshots.add(priorContext.deepCopy()); continue; }
            var snapshot = assessmentSnapshots.addObject();
            snapshot.put("tradeId", item.tradeId().toString());
            snapshot.put("strategyVersionId", trade.getStrategyVersionId() == null ? null : trade.getStrategyVersionId().toString());
            snapshot.put("contextSnapshotId", trade.getContextSnapshotId() == null ? null : trade.getContextSnapshotId().toString());
        }
        if ("COMPLETE".equals(request.state()) && request.carryForward() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a carry-forward decision");
        int revision = previous.revision() + 1;
        jdbc.update("INSERT INTO session_review_revisions(id,user_id,account_id,session_date,revision,payload) VALUES (?,?,?,?,?,?::jsonb)", UUID.randomUUID(), user.getId(), accountId, date, revision, data.toString());
        return new Response(revision, data);
    }
}
