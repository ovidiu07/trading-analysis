package com.tradevault.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Role;
import com.tradevault.repository.UserRepository;
import com.tradevault.security.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;
import java.util.List;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/** Opt-in only: REPLAY_TEST_DB_URL must point to a disposable PostgreSQL database. */
@EnabledIfEnvironmentVariable(named = "REPLAY_TEST_DB_URL", matches = ".+")
@SpringBootTest(properties = {"app.frontend-url=http://localhost:5179", "spring.datasource.url=${REPLAY_TEST_DB_URL}", "spring.datasource.username=${REPLAY_TEST_DB_USER}",
        "spring.datasource.password=${REPLAY_TEST_DB_PASSWORD:}", "spring.datasource.hikari.schema=tradevault", "storage.s3.enabled=false", "news.refresh-cron=-",
        "jwt.secret=aXNvbGF0ZWQtcmVwbGF5LXRlc3Qtb25seS1rZXktMzItYnl0ZXM=", "logging.level.org.hibernate.SQL=WARN"})
@AutoConfigureMockMvc
class BacktestingReplayFlowIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired UserRepository users;
    @Autowired JwtTokenProvider tokens;
    @Autowired JdbcTemplate jdbc;
    @MockBean JavaMailSender mailSender;
    String actor() {
        var user = users.save(User.builder().email(UUID.randomUUID() + "@replay.example.test").passwordHash("test-only")
                .role(Role.USER).timezone("Europe/Bucharest").baseCurrency("EUR").createdAt(OffsetDateTime.now()).emailVerifiedAt(OffsetDateTime.now()).build());
        return tokens.createToken(user.getId(), user.getEmail());
    }
    MockMultipartFile fixture() throws Exception {
        byte[] bytes = Objects.requireNonNull(getClass().getResourceAsStream("/backtesting/tradingview-replay-ger40f.csv")).readAllBytes();
        return new MockMultipartFile("file", "Replay_Trading_PEPPERSTONE_GER40F_2025-10-06_to_2025-10-30_combined.csv", "text/csv", bytes);
    }
    JsonNode call(String token, MockHttpServletRequestBuilder request) throws Exception {
        var response = mvc.perform(request.header("Authorization", "Bearer " + token)).andReturn().getResponse();
        assertThat(response.getStatus()).withFailMessage(response.getContentAsString()).isBetween(200, 299);
        return mapper.readTree(response.getContentAsString());
    }
    String workspace(String token) throws Exception {
        return call(token, post("/api/backtesting/workspaces").contentType(MediaType.APPLICATION_JSON)
                .content("{\"symbol\":\"GER40U2026\",\"title\":\"Replay import validation\"}")).path("id").asText();
    }
    @Test void previewSaveReloadRepeatAndAnalyticsUseRealPersistence() throws Exception {
        String token = actor(), id = workspace(token), route = "/api/backtesting/workspaces/" + id;
        var preview = call(token, multipart(route + "/trades/import").file(fixture()).param("preview", "true"));
        assertThat(preview.path("imported").asInt()).isEqualTo(25);
        assertThat(call(token, get(route + "/trades")).size()).isZero();
        var imported = call(token, multipart(route + "/trades/import").file(fixture()));
        assertThat(imported.path("imported").asInt()).isEqualTo(25); assertThat(imported.path("invalid").asInt()).isZero();
        var stored = call(token, get(route + "/trades"));
        assertThat(stored.size()).isEqualTo(25); assertThat(stored.get(0).path("id").asText()).isNotBlank();
        assertThat(stored.get(0).path("pnlR").isNull()).isTrue(); assertThat(stored.get(0).path("tradeScope").asText()).isEqualTo("REPLAY");
        assertThat(stored.get(0).path("instrument").asText()).isEqualTo("PEPPERSTONE:GER40F");
        var repeat = call(token, multipart(route + "/trades/import").file(fixture()));
        assertThat(repeat.path("imported").asInt()).isZero(); assertThat(repeat.path("duplicates").asInt()).isEqualTo(25);
        var analytics = call(token, get(route + "/analytics"));
        assertThat(analytics.path("baseline").path("totalR").isNull()).isTrue();
        assertThat(analytics.path("baseline").path("winRate").asDouble()).isEqualTo(60);
        var eur = analytics.path("baseline").path("currencyMetrics").path("EUR");
        assertThat(eur.path("netPnl").asDouble()).isEqualTo(1768.4);
        assertThat(eur.path("maximumDrawdown").asDouble()).isEqualTo(265);
        assertThat(eur.path("profitFactor").asDouble()).isEqualTo(2.53);
        assertThat(analytics.path("breakdowns").path("direction").size()).isEqualTo(2);
        var library = call(token, get("/api/backtesting/workspaces"));
        assertThat(library.path("summary").path("totalTradesTested").asInt()).isEqualTo(25);
        assertThat(library.path("summary").path("averageExpectancy").isNull()).isTrue();
        assertThat(call(token, get(route)).path("totalR").isNull()).isTrue();
        assertThat(jdbc.queryForObject("select count(*) from tradevault.backtesting_trades where workspace_id=? and net_pnl is not null and pnl_r is null", Integer.class, UUID.fromString(id))).isEqualTo(25);
        // Legacy manual R evidence still persists alongside monetary replay evidence.
        call(token, post(route + "/trades").contentType(MediaType.APPLICATION_JSON).content("{\"date\":\"2025-10-31\",\"entryTime\":\"09:30\",\"instrument\":\"GER40\",\"direction\":\"LONG\",\"result\":\"WIN\",\"pnlR\":2}"));
        assertThat(call(token, get(route + "/analytics")).path("baseline").path("rSampleSize").asInt()).isEqualTo(1);
    }
    @Test void importAndPreviewRespectAuthenticationAndWorkspaceOwnership() throws Exception {
        String owner = actor(), other = actor(), id = workspace(owner), route = "/api/backtesting/workspaces/" + id;
        assertThat(mvc.perform(multipart(route + "/trades/import").file(fixture())).andReturn().getResponse().getStatus()).isEqualTo(401);
        for (String preview : new String[]{"true", "false"}) {
            assertThat(mvc.perform(multipart(route + "/trades/import").file(fixture()).param("preview", preview).header("Authorization", "Bearer " + other)).andReturn().getResponse().getStatus()).isIn(403, 404);
        }
        assertThat(call(owner, get(route + "/trades")).size()).isZero();
    }

    @Test void bulkEdits529ThenClearsOnlyTheOwnedWorkspaceAndPreservesEvidenceAssets() throws Exception {
        String token = actor(), otherActor = actor(), id = workspace(token), otherId = workspace(token);
        String route = "/api/backtesting/workspaces/" + id;
        UUID workspaceId = UUID.fromString(id);
        call(token, multipart(route + "/trades/import").file(fixture()));
        call(token, multipart("/api/backtesting/workspaces/" + otherId + "/trades/import").file(fixture()));
        UUID firstTrade = UUID.fromString(call(token, get(route + "/trades")).get(0).path("id").asText());
        UUID userId = jdbc.queryForObject("select user_id from tradevault.backtesting_workspaces where id=?", UUID.class, workspaceId);
        jdbc.update("""
                insert into tradevault.backtesting_trades
                (id,workspace_id,user_id,trade_date,entry_time,instrument,direction,result,pnl_r,source,trade_scope,net_pnl,currency)
                select uuid_generate_v4(),workspace_id,user_id,trade_date,entry_time,instrument,direction,result,pnl_r,source,trade_scope,net_pnl,currency
                from tradevault.backtesting_trades cross join generate_series(1,504) where id=?
                """, firstTrade);
        var stored = call(token, get(route + "/trades"));
        assertThat(stored.size()).isEqualTo(529);
        List<String> ids = new java.util.ArrayList<>();
        stored.forEach(trade -> ids.add(trade.path("id").asText()));
        var updated = call(token, patch(route + "/trades/bulk").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("tradeIds", ids, "fields", List.of("notes"), "changes", Map.of("notes", "All 529")))));
        assertThat(updated.size()).isEqualTo(529);
        assertThat(jdbc.queryForObject("select count(*) from tradevault.backtesting_trades where workspace_id=? and notes='All 529'", Integer.class, workspaceId)).isEqualTo(529);

        UUID assetId = UUID.randomUUID(), screenshotId = UUID.randomUUID(), liveId = UUID.randomUUID(), evidenceId = UUID.randomUUID();
        jdbc.update("insert into tradevault.asset(id,owner_user_id,scope,original_file_name,content_type,size_bytes,s3_key) values(?,?,'BACKTESTING','keep.png','image/png',1,?)", assetId, userId, "clear-test-" + assetId);
        jdbc.update("insert into tradevault.backtesting_screenshots(id,workspace_id,user_id,asset_id,backtesting_trade_id,caption) values(?,?,?,?,?,'Keep screenshot')", screenshotId, workspaceId, userId, assetId, firstTrade);
        jdbc.update("insert into tradevault.backtest_evidence_links(id,workspace_id,user_id,live_trade_id,included_in_analytics,sync_status) values(?,?,?,?,true,'SYNCED')", evidenceId, workspaceId, userId, liveId);
        jdbc.update("update tradevault.backtesting_workspaces set notes='Keep workspace notes', number_of_trades=529, winning_trades=529 where id=?", workspaceId);
        assertThat(mvc.perform(delete(route + "/trades")).andReturn().getResponse().getStatus()).isEqualTo(401);
        assertThat(mvc.perform(delete(route + "/trades").header("Authorization", "Bearer " + otherActor)).andReturn().getResponse().getStatus()).isIn(403, 404);
        assertThat(jdbc.queryForObject("select count(*) from tradevault.backtesting_trades where workspace_id=?", Integer.class, workspaceId)).isEqualTo(529);
        assertThat(mvc.perform(delete(route + "/trades").header("Authorization", "Bearer " + token)).andReturn().getResponse().getStatus()).isEqualTo(204);
        assertThat(call(token, get(route + "/trades")).size()).isZero();
        assertThat(call(token, get(route)).path("numberOfTrades").asInt()).isZero();
        assertThat(call(token, get(route)).path("notes").asText()).isEqualTo("Keep workspace notes");
        assertThat(call(token, get("/api/backtesting/workspaces/" + otherId + "/trades")).size()).isEqualTo(25);
        assertThat(jdbc.queryForObject("select backtesting_trade_id from tradevault.backtesting_screenshots where id=?", UUID.class, screenshotId)).isNull();
        assertThat(jdbc.queryForObject("select count(*) from tradevault.asset where id=?", Integer.class, assetId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select sync_status from tradevault.backtest_evidence_links where id=?", String.class, evidenceId)).isEqualTo("EXCLUDED");
        assertThat(jdbc.queryForObject("select included_in_analytics from tradevault.backtest_evidence_links where id=?", Boolean.class, evidenceId)).isFalse();
        assertThat(call(token, multipart(route + "/trades/import").file(fixture())).path("imported").asInt()).isEqualTo(25);
    }

    @Test void strategyExportPersistsIndependentCurrenciesAndSkipsAllRepeatedExecutions() throws Exception {
        String token = actor(), id = workspace(token), route = "/api/backtesting/workspaces/" + id;
        byte[] bytes = Objects.requireNonNull(getClass().getResourceAsStream("/backtesting/tradingview-strategy-ger40f-usd.csv")).readAllBytes();
        var file = new MockMultipartFile("file", "Five_Sessions_FVG_Windows_PEPPERSTONE_GER40F_2026-10-14_b1a3e.csv", "text/csv", bytes);
        var preview = call(token, multipart(route + "/trades/import").file(file).param("preview", "true"));
        assertThat(preview.path("imported").asInt()).isEqualTo(416);
        assertThat(preview.path("invalid").asInt()).isZero();
        assertThat(call(token, get(route + "/trades")).size()).isZero();
        var imported = call(token, multipart(route + "/trades/import").file(file));
        assertThat(imported.path("imported").asInt()).isEqualTo(416);
        var stored = call(token, get(route + "/trades"));
        assertThat(stored.size()).isEqualTo(416);
        stored.forEach(trade -> {
            assertThat(trade.path("priceCurrency").asText()).isEqualTo("EUR");
            assertThat(trade.path("currency").asText()).isEqualTo("USD");
            assertThat(trade.path("instrument").asText()).isEqualTo("PEPPERSTONE:GER40F");
            assertThat(trade.path("pnlR").isNull()).isTrue();
        });
        assertThat(stored.get(0).path("entryPrice").asDouble()).isEqualTo(24490.7);
        assertThat(stored.get(0).path("exitPrice").asDouble()).isEqualTo(24527.1);
        assertThat(jdbc.queryForObject("select count(*) from tradevault.backtesting_trades where workspace_id=? and price_currency='EUR' and currency='USD'", Integer.class, UUID.fromString(id))).isEqualTo(416);
        var repeat = call(token, multipart(route + "/trades/import").file(file));
        assertThat(repeat.path("imported").asInt()).isZero();
        assertThat(repeat.path("duplicates").asInt()).isEqualTo(416);
        assertThat(repeat.path("invalid").asInt()).isZero();
        var baseline = call(token, get(route + "/analytics")).path("baseline");
        assertThat(baseline.path("trades").asInt()).isEqualTo(416);
        assertThat(baseline.path("wins").asInt()).isEqualTo(171);
        assertThat(baseline.path("losses").asInt()).isEqualTo(245);
        assertThat(baseline.path("currencyMetrics").path("USD").path("netPnl").asDouble()).isEqualTo(1601.38);
        assertThat(baseline.path("currencyMetrics").has("EUR")).isFalse();
        assertThat(baseline.path("totalR").isNull()).isTrue();
    }

    @Test void bulkUpdatePersistsOutcomeBasedRAndSessionsAndRollsBackAnInvalidSelection() throws Exception {
        String token = actor(), id = workspace(token), route = "/api/backtesting/workspaces/" + id;
        call(token, multipart(route + "/trades/import").file(fixture()));
        var stored = call(token, get(route + "/trades"));
        List<String> ids = new java.util.ArrayList<>(); stored.forEach(trade -> ids.add(trade.path("id").asText()));
        var payload = mapper.writeValueAsString(Map.of("tradeIds", ids, "fields", List.of("plannedRR"), "changes", Map.of("plannedRR", 1.5),
                "deriveRFromPlannedRR", true, "recalculateSession", true));
        assertThat(call(token, patch(route + "/trades/bulk").contentType(MediaType.APPLICATION_JSON).content(payload)).size()).isEqualTo(25);
        var reloaded = call(token, get(route + "/trades"));
        reloaded.forEach(trade -> {
            assertThat(trade.path("plannedRR").asDouble()).isEqualTo(1.5);
            assertThat(trade.path("pnlR").asDouble()).isEqualTo(trade.path("result").asText().equals("WIN") ? 1.5 : -1);
            assertThat(trade.path("source").asText()).isEqualTo("IMPORT");
        });
        assertThat(call(token, get(route + "/analytics")).path("baseline").path("totalR").asDouble()).isEqualTo(12.5);
        assertThat(reloaded.get(0).path("session").asText()).isEqualTo("London");
        assertThat(reloaded.get(1).path("session").asText()).isEqualTo("New York");
        String invalid = mapper.writeValueAsString(Map.of("tradeIds", List.of(ids.get(0), UUID.randomUUID().toString()), "fields", List.of("plannedRR"), "changes", Map.of("plannedRR", 9)));
        assertThat(mvc.perform(patch(route + "/trades/bulk").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(invalid)).andReturn().getResponse().getStatus()).isIn(403, 404);
        assertThat(call(token, get(route + "/trades")).get(0).path("plannedRR").asDouble()).isEqualTo(1.5);
        String other = actor();
        assertThat(mvc.perform(patch(route + "/trades/bulk").header("Authorization", "Bearer " + other).contentType(MediaType.APPLICATION_JSON).content(payload)).andReturn().getResponse().getStatus()).isIn(403, 404);
        assertThat(mvc.perform(patch(route + "/trades/bulk").contentType(MediaType.APPLICATION_JSON).content(payload)).andReturn().getResponse().getStatus()).isEqualTo(401);
    }
}
