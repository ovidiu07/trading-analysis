package com.tradevault.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Role;
import com.tradevault.repository.AccountRepository;
import com.tradevault.repository.UserRepository;
import com.tradevault.security.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

@SpringBootTest(properties = {"app.frontend-url=http://localhost:5178", "news.refresh-cron=-", "storage.s3.enabled=false", "jwt.secret=aXNvbGF0ZWQtZmxvdy10ZXN0LW9ubHkta2V5LTMyLWJ5dGVzLWxvbmc=", "spring.jpa.hibernate.ddl-auto=none", "spring.datasource.hikari.schema=tradevault", "spring.jpa.properties.hibernate.default_schema=tradevault", "spring.flyway.default-schema=tradevault", "spring.flyway.schemas=tradevault", "logging.level.org.hibernate.SQL=WARN", "logging.level.org.hibernate.orm.jdbc.bind=WARN"})
@org.springframework.test.annotation.DirtiesContext(classMode = org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
@AutoConfigureMockMvc
@Testcontainers
class TradePreparationFlowIntegrationTest {
    @Container static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:16-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", db::getJdbcUrl); r.add("spring.datasource.username", db::getUsername); r.add("spring.datasource.password", db::getPassword);
    }
    @org.springframework.boot.test.mock.mockito.MockBean org.springframework.mail.javamail.JavaMailSender mailSender;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired UserRepository users;
    @Autowired AccountRepository accounts;
    @Autowired JwtTokenProvider tokens;
    @Autowired JdbcTemplate jdbc;
    record Actor(String token, Account account) {}
    Actor actor() {
        User u = users.save(User.builder().email(UUID.randomUUID()+"@example.test").passwordHash("test-only").role(Role.USER).timezone("Europe/Bucharest").baseCurrency("EUR").createdAt(java.time.OffsetDateTime.now()).emailVerifiedAt(java.time.OffsetDateTime.now()).build());
        Account a = accounts.save(Account.builder().user(u).name("Isolated flow test").accountCurrency("EUR").brokerTimezone("Europe/Bucharest").startingBalance(new BigDecimal("25000")).build());
        return new Actor(tokens.createToken(u.getId(), u.getEmail()), a);
    }
    JsonNode call(Actor a, MockHttpServletRequestBuilder request, JsonNode body) throws Exception {
        request.header("Authorization", "Bearer "+a.token());
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(body.toString());
        var response = mvc.perform(request).andReturn().getResponse();
        assertThat(response.getStatus()).withFailMessage(response.getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).isBetween(200, 299);
        return mapper.readTree(response.getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
    }
    ObjectNode review() throws Exception {
        return (ObjectNode)mapper.readTree("""
        {"revision":0,"state":"TRADE","instruments":"GER40","focus":"Edited thesis: wait for reclaim","strategyId":null,"assessments":[],
         "preparation":{"step":0,"briefingSession":"ASIA","bias":"bearish","chartSymbol":"OANDA:DE30EUR","chartInterval":"5","chartPlan":"Edited chart plan","observing":true,"contextAcknowledged":true,"chartConfirmed":true,"preparationConfirmed":true,
          "emotion":"focused","discipline":{"chasing":true,"revenge":false,"social":true},"psychologyNotes":"Felt pressure; paused before entry","sessionNotes":"Notițe: aștept confirmarea","checklist":[true,false],"checklistLabels":["Sweep","Retest"],
          "riskDrafts":{"CFD:DAX":{"version":1,"draftId":"test-risk","entryPrice":"24000","stopLossPrice":"24010","takeProfitPrice":"23980","intendedRiskAmount":"200","manualQuantity":"2","invalidation":"Acceptance above stop"}}}}
        """);
    }
    ObjectNode snapshot(Actor a, JsonNode review) {
        ObjectNode s=mapper.createObjectNode();s.put("version",1);s.put("accountId",a.account().getId().toString());s.put("date",LocalDate.now().toString());s.put("session","DAY");s.put("timezone","Europe/Bucharest");s.set("review",review.deepCopy());return s;
    }
    ObjectNode trade(Actor a) throws Exception {
        ObjectNode t=(ObjectNode)mapper.readTree("""
        {"symbol":"GER40","market":"CFD","direction":"SHORT","status":"OPEN","openedAt":"2026-10-05T09:44:00Z","quantity":2,"entryPrice":24000,"stopLossPrice":24010,"takeProfitPrice":23980,"riskAmount":200,"feeling":"neutral","notes":"Final edited execution notes","tradeCurrency":"EUR","profileCurrency":"EUR","fxRateTradeToProfile":1}
        """);t.put("accountRefId",a.account().getId().toString());return t;
    }
    @Test void todayLogRoundTripsEveryFieldRetriesOnceAndFreezesAgainstLaterEdits() throws Exception {
        Actor a=actor();String date=LocalDate.now().toString();String route="/api/today/reviews/"+a.account().getId()+"/"+date;
        ObjectNode plan=review();JsonNode saved=call(a,put(route),plan);JsonNode loaded=call(a,get(route),null);
        assertThat(loaded.path("data").path("preparation")).isEqualTo(saved.path("data").path("preparation"));
        ObjectNode request=mapper.createObjectNode();request.put("requestId",UUID.randomUUID().toString());request.put("accountId",a.account().getId().toString());request.put("date",date);request.put("session","DAY");request.put("preparationRevision",1);
        ObjectNode t=trade(a);t.set("preparationSnapshot",snapshot(a,loaded.path("data")));request.set("trade",t);
        JsonNode created=call(a,post("/api/today/log-trade"),request);String id=created.path("id").asText();JsonNode frozen=created.path("preparationSnapshot");
        assertThat(frozen.path("review").path("preparation")).isEqualTo(loaded.path("data").path("preparation"));
        assertThat(frozen.path("loggedTrade").path("notes").asText()).isEqualTo("Final edited execution notes");
        assertThat(frozen.path("loggedTrade").path("feeling").asText()).isEqualTo("neutral");
        assertThat(call(a,post("/api/today/log-trade"),request).path("id").asText()).isEqualTo(id);
        assertThat(jdbc.queryForObject("select count(*) from tradevault.trades where id=?",Integer.class,UUID.fromString(id))).isEqualTo(1);
        plan.put("revision",1);plan.put("focus","Later session edit");((ObjectNode)plan.path("preparation")).put("psychologyNotes","Later feeling");call(a,put(route),plan);
        t.put("notes","Post-trade correction");t.set("preparationSnapshot",snapshot(a,plan));call(a,put("/api/trades/"+id),t);
        org.skyscreamer.jsonassert.JSONAssert.assertEquals(frozen.toString(),call(a,get("/api/trades/"+id),null).path("preparationSnapshot").toString(),true);
        org.skyscreamer.jsonassert.JSONAssert.assertEquals(frozen.toString(),call(a,get("/api/today/log-trade/context/"+id),null).toString(),true);
        Actor other=actor();assertThat(mvc.perform(get("/api/trades/"+id).header("Authorization","Bearer "+other.token())).andReturn().getResponse().getStatus()).isIn(403,404);
        ObjectNode mismatch=trade(other);mismatch.set("preparationSnapshot",snapshot(a,plan));assertThat(mvc.perform(post("/api/trades").header("Authorization","Bearer "+other.token()).contentType(MediaType.APPLICATION_JSON).content(mismatch.toString())).andReturn().getResponse().getStatus()).isBetween(400,499);
    }
    @Test void canonicalSetupAndQuickLogKeepLatestConfigurationAndOriginalPreparation() throws Exception {
        Actor a=actor();JsonNode w=call(a,get("/api/today/session/workspace"),null);String session=w.path("session").path("id").asText();
        ObjectNode setup=(ObjectNode)mapper.readTree("""
        {"sourceDraftId":"roundtrip-draft","symbol":"GER40","market":"CFD","direction":"SHORT","setupTitle":"Manual liquidity setup","manualSetupMode":true,
         "context":{"narrative":"Original thesis","notes":"First notes"},"trigger":{"notes":"Wait for retest"},
         "execution":{"entryPrice":24000,"stopLossPrice":24010,"takeProfitPrice":23980,"riskAmount":200,"quantity":2,"invalidation":"Above stop"}}
        """);setup.put("accountRefId",a.account().getId().toString());((ObjectNode)setup.path("context")).set("preparationSnapshot",snapshot(a,review()));
        JsonNode created=call(a,post("/api/today/session/"+session+"/setups"),setup);String id=created.path("setups").get(0).path("id").asText();
        assertThat(created.path("setups").get(0).path("context").path("preparationSnapshot")).isEqualTo(setup.path("context").path("preparationSnapshot"));
        ((ObjectNode)setup.path("context")).put("notes","Edited immediately before logging");call(a,put("/api/today/session/"+session+"/setups/"+id),setup);
        ObjectNode t=trade(a);t.put("setupId",id);t.put("riskAmount",175);JsonNode logged=call(a,post("/api/trades"),t);JsonNode record=logged.path("preparationSnapshot");
        assertThat(record.path("setupConfiguration").path("context").path("notes").asText()).isEqualTo("Edited immediately before logging");
        assertThat(record.path("review").path("preparation").path("emotion").asText()).isEqualTo("focused");
        assertThat(record.path("loggedTrade").path("riskAmount").asInt()).isEqualTo(175);
        org.skyscreamer.jsonassert.JSONAssert.assertEquals(record.toString(),call(a,get("/api/trades/"+logged.path("id").asText()),null).path("preparationSnapshot").toString(),true);
        Actor other=actor();ObjectNode forbidden=trade(other);forbidden.put("setupId",id);assertThat(mvc.perform(post("/api/trades").header("Authorization","Bearer "+other.token()).contentType(MediaType.APPLICATION_JSON).content(forbidden.toString())).andReturn().getResponse().getStatus()).isIn(400,403,404);
    }
    @Test void legacyManualSetupWithoutAnAccountStillCapturesItsConfiguration() throws Exception {
        Actor a=actor();JsonNode workspace=call(a,get("/api/today/session/workspace"),null);
        String session=workspace.path("session").path("id").asText();
        ObjectNode setup=mapper.createObjectNode();setup.put("symbol","GER40");setup.put("direction","SHORT");setup.put("manualSetupMode",true);setup.putObject("context").put("notes","Legacy manual plan");
        JsonNode created=call(a,post("/api/today/session/"+session+"/setups"),setup);
        ObjectNode t=trade(a);t.put("setupId",created.path("setups").get(0).path("id").asText());
        JsonNode logged=call(a,post("/api/trades"),t);
        assertThat(logged.path("preparationSnapshot").path("setupConfiguration").path("context").path("notes").asText()).isEqualTo("Legacy manual plan");
        assertThat(logged.path("preparationSnapshot").path("sessionConfiguration").has("maxTrades")).isTrue();
        assertThat(call(a,post("/api/trades"),trade(a)).path("preparationSnapshot").isNull()).isTrue();
    }

}
