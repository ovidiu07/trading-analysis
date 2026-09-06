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
    AccountRepository accounts = mock(AccountRepository.class);
    TradeRepository trades = mock(TradeRepository.class);
    UserStrategyRepository strategies = mock(UserStrategyRepository.class);
    CurrentUserService users = mock(CurrentUserService.class);
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    ObjectMapper mapper = new ObjectMapper();
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
