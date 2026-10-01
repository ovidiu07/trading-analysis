package com.tradevault.service.news;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;

@Repository
@RequiredArgsConstructor
public class NewsFeedStore {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    public record State(Instant attempt, Instant success, Instant next, String status) {}
    public record Cached(Instant fetchedAt, NewsModels.Payload payload) {}
    public UUID claim(String feed, Instant now) {
        jdbc.update("INSERT INTO tradevault.news_feed_state(feed_id) VALUES (?) ON CONFLICT DO NOTHING", feed);
        UUID token = UUID.randomUUID();
        int n = jdbc.update("""
            UPDATE tradevault.news_feed_state SET lease_until=?, lease_token=?, last_attempt_at=?
            WHERE feed_id=? AND next_refresh_at<=? AND lease_until<=?
            """, ts(now.plusSeconds(120)), token, ts(now), feed, ts(now), ts(now));
        return n == 1 ? token : null;
    }
    /** Every HTTP attempt, including retries, must reserve a slot atomically. */
    public boolean reserve(String provider, Instant now, int limit) {
        if (limit <= 0) return false;
        return jdbc.update("""
            INSERT INTO tradevault.news_provider_budget(provider,budget_day,requests) VALUES (?,?,1)
            ON CONFLICT(provider,budget_day) DO UPDATE SET requests=tradevault.news_provider_budget.requests+1
            WHERE tradevault.news_provider_budget.requests < ?
            """, provider, now.atZone(ZoneOffset.UTC).toLocalDate(), limit) == 1;
    }
    @Transactional
    public void success(String feed, UUID token, Instant now, Duration ttl, NewsModels.Payload payload) {
        if (jdbc.update("UPDATE tradevault.news_feed_state SET last_success_at=?,next_refresh_at=?,lease_until=?,lease_token=NULL,status='OK' WHERE feed_id=? AND lease_token=?",
                ts(now), ts(now.plus(ttl)), ts(now), feed, token) != 1) return;
        try { jdbc.update("INSERT INTO tradevault.news_feed_snapshot(feed_id,fetched_at,payload) VALUES (?,?,?::jsonb)", feed, ts(now), mapper.writeValueAsString(payload)); }
        catch (com.fasterxml.jackson.core.JsonProcessingException ex) { throw new IllegalStateException("Invalid context payload"); }
    }
    public void failure(String feed, UUID token, Instant now, Duration cooldown, String status) {
        jdbc.update("UPDATE tradevault.news_feed_state SET next_refresh_at=?,lease_until=?,lease_token=NULL,status=? WHERE feed_id=? AND lease_token=?",
                ts(now.plus(cooldown)), ts(now), status, feed, token);
    }
    public void requestRefresh(String feed, Instant now) {
        jdbc.update("INSERT INTO tradevault.news_feed_state(feed_id) VALUES (?) ON CONFLICT DO NOTHING", feed);
        jdbc.update("UPDATE tradevault.news_feed_state SET next_refresh_at=? WHERE feed_id=? AND (last_attempt_at IS NULL OR last_attempt_at<=?) AND lease_until<=? AND status NOT IN ('QUOTA','FAILED')",
            ts(now), feed, ts(now.minusSeconds(1800)), ts(now));
    }
    public State state(String feed) {
        return jdbc.query("SELECT last_attempt_at,last_success_at,NULLIF(next_refresh_at,'-infinity'::timestamptz),status FROM tradevault.news_feed_state WHERE feed_id=?",
            (r, n) -> new State(instant(r.getTimestamp(1)), instant(r.getTimestamp(2)), instant(r.getTimestamp(3)), r.getString(4)), feed)
            .stream().findFirst().orElse(new State(null, null, null, "PENDING"));
    }
    public List<Cached> snapshots(String feed, Instant from, Instant asOf, boolean news) {
        // RSS history accumulates while calendar/results use only the latest known snapshot.
        String sql = news ? "SELECT fetched_at,payload FROM tradevault.news_feed_snapshot WHERE feed_id=? AND fetched_at<=? AND fetched_at>=? ORDER BY fetched_at DESC,id DESC LIMIT 200"
            : "SELECT fetched_at,payload FROM tradevault.news_feed_snapshot WHERE feed_id=? AND fetched_at<=? ORDER BY fetched_at DESC,id DESC LIMIT 1";
        Object[] params = news ? new Object[]{feed, ts(asOf), ts(from.minus(Duration.ofDays(1)))} : new Object[]{feed, ts(asOf)};
        return jdbc.query(sql, (r,n) -> {
            try { return new Cached(r.getTimestamp(1).toInstant(), mapper.readValue(r.getString(2), NewsModels.Payload.class)); }
            catch (com.fasterxml.jackson.core.JsonProcessingException ex) { throw new IllegalStateException("Invalid cached context"); }
        }, params);
    }
    static Timestamp ts(Instant time) { return Timestamp.from(time); }
    private static Instant instant(Timestamp time) { return time == null ? null : time.toInstant(); }
}
