package com.tradevault.controller;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Role;
import com.tradevault.repository.UserRepository;
import com.tradevault.security.JwtTokenProvider;
import com.tradevault.service.storage.ObjectStorageService;
import com.tradevault.service.strategy.StudioDefinitionValidator;

import org.junit.jupiter.api.*;
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

import java.io.ByteArrayInputStream;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.*;

/** Real migrations, auth, ORM and HTTP contracts on an explicitly disposable database. */
@EnabledIfEnvironmentVariable(named = "STUDIO_TEST_DB_URL", matches = ".+")
@SpringBootTest(
        properties = {
            "app.frontend-url=http://localhost:5186",
            "spring.datasource.url=${STUDIO_TEST_DB_URL}",
            "spring.datasource.username=${STUDIO_TEST_DB_USER}",
            "spring.datasource.password=${STUDIO_TEST_DB_PASSWORD:}",
            "spring.datasource.hikari.schema=tradevault",
            "storage.s3.enabled=false",
            "news.refresh-cron=-",
            "jwt.secret=aXNvbGF0ZWQtcmVwbGF5LXRlc3Qtb25seS1rZXktMzItYnl0ZXM=",
            "logging.level.root=WARN",
            "logging.level.org.hibernate.SQL=WARN",
            "logging.level.org.hibernate.orm.jdbc.bind=OFF"
        })
@AutoConfigureMockMvc
class StrategyStudioIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired UserRepository users;
    @Autowired JwtTokenProvider tokens;
    @Autowired JdbcTemplate jdbc;
    @Autowired com.tradevault.repository.StrategyVersionRepository strategyVersions;
    @Autowired StudioDefinitionValidator validator;
    @MockBean JavaMailSender mail;
    @MockBean ObjectStorageService storage;
    final Map<String, byte[]> objects = new ConcurrentHashMap<>();

    @BeforeEach
    void objectStorage() {
        doAnswer(
                        inv -> {
                            objects.put(inv.getArgument(0), inv.getArgument(1));
                            return null;
                        })
                .when(storage)
                .putObject(anyString(), any(byte[].class), anyString());
        when(storage.getObject(anyString()))
                .thenAnswer(
                        inv -> {
                            byte[] b = objects.get(inv.getArgument(0));
                            return new ObjectStorageService.StoredObject(
                                    new ByteArrayInputStream(b), "image/png", (long) b.length);
                        });
    }

    String actor() {
        var user =
                users.save(
                        User.builder()
                                .email(UUID.randomUUID() + "@studio.example.test")
                                .passwordHash("test-only")
                                .role(Role.USER)
                                .timezone("Europe/Bucharest")
                                .baseCurrency("EUR")
                                .createdAt(OffsetDateTime.now())
                                .emailVerifiedAt(OffsetDateTime.now())
                                .build());
        return tokens.createToken(user.getId(), user.getEmail());
    }

    MockHttpServletRequestBuilder body(MockHttpServletRequestBuilder req, Object body)
            throws Exception {
        return req.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body));
    }

    JsonNode call(String token, MockHttpServletRequestBuilder req) throws Exception {
        var res =
                mvc.perform(req.header("Authorization", "Bearer " + token))
                        .andReturn()
                        .getResponse();
        assertThat(res.getStatus()).withFailMessage(res.getContentAsString()).isBetween(200, 299);
        return res.getContentAsString().isBlank()
                ? mapper.nullNode()
                : mapper.readTree(res.getContentAsString());
    }

    ObjectNode request() {
        var r = mapper.createObjectNode();
        var base = r.putObject("strategy");
        base.put("name", "Research strategy")
                .put("model", "Custom model")
                .put("entryConditionsRich", "<h2>Entry</h2><p>Wait for confirmation.</p>")
                .put("invalidationLogic", "<p>Stop below the sweep.</p>")
                .put("tpFramework", "<p>Target opposing liquidity.</p>");
        base.putArray("tags");
        base.putArray("sessionSuitability").add("London");
        r.set("definition", validator.empty());
        return r;
    }

    JsonNode create(String token) throws Exception {
        return call(token, body(post("/api/strategies/studio"), request()));
    }

    String route(JsonNode row) {
        return "/api/strategies/" + row.path("strategy").path("id").asText();
    }

    ObjectNode write(JsonNode row) {
        var r = request();
        r.set("definition", row.path("definition").deepCopy());
        r.put("expectedRevision", row.path("revision").asLong());
        return r;
    }

    @Test
    void savesNotebookAndTypedConfigurationReloadsAndDetectsStaleTabs() throws Exception {
        String actor = actor();
        var created = create(actor);
        String path = route(created);
        var r = write(created);
        var d = (ObjectNode) r.path("definition");
        d.withArray("notebook")
                .addObject()
                .put("id", "heading")
                .put("type", "HEADING")
                .put("html", "<h2>FVG research</h2><script>alert(1)</script>");
        d.withArray("parameters")
                .addObject()
                .put("id", "fvg")
                .put("name", "FVG size")
                .put("category", "FVG")
                .put("type", "PERCENTAGE")
                .put("unit", "%")
                .put("value", 0.07)
                .put("defaultValue", 0.05)
                .put("min", 0.01)
                .put("max", 0.5)
                .put("step", 0.01)
                .putArray("options");
        d.withArray("presets")
                .addObject()
                .put("id", "standard")
                .put("name", "Standard")
                .putObject("values")
                .put("fvg", 0.05);
        d.withArray("rules")
                .addObject()
                .put("id", "entry")
                .put("name", "FVG")
                .put("category", "Entry")
                .set(
                        "condition",
                        mapper.readTree(
                                "{\"kind\":\"group\",\"operator\":\"AND\",\"children\":[{\"kind\":\"condition\",\"parameterId\":\"fvg\",\"operator\":\">=\",\"value\":0.05},{\"kind\":\"manual\",\"text\":\"Confirm"
                                    + " external sweep\"}]}"));
        var saved = call(actor, body(put(path + "/studio"), r));
        assertThat(saved.path("revision").asLong())
                .isGreaterThan(created.path("revision").asLong());
        var reloaded = call(actor, get(path + "/studio"));
        assertThat(reloaded.path("definition")).isEqualTo(saved.path("definition"));
        assertThat(reloaded.path("definition").path("notebook").get(0).path("html").asText())
                .doesNotContain("script");
        assertThat(
                        mvc.perform(
                                        body(put(path + "/studio"), r)
                                                .header("Authorization", "Bearer " + actor))
                                .andReturn()
                                .getResponse()
                                .getStatus())
                .isEqualTo(409);
        var invalid = write(saved);
        ((ObjectNode) invalid.path("definition").path("parameters").get(0)).put("value", 0.075);
        assertThat(
                        mvc.perform(
                                        body(put(path + "/studio"), invalid)
                                                .header("Authorization", "Bearer " + actor))
                                .andReturn()
                                .getResponse()
                                .getStatus())
                .isEqualTo(400);
        assertThat(call(actor, get(path + "/versions")).size())
                .isEqualTo(1); // Autosave does not multiply checkpoints.
    }

    @Test
    void checkpointsRestoreAppendHistoryAndKeepTradeVersionLinks() throws Exception {
        String actor = actor();
        var created = create(actor);
        String path = route(created);
        var checkpoint =
                call(
                        actor,
                        body(
                                post(path + "/versions"),
                                Map.of(
                                        "expectedRevision",
                                        created.path("revision").asLong(),
                                        "name",
                                        "1.0",
                                        "description",
                                        "Initial hypothesis")));
        var current = call(actor, get(path + "/studio"));
        var change = write(current);
        ((ObjectNode) change.path("definition").path("metadata"))
                .put("description", "Changed hypothesis");
        var saved = call(actor, body(put(path + "/studio"), change));
        var restored =
                call(
                        actor,
                        body(
                                post(
                                        path
                                                + "/versions/"
                                                + checkpoint.path("version").path("id").asText()
                                                + "/restore"),
                                Map.of("expectedRevision", saved.path("revision").asLong())));
        assertThat(restored.path("definition").path("metadata").path("description").asText())
                .isEmpty();
        assertThat(call(actor, get(path + "/versions")).size()).isEqualTo(3);
        assertThat(
                        call(
                                        actor,
                                        get(
                                                path
                                                        + "/versions/"
                                                        + checkpoint
                                                                .path("version")
                                                                .path("id")
                                                                .asText()))
                                .path("snapshot")
                                .path("studio"))
                .isEqualTo(checkpoint.path("snapshot").path("studio"));
    }

    @Test
    void executionsKeepOriginalTemplateAfterItChanges() throws Exception {
        String actor = actor();
        var row = create(actor);
        String path = route(row);
        var r = write(row);
        var c = ((ObjectNode) r.path("definition")).withArray("checklists").addObject();
        c.put("id", "pretrade")
                .put("name", "Pre-trade")
                .put("type", "Pre-trade")
                .putArray("items")
                .addObject()
                .put("id", "risk")
                .put("text", "Risk defined")
                .put("mandatory", true)
                .put("group", "Risk");
        row = call(actor, body(put(path + "/studio"), r));
        assertThat(
                        mvc.perform(
                                        body(
                                                        post(path + "/checklist-executions"),
                                                        Map.of(
                                                                "expectedRevision",
                                                                row.path("revision").asLong(),
                                                                "checklistId",
                                                                "pretrade",
                                                                "answers",
                                                                Map.of("risk", false)))
                                                .header("Authorization", "Bearer " + actor))
                                .andReturn()
                                .getResponse()
                                .getStatus())
                .isEqualTo(400);
        call(
                actor,
                body(
                        post(path + "/checklist-executions"),
                        Map.of(
                                "expectedRevision",
                                row.path("revision").asLong(),
                                "checklistId",
                                "pretrade",
                                "answers",
                                Map.of("risk", true))));
        r = write(row);
        ((ObjectNode) r.path("definition").path("checklists").get(0).path("items").get(0))
                .put("text", "New risk requirement");
        call(actor, body(put(path + "/studio"), r));
        var history = call(actor, get(path + "/checklist-executions"));
        assertThat(history.get(0).path("template").path("items").get(0).path("text").asText())
                .isEqualTo("Risk defined");
        assertThat(history.get(0).path("answers").path("risk").asBoolean()).isTrue();
    }

    @Test
    void privateOperationsDenyOtherUsersAndUnauthenticatedCalls() throws Exception {
        String owner = actor(), stranger = actor();
        var row = create(owner);
        String path = route(row);
        String version = call(owner, get(path + "/versions")).get(0).path("id").asText();
        List<MockHttpServletRequestBuilder> routes =
                List.of(
                        get(path + "/studio"),
                        body(put(path + "/studio"), write(row)),
                        post(path + "/duplicate"),
                        get(path + "/versions"),
                        get(path + "/versions/" + version),
                        body(
                                post(path + "/versions"),
                                Map.of(
                                        "expectedRevision",
                                        row.path("revision").asLong(),
                                        "name",
                                        "Forbidden")),
                        body(
                                post(path + "/versions/" + version + "/restore"),
                                Map.of("expectedRevision", row.path("revision").asLong())),
                        get(path + "/export"),
                        get(path + "/checklist-executions"),
                        body(
                                post(path + "/checklist-executions"),
                                Map.of("checklistId", "x", "answers", Map.of())),
                        get(path + "/studio/evidence"),
                        body(
                                post(path + "/studio/trades"),
                                Map.of("tradeIds", List.of(UUID.randomUUID()))),
                        delete(path));
        for (var req : routes)
            assertThat(
                            mvc.perform(req.header("Authorization", "Bearer " + stranger))
                                    .andReturn()
                                    .getResponse()
                                    .getStatus())
                    .isIn(403, 404);
        assertThat(mvc.perform(get(path + "/studio")).andReturn().getResponse().getStatus())
                .isEqualTo(401);
    }

    @Test
    void exportImportDuplicateArchivePreserveExistingData() throws Exception {
        String actor = actor();
        var row = create(actor);
        String path = route(row);
        var exported = call(actor, get(path + "/export"));
        var imported = call(actor, body(post("/api/strategies/import"), exported));
        assertThat(imported.path("strategy").path("id"))
                .isNotEqualTo(row.path("strategy").path("id"));
        assertThat(imported.path("definition")).isEqualTo(exported.path("definition"));
        var copy = call(actor, post(path + "/duplicate"));
        assertThat(copy.path("strategy").path("name").asText()).endsWith("(copy)");
        call(actor, delete(path));
        assertThat(
                        call(actor, get(path + "/studio"))
                                .path("definition")
                                .path("metadata")
                                .path("status")
                                .asText())
                .isEqualTo("Archived");
        var invalid = exported.deepCopy();
        ((ObjectNode) invalid).put("schemaVersion", 99);
        assertThat(
                        mvc.perform(
                                        body(post("/api/strategies/import"), invalid)
                                                .header("Authorization", "Bearer " + actor))
                                .andReturn()
                                .getResponse()
                                .getStatus())
                .isEqualTo(400);
    }

    @Test
    void storedReplayTradesLinkExplicitlyToVersionAndKeepCurrenciesAndSignals() throws Exception {
        String actor = actor();
        var row = create(actor);
        String path = route(row);
        String version = call(actor, get(path + "/versions")).get(0).path("id").asText();
        String workspace =
                call(
                                actor,
                                body(
                                        post("/api/backtesting/workspaces"),
                                        Map.of("title", "Existing replay", "symbol", "GER40")))
                        .path("id")
                        .asText();
        byte[] csv =
                Objects.requireNonNull(
                                getClass()
                                        .getResourceAsStream(
                                                "/backtesting/tradingview-replay-ger40f.csv"))
                        .readAllBytes();
        call(
                actor,
                multipart("/api/backtesting/workspaces/" + workspace + "/trades/import")
                        .file(
                                new MockMultipartFile(
                                        "file",
                                        "Replay_Trading_PEPPERSTONE_GER40F_2025-10-06_to_2025-10-30_combined.csv",
                                        "text/csv",
                                        csv)));
        var source = call(actor, get("/api/backtesting/workspaces/" + workspace + "/trades"));
        List<String> ids = new ArrayList<>();
        source.forEach(t -> ids.add(t.path("id").asText()));
        assertThat(call(actor, get(path + "/studio/evidence")).path("trades").size()).isZero();
        call(
                actor,
                body(
                        post(path + "/studio/trades"),
                        Map.of("tradeIds", ids, "versionId", version, "sample", "IN_SAMPLE")));
        var evidence = call(actor, get(path + "/studio/evidence"));
        assertThat(evidence.path("trades").size()).isEqualTo(25);
        assertThat(evidence.path("trades").get(0).path("strategyVersionId").asText())
                .isEqualTo(version);
        assertThat(evidence.path("trades").get(0).path("pnlR").isNull()).isTrue();
        var after = call(actor, get("/api/backtesting/workspaces/" + workspace + "/trades"));
        Map<String, JsonNode> original = new HashMap<>();
        source.forEach(t -> original.put(t.path("id").asText(), t));
        for (var t : after)
            for (String field :
                    List.of(
                            "entrySignal",
                            "exitSignal",
                            "currency",
                            "priceCurrency",
                            "netPnl",
                            "pnlR",
                            "entryPrice",
                            "exitPrice"))
                assertThat(t.path(field))
                        .isEqualTo(original.get(t.path("id").asText()).path(field));
        var changed = write(row);
        ((ObjectNode) changed.path("definition").path("metadata")).put("description", "New draft");
        call(actor, body(put(path + "/studio"), changed));
        assertThat(
                        call(actor, get(path + "/studio/evidence"))
                                .path("trades")
                                .get(0)
                                .path("strategyVersionId")
                                .asText())
                .isEqualTo(version);
    }

    @Test
    void strategyImagesUseExistingUploadPermissionsAndSurviveCheckpointRestore() throws Exception {
        String owner = actor(), stranger = actor();
        var row = create(owner);
        String path = route(row), id = row.path("strategy").path("id").asText();
        byte[] png =
                Base64.getDecoder()
                        .decode(
                                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9WQAAAAASUVORK5CYII=");
        var file = new MockMultipartFile("file", "chart.png", "image/png", png);
        assertThat(
                        mvc.perform(
                                        multipart("/api/assets/upload")
                                                .file(file)
                                                .param("scope", "STRATEGY")
                                                .param("strategyId", id)
                                                .header("Authorization", "Bearer " + stranger))
                                .andReturn()
                                .getResponse()
                                .getStatus())
                .isIn(403, 404);
        var uploaded =
                call(
                        owner,
                        multipart("/api/assets/upload")
                                .file(file)
                                .param("scope", "STRATEGY")
                                .param("strategyId", id));
        String asset = uploaded.path("id").asText();
        assertThat(asset).isNotBlank();
        row = call(owner, get(path + "/studio"));
        var write = write(row);
        ((ObjectNode) write.path("definition"))
                .withArray("notebook")
                .addObject()
                .put("id", "chart")
                .put("type", "IMAGE")
                .put("assetId", asset)
                .put("caption", "Sweep example");
        row = call(owner, body(put(path + "/studio"), write));
        var checkpoint =
                call(
                        owner,
                        body(
                                post(path + "/versions"),
                                Map.of(
                                        "expectedRevision",
                                        row.path("revision").asLong(),
                                        "name",
                                        "Chart checkpoint")));
        assertThat(
                        checkpoint
                                .path("snapshot")
                                .path("studio")
                                .path("notebook")
                                .get(0)
                                .path("assetId")
                                .asText())
                .isEqualTo(asset);
        assertThat(
                        mvc.perform(
                                        get("/api/assets/" + asset + "/view")
                                                .header("Authorization", "Bearer " + stranger))
                                .andReturn()
                                .getResponse()
                                .getStatus())
                .isIn(403, 404);
        var exported = call(owner, get(path + "/export"));
        assertThat(
                        mvc.perform(
                                        body(post("/api/strategies/import"), exported)
                                                .header("Authorization", "Bearer " + stranger))
                                .andReturn()
                                .getResponse()
                                .getStatus())
                .isBetween(400, 499);
    }

    @Test
    void concurrentCheckpointsSerializeWithoutVersionNumberCollisions() throws Exception {
        String actor = actor();
        var row = create(actor);
        String path = route(row);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var tasks =
                    List.<Callable<Integer>>of(
                            () ->
                                    mvc.perform(
                                                    body(
                                                                    post(path + "/versions"),
                                                                    Map.of(
                                                                            "expectedRevision",
                                                                            row.path("revision")
                                                                                    .asLong(),
                                                                            "name",
                                                                            "A"))
                                                            .header(
                                                                    "Authorization",
                                                                    "Bearer " + actor))
                                            .andReturn()
                                            .getResponse()
                                            .getStatus(),
                            () ->
                                    mvc.perform(
                                                    body(
                                                                    post(path + "/versions"),
                                                                    Map.of(
                                                                            "expectedRevision",
                                                                            row.path("revision")
                                                                                    .asLong(),
                                                                            "name",
                                                                            "B"))
                                                            .header(
                                                                    "Authorization",
                                                                    "Bearer " + actor))
                                            .andReturn()
                                            .getResponse()
                                            .getStatus());
            var results = pool.invokeAll(tasks);
            assertThat(List.of(results.get(0).get(), results.get(1).get()))
                    .containsExactlyInAnyOrder(200, 409);
        } finally {
            pool.shutdownNow();
        }
        assertThat(call(actor, get(path + "/versions")).size()).isEqualTo(2);
    }

    @Test
    void currentCheckpointMustMatchTheSavedDraftAndImportedFieldsMustBeSupported()
            throws Exception {
        String token = actor();
        var row = create(token);
        UUID id = UUID.fromString(row.path("strategy").path("id").asText());
        UUID userId =
                jdbc.queryForObject(
                        "select user_id from tradevault.user_strategies where id=?",
                        UUID.class,
                        id);
        assertThat(strategyVersions.findMatchingCurrentCheckpoint(id, userId)).isPresent();
        var changed = write(row);
        ((ObjectNode) changed.path("definition").path("metadata"))
                .put("description", "Draft ahead of checkpoint");
        call(token, body(put(route(row) + "/studio"), changed));
        assertThat(strategyVersions.findMatchingCurrentCheckpoint(id, userId)).isEmpty();
        assertThat(strategyVersions.findMatchingCurrentCheckpoint(id, UUID.randomUUID())).isEmpty();
        var exported = (ObjectNode) call(token, get(route(row) + "/export"));
        exported.put("unsupportedField", true);
        assertThat(
                        mvc.perform(
                                        body(post("/api/strategies/import"), exported)
                                                .header("Authorization", "Bearer " + token))
                                .andReturn()
                                .getResponse()
                                .getStatus())
                .isEqualTo(400);
    }
}
