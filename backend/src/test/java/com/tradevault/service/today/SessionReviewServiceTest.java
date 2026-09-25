package com.tradevault.service.today;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.*;
import com.tradevault.repository.*;
import com.tradevault.service.CurrentUserService;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.*;
import java.time.LocalDate;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class SessionReviewServiceTest {
    @Test void manualLevelsArePrivateValidatedAndCapturedWithServerProvenance() throws Exception {
        var prep=mapper.readValue("""
          {"step":0,"briefingSession":"ASIA","bias":"neutral","chartSymbol":"OANDA:DE30EUR",
           "observing":true,"contextAcknowledged":true,"chartConfirmed":true,"preparationConfirmed":true,
           "manualLevels":[{"id":"11111111-1111-4111-8111-111111111111","instrument":"OANDA:DE30EUR","label":"SUPPORT","value":18500.25,"unit":"EUR","note":"My thesis","authorId":"forged","updatedAt":"2099-01-01T00:00:00Z","provenance":"LIVE"}]}
          """,SessionReviewService.Preparation.class);
        var req=new SessionReviewService.Request(0,"TRADE","GER40",null,"Observe","",null,List.of(),prep);
        var result=service.save(accountId,date,req);
        var level=result.data().path("preparation").path("manualLevels").get(0);
        assertThat(level.path("authorId").asText()).isEqualTo(userId.toString());
        assertThat(level.path("provenance").asText()).isEqualTo("MANUAL");
        assertThat(level.path("updatedAt").asText()).doesNotStartWith("2099");
        assertThat(result.data().path("readyContext").path("preparation").path("manualLevels").get(0)).isEqualTo(level);
        assertThatThrownBy(()->service.save(UUID.randomUUID(),date,req)).isInstanceOf(jakarta.persistence.EntityNotFoundException.class);
        try(var factory=jakarta.validation.Validation.buildDefaultValidatorFactory()) {
            var bad=new SessionReviewService.ManualLevel(UUID.randomUUID(),"GER40","SUPPORT",new java.math.BigDecimal("-1"),"","");
            assertThat(factory.getValidator().validate(bad)).hasSizeGreaterThanOrEqualTo(3);
        }
    }
    @Test void omittedManualLevelsRetainPriorWhileEmptyArrayClearsAndReadyRemainsFrozen() throws Exception {
        var previous=mapper.readTree("""
          {"preparation":{"manualLevels":[{"id":"a","instrument":"OANDA:DE30EUR","label":"SUPPORT","value":18000,"unit":"EUR","note":"","updatedAt":"2026-09-25T12:00:00Z"}]},"readyContext":{"preparation":{"manualLevels":[{"value":17000}]}}}
          """);
        var omitted=mapper.createObjectNode();omitted.putObject("preparation");
        org.springframework.test.util.ReflectionTestUtils.invokeMethod(service,"normalizeManualLevels",omitted,previous,userId);
        assertThat(omitted.path("preparation").path("manualLevels")).isEqualTo(previous.path("preparation").path("manualLevels"));
        var cleared=mapper.createObjectNode();cleared.putObject("preparation").putArray("manualLevels");
        org.springframework.test.util.ReflectionTestUtils.invokeMethod(service,"normalizeManualLevels",cleared,previous,userId);
        assertThat(cleared.path("preparation").path("manualLevels")).isEmpty();
        assertThat(previous.path("readyContext").path("preparation").path("manualLevels").get(0).path("value").asInt()).isEqualTo(17000);
        var same=mapper.createObjectNode();same.set("preparation",previous.path("preparation").deepCopy());
        org.springframework.test.util.ReflectionTestUtils.invokeMethod(service,"normalizeManualLevels",same,previous,userId);
        assertThat(same.path("preparation").path("manualLevels").get(0).path("updatedAt").asText()).isEqualTo("2026-09-25T12:00:00Z");
        ((com.fasterxml.jackson.databind.node.ArrayNode)same.path("preparation").path("manualLevels")).add(same.path("preparation").path("manualLevels").get(0).deepCopy());
        assertThatThrownBy(()->org.springframework.test.util.ReflectionTestUtils.invokeMethod(service,"normalizeManualLevels",same,previous,userId)).hasMessageContaining("Duplicate");
    }
    @Test void readyRejectsDisplayOnlySourcesAndRetainsFailureReasonsWithoutNumbers() throws Exception {
        var raw=mapper.readTree("""
          {"instruments":[
           {"provider":"TradingView","canonicalInstrument":"GER40","freshness":"LIVE","provenance":"DISPLAY_ONLY","mid":19999},
           {"provider":"OANDA","canonicalInstrument":"GER40","freshness":"LIVE","provenance":"DISPLAY_ONLY","mid":19999},
           {"provider":"OANDA","canonicalInstrument":"GER40","freshness":"STALE","provenance":"USER_CONNECTED","availabilityReason":"STALE_QUOTE","mid":18888,"bid":18887,"high":20000}
          ]}
          """);
        com.fasterxml.jackson.databind.JsonNode clean=org.springframework.test.util.ReflectionTestUtils.invokeMethod(service,"sanitizeMarketDataSnapshot",raw);
        assertThat(clean.path("instruments")).hasSize(1);
        assertThat(clean.path("instruments").get(0).path("availabilityReason").asText()).isEqualTo("STALE_QUOTE");
        assertThat(clean.toString()).doesNotContain("19999","18888","18887","20000","TradingView","DISPLAY_ONLY");
    }
    AccountRepository accounts = mock(AccountRepository.class);
    TradeRepository trades = mock(TradeRepository.class);
    UserStrategyRepository strategies = mock(UserStrategyRepository.class);
    CurrentUserService users = mock(CurrentUserService.class);
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    ObjectMapper mapper = new ObjectMapper().registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
    SessionReviewService service = new SessionReviewService(users, accounts, trades, strategies, jdbc, mapper);
    UUID userId = UUID.randomUUID(), accountId = UUID.randomUUID();
    LocalDate date = LocalDate.of(2026, 9, 6);
    @BeforeEach void setup() {
        var user = User.builder().id(userId).timezone("Europe/Bucharest").build();
        when(users.getCurrentUser()).thenReturn(user);
        when(accounts.findByIdAndUserId(accountId, userId)).thenReturn(Optional.of(Account.builder().id(accountId).user(user).build()));
    }
    SessionReviewService.Request request(String state, String carry) {
        return new SessionReviewService.Request(0, state, "DEMO", null, "", "", carry, List.of());
    }
    @Test void sessionsHaveIndependentRevisionIdentity() {
        service.get(accountId,date,"EUROPE"); service.get(accountId,date,"US");
        verify(jdbc).query(anyString(), any(RowMapper.class), eq(userId),eq(accountId),eq(date),eq("EUROPE"));
        verify(jdbc).query(anyString(), any(RowMapper.class), eq(userId),eq(accountId),eq(date),eq("US"));
    }
    @Test void invalidSessionRejected() {
        assertThatThrownBy(()->service.get(accountId,date,"UNKNOWN")).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        verifyNoInteractions(jdbc);
    }
    @Test void readyRequiresExplicitConfirmations() {
        var prep=new SessionReviewService.Preparation(3,"ASIA",false,"neutral","","XETR:DAX","15",true,false,false,false,List.of(),null);
        var req=new SessionReviewService.Request(0,"TRADE","DAX",null,"","",null,List.of(),prep);
        assertThatThrownBy(()->service.save(accountId,date,"US",req)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    }
    @Test void manualObservationCanBecomeReady() {
        var prep=new SessionReviewService.Preparation(3,"ASIA",true,"neutral","Watch","XETR:DAX","15",true,true,true,true,List.of(),null);
        var req=new SessionReviewService.Request(0,"TRADE","DAX",null,"Observe","",null,List.of(),prep);
        var result=service.save(accountId,date,"US",req);
        assertThat(result.data().path("readyContext").path("revision").asInt()).isEqualTo(1);
        assertThat(result.data().path("readyContext").path("focus").asText()).isEqualTo("Observe");
    }
    @Test void readyCapturesOnlySourceAndFreshnessMetadataWithoutMarketValues() {
        var reference = new SessionReviewService.MarketSourceReference("GER40", "OANDA", "DE30_EUR", "CFD", "MID",
                "2026-09-24T10:00:00Z", "2026-09-24T10:00:01Z", null, "LIVE", "USER_CONNECTED",
                "https://developer.oanda.com/rest-live-v20/pricing-ep/", null);
        var audit = new SessionReviewService.MarketDataAuditSnapshot(java.time.OffsetDateTime.now(), List.of(reference), List.of());
        var prep = new SessionReviewService.Preparation(3,"ASIA",true,"neutral","Watch","OANDA:DE30EUR","15",true,true,true,true,List.of(),null,null,audit);
        var req = new SessionReviewService.Request(0,"TRADE","GER40",null,"Observe","",null,List.of(),prep);

        var result = service.save(accountId,date,"US",req);
        var snapshot = result.data().path("readyContext").path("preparation").path("marketDataSnapshot");

        assertThat(snapshot.path("retention").asText()).isEqualTo("PROVENANCE_ONLY_NO_MARKET_VALUES");
        assertThat(snapshot.path("instruments").get(0).path("providerSymbol").asText()).isEqualTo("DE30_EUR");
        assertThat(snapshot.path("instruments").get(0).path("freshness").asText()).isEqualTo("LIVE");
        assertThat(snapshot.path("instruments").get(0).has("mid")).isFalse();
        assertThat(snapshot.path("instruments").get(0).has("value")).isFalse();
    }
    @Test void cannotReadAnotherAccount() {
        assertThatThrownBy(() -> service.get(UUID.randomUUID(), date)).isInstanceOf(jakarta.persistence.EntityNotFoundException.class);
        verifyNoInteractions(jdbc);
    }
    @Test void completionRequiresAnExplicitDecision() {
        assertThatThrownBy(() -> service.save(accountId, date, request("COMPLETE", null))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }
    @Test void saveAppendsRevisionAndPreservesBlankFocus() {
        var result = service.save(accountId, date, request("COMPLETE", "COLLECT"));
        assertThat(result.revision()).isEqualTo(1);
        assertThat(result.data().path("focus").asText()).isEmpty();
        assertThat(result.data().path("contextBasis").asText()).isEqualTo("USER_ASSESSMENT_AT_REVIEW_TIME");
        verify(jdbc).update(startsWith("INSERT INTO session_review_revisions"), any(UUID.class), eq(userId), eq(accountId), eq(date), eq(1), anyString(), eq("DAY"));
    }
    @Test void rejectsForeignTradeAssessment() {
        UUID tradeId = UUID.randomUUID();
        var request = new SessionReviewService.Request(0, "REVIEW", "", null, "", "", null,
                List.of(new SessionReviewService.Assessment(tradeId, "FOLLOWED", "")));
        assertThatThrownBy(() -> service.save(accountId, date, request)).isInstanceOf(jakarta.persistence.EntityNotFoundException.class);
    }

    @Test void historyRequiresAccountOwnership() {
        assertThatThrownBy(() -> service.history(UUID.randomUUID(), date)).isInstanceOf(jakarta.persistence.EntityNotFoundException.class);
        verifyNoInteractions(jdbc);
    }
    @SuppressWarnings("unchecked")
    @Test void rejectsStaleRevisionWithoutWriting() {
        when(jdbc.query(anyString(), any(RowMapper.class), eq(userId), eq(accountId), eq(date), eq("DAY")))
                .thenReturn(List.of(new SessionReviewService.Response(3, mapper.createObjectNode())));
        assertThatThrownBy(() -> service.save(accountId, date, request("REVIEW", null)))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
                .hasMessageContaining("409");
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }
    @SuppressWarnings("unchecked")
    @Test void reopeningPreservesStrategySnapshotAndAssessmentTimezone() {
        UUID strategyId = UUID.randomUUID();
        var previous = mapper.createObjectNode();
        previous.put("strategyId", strategyId.toString());
        previous.put("timezone", "America/New_York");
        previous.putObject("strategyContext").put("entry", "Original rule");
        when(jdbc.query(anyString(), any(RowMapper.class), eq(userId), eq(accountId), eq(date), eq("DAY")))
                .thenReturn(List.of(new SessionReviewService.Response(2, previous)));
        when(strategies.findByIdAndUser_Id(strategyId, userId)).thenReturn(Optional.of(UserStrategy.builder().id(strategyId).name("Edited strategy").entryConditionsRich("New rule").build()));
        var request = new SessionReviewService.Request(2, "REVIEW", "", strategyId, "", "", "COLLECT", List.of());
        var result = service.save(accountId, date, request);
        assertThat(result.revision()).isEqualTo(3);
        assertThat(result.data().path("strategyContext").path("entry").asText()).isEqualTo("Original rule");
        assertThat(result.data().path("timezone").asText()).isEqualTo("America/New_York");
    }
}
