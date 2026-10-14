package com.tradevault.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.*;
import com.tradevault.domain.enums.*;
import com.tradevault.dto.backtesting.BacktestingTradeBulkUpdateRequest;
import com.tradevault.repository.*;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BacktestingBulkEditTest {
    final BacktestingWorkspaceRepository workspaces = mock(BacktestingWorkspaceRepository.class);
    final BacktestingTradeRepository repository = mock(BacktestingTradeRepository.class);
    final BacktestingScreenshotRepository screenshots = mock(BacktestingScreenshotRepository.class);
    final CurrentUserService currentUser = mock(CurrentUserService.class);
    final BacktestingResearchService service = new BacktestingResearchService(workspaces, repository, screenshots, null, currentUser, new ObjectMapper(), null, null);
    final User user = User.builder().id(UUID.randomUUID()).build();
    final BacktestingWorkspace workspace = BacktestingWorkspace.builder().id(UUID.randomUUID()).user(user).build();
    final BacktestingTrade winner = trade(BacktestingTradeResult.WIN, "11:00", "150");
    final BacktestingTrade loser = trade(BacktestingTradeResult.LOSS, "16:30", "-100");

    @BeforeEach void setup() {
        when(currentUser.getCurrentUser()).thenReturn(user);
        when(workspaces.findByIdAndUser_Id(workspace.getId(), user.getId())).thenReturn(Optional.of(workspace));
        when(repository.findAllById(any())).thenReturn(List.of(winner, loser));
    }
    BacktestingTrade trade(BacktestingTradeResult result, String time, String pnl) {
        return BacktestingTrade.builder().id(UUID.randomUUID()).workspace(workspace).user(user).date(LocalDate.of(2025, 10, 24))
                .entryTime(LocalTime.parse(time)).instrument("PEPPERSTONE:GER40F").direction(BacktestingTradeDirection.SHORT)
                .result(result).netPnl(new BigDecimal(pnl)).currency("EUR").source(BacktestingTradeSource.IMPORT)
                .tradeScope(BacktestingTradeScope.REPLAY).importFormat("TRADINGVIEW_REPLAY").importFingerprint("retained-" + time)
                .tagsJson("[\"keep\"]").notes("Keep this note").build();
    }
    BacktestingTradeBulkUpdateRequest request(String... fields) {
        var request = new BacktestingTradeBulkUpdateRequest();
        request.setTradeIds(List.of(winner.getId(), loser.getId()));
        request.setFields(Set.of(fields));
        return request;
    }
    @Test void fixedRewardRiskUsesEachOutcomeAndPreservesUnselectedFieldsAndExportIdentity() {
        var request = request("plannedRR"); request.getChanges().setPlannedRR(new BigDecimal("1.5"));
        request.setDeriveRFromPlannedRR(true); request.setRecalculateSession(true);
        var result = service.updateTrades(workspace.getId(), request);
        assertThat(result).hasSize(2);
        assertThat(winner.getPnlR()).isEqualByComparingTo("1.5"); assertThat(loser.getPnlR()).isEqualByComparingTo("-1");
        assertThat(winner.getSession()).isEqualTo("London"); assertThat(loser.getSession()).isEqualTo("New York");
        assertThat(winner.getNotes()).isEqualTo("Keep this note"); assertThat(winner.getTagsJson()).isEqualTo("[\"keep\"]");
        assertThat(winner.getNetPnl()).isEqualByComparingTo("150"); assertThat(winner.getSource()).isEqualTo(BacktestingTradeSource.IMPORT);
        assertThat(winner.getTradeScope()).isEqualTo(BacktestingTradeScope.REPLAY); assertThat(winner.getImportFingerprint()).isEqualTo("retained-11:00");
        assertThat(service.calculateMetrics(List.of(winner, loser)).getTotalR()).isEqualByComparingTo("0.5");
        verify(repository).saveAll(List.of(winner, loser));
    }
    @Test void canClearOnlyCheckedFieldsAndClassifyWithoutEditingOtherValues() {
        winner.setPlannedRR(BigDecimal.ZERO); // Legacy metadata is preserved when this field is unchecked.
        var request = request("notes"); request.setRecalculateSession(true);
        service.updateTrades(workspace.getId(), request);
        assertThat(winner.getNotes()).isNull(); assertThat(loser.getNotes()).isNull();
        assertThat(winner.getTagsJson()).isEqualTo("[\"keep\"]"); assertThat(winner.getPlannedRR()).isZero(); assertThat(winner.getPnlR()).isNull();
    }
    @Test void mixedResultsRejectOnePositiveRealizedRBeforeChangingAnyTrade() {
        var request = request("notes", "pnlR"); request.getChanges().setPnlR(new BigDecimal("1.5"));
        assertThatThrownBy(() -> service.updateTrades(workspace.getId(), request)).hasMessageContaining("match each trade's result");
        assertThat(winner.getNotes()).isEqualTo("Keep this note"); verify(repository, never()).saveAll(any());
    }
    @Test void rejectsMissingOrForeignOrLiveTradesAsOneOperation() {
        var request = request("notes");
        when(repository.findAllById(any())).thenReturn(List.of(winner));
        assertThatThrownBy(() -> service.updateTrades(workspace.getId(), request)).isInstanceOf(EntityNotFoundException.class);
        when(repository.findAllById(any())).thenReturn(List.of(winner, loser));
        loser.setUser(User.builder().id(UUID.randomUUID()).build());
        assertThatThrownBy(() -> service.updateTrades(workspace.getId(), request)).isInstanceOf(EntityNotFoundException.class);
        loser.setUser(user); loser.setWorkspace(BacktestingWorkspace.builder().id(UUID.randomUUID()).build());
        assertThatThrownBy(() -> service.updateTrades(workspace.getId(), request)).isInstanceOf(EntityNotFoundException.class);
        loser.setWorkspace(workspace); loser.setSource(BacktestingTradeSource.LIVE);
        assertThatThrownBy(() -> service.updateTrades(workspace.getId(), request)).isInstanceOf(EntityNotFoundException.class);
        assertThat(winner.getNotes()).isEqualTo("Keep this note"); verify(repository, never()).saveAll(any());
    }
    @Test void derivedRRequiresPositiveRatioAndCannotBeCombinedWithExplicitR() {
        var request = request(); request.setDeriveRFromPlannedRR(true);
        assertThatThrownBy(() -> service.updateTrades(workspace.getId(), request)).hasMessageContaining("positive planned R:R");
        request.setFields(Set.of("pnlR"));
        assertThatThrownBy(() -> service.updateTrades(workspace.getId(), request)).hasMessageContaining("either explicit R");
        verify(repository, never()).saveAll(any());
    }
    @Test void sourceTimezoneChangeReclassifiesEntryClockAndBreakevenIsZero() {
        winner.setResult(BacktestingTradeResult.BREAKEVEN);
        winner.setNetPnl(BigDecimal.ZERO);
        var request = request("plannedRR", "sourceTimezone"); request.getChanges().setPlannedRR(new BigDecimal("1.5"));
        request.getChanges().setSourceTimezone("UTC"); request.setDeriveRFromPlannedRR(true);
        service.updateTrades(workspace.getId(), request);
        assertThat(winner.getPnlR()).isZero(); assertThat(winner.getSession()).isEqualTo("London");
        assertThat(loser.getSession()).isEqualTo("New York");
    }

    static final String FVG_ENTRY = "SHORT GER / 2 | FVGv1 tf=5 lo=19198.5 hi=19210.0 size=11.5 sizePct=0.0599 created=1728397200000 mode=TOUCH depth=0 rr=3 BE=90/30";

    @Test void profitableProtectedStopUsesLockPercentageForBothDirectionsAndKeepsCashOutcome() {
        winner.setEntrySignal(FVG_ENTRY);
        winner.setExitSignal("BE | fillPct=0 fillBars=1 touchBars=1 ageMin=0");
        winner.setPnlR(new BigDecimal("3")); // The reported V2 error.
        var request = request("plannedRR"); request.getChanges().setPlannedRR(new BigDecimal("3"));
        request.setDeriveRFromPlannedRR(true);
        for (var direction : BacktestingTradeDirection.values()) {
            winner.setDirection(direction);
            service.updateTrades(workspace.getId(), request);
            assertThat(winner.getPnlR()).isEqualByComparingTo("0.9");
            assertThat(winner.getResult()).isEqualTo(BacktestingTradeResult.WIN);
            assertThat(winner.getNetPnl()).isEqualByComparingTo("150");
            assertThat(winner.getPlannedRR()).isEqualByComparingTo("3");
            assertThat(loser.getPnlR()).isEqualByComparingTo("-1");
            assertThat(winner.getImportFingerprint()).isEqualTo("retained-11:00");
        }
    }

    @Test void protectedStopUsesSelectedRatioAndLockRatherThanTriggerOrHardcodedPointNine() {
        winner.setEntrySignal(FVG_ENTRY.replace("BE=90/30", "BE=75/20"));
        winner.setExitSignal(" be | fillPct=0");
        var request = request("plannedRR"); request.getChanges().setPlannedRR(new BigDecimal("2.5"));
        request.setDeriveRFromPlannedRR(true);
        service.updateTrades(workspace.getId(), request);
        assertThat(winner.getPnlR()).isEqualByComparingTo("0.5");
        winner.setEntrySignal(FVG_ENTRY.replace("BE=90/30", "BE=90/0"));
        winner.setResult(BacktestingTradeResult.BREAKEVEN); winner.setNetPnl(BigDecimal.ZERO);
        service.updateTrades(workspace.getId(), request);
        assertThat(winner.getPnlR()).isZero();
    }

    @Test void unknownOrMalformedProtectedStopPreventsAllChanges() {
        loser.setExitSignal("BE");
        var request = request("plannedRR", "notes"); request.getChanges().setPlannedRR(new BigDecimal("3"));
        request.setDeriveRFromPlannedRR(true);
        for (String signal : List.of("SHORT GER / 2", FVG_ENTRY.replace("BE=90/30", "BE=OFF"),
                FVG_ENTRY.replace("BE=90/30", "BE=30/90"), FVG_ENTRY + " BE=90/20")) {
            loser.setEntrySignal(signal);
            assertThatThrownBy(() -> service.updateTrades(workspace.getId(), request)).isInstanceOf(IllegalArgumentException.class);
            assertThat(winner.getPnlR()).isNull(); assertThat(winner.getPlannedRR()).isNull();
            assertThat(winner.getNotes()).isEqualTo("Keep this note");
            verify(repository, never()).saveAll(any());
        }
    }

    @Test void configuringProtectionDoesNotReduceFullTargetWinnersOrMisreadBearishSignal() {
        winner.setEntrySignal(FVG_ENTRY);
        var request = request("plannedRR"); request.getChanges().setPlannedRR(new BigDecimal("3"));
        request.setDeriveRFromPlannedRR(true);
        for (String signal : List.of("TP | fillPct=0", "BEARISH TARGET")) {
            winner.setExitSignal(signal);
            service.updateTrades(workspace.getId(), request);
            assertThat(winner.getPnlR()).isEqualByComparingTo("3");
        }
    }

    @Test void v2OutcomeCountsReconcileTo67RInsteadOf109R() {
        List<BacktestingTrade> sample = new ArrayList<>();
        for (int i = 0; i < 523; i++) {
            var trade = trade(i < 158 ? BacktestingTradeResult.WIN : BacktestingTradeResult.LOSS, "17:20", i < 158 ? "100" : "-100");
            trade.setEntrySignal(FVG_ENTRY);
            trade.setExitSignal(i < 138 ? "TP" : i < 158 ? "BE | fillPct=0" : "SL");
            sample.add(trade);
        }
        when(repository.findAllById(any())).thenAnswer(call -> {
            Collection<UUID> batch = call.getArgument(0);
            return sample.stream().filter(trade -> batch.contains(trade.getId())).toList();
        });
        var request = new BacktestingTradeBulkUpdateRequest();
        request.setTradeIds(sample.stream().map(BacktestingTrade::getId).toList());
        request.setFields(Set.of("plannedRR")); request.getChanges().setPlannedRR(new BigDecimal("3"));
        request.setDeriveRFromPlannedRR(true);
        service.updateTrades(workspace.getId(), request);
        assertThat(sample.stream().map(BacktestingTrade::getPnlR).reduce(BigDecimal.ZERO, BigDecimal::add)).isEqualByComparingTo("67");
        assertThat(sample.stream().filter(t -> t.getPnlR().compareTo(new BigDecimal("0.9")) == 0)).hasSize(20);
        assertThat(service.calculateMetrics(sample).getTotalR()).isEqualByComparingTo("67");
        verify(repository).saveAll(sample);
    }

    @Test void supports529TradesWithBoundedLookupsAndOneAtomicSave() {
        List<BacktestingTrade> many = new ArrayList<>();
        for (int i = 0; i < 529; i++) many.add(trade(BacktestingTradeResult.WIN, "11:00", "150"));
        when(repository.findAllById(any())).thenAnswer(call -> {
            Collection<UUID> batch = call.getArgument(0);
            assertThat(batch).hasSizeLessThanOrEqualTo(500);
            return many.stream().filter(trade -> batch.contains(trade.getId())).toList();
        });
        var request = new BacktestingTradeBulkUpdateRequest();
        request.setTradeIds(many.stream().map(BacktestingTrade::getId).toList());
        request.setFields(Set.of("notes"));
        request.getChanges().setNotes("All selected trades");
        assertThat(service.updateTrades(workspace.getId(), request)).hasSize(529);
        assertThat(many).allSatisfy(trade -> assertThat(trade.getNotes()).isEqualTo("All selected trades"));
        verify(repository, times(2)).findAllById(any());
        verify(repository).saveAll(many);
    }

    @Test void invalidTradeInLaterLookupBatchPreventsEveryChange() {
        List<BacktestingTrade> many = new ArrayList<>();
        for (int i = 0; i < 529; i++) many.add(trade(BacktestingTradeResult.WIN, "11:00", "150"));
        many.get(528).setWorkspace(BacktestingWorkspace.builder().id(UUID.randomUUID()).build());
        when(repository.findAllById(any())).thenAnswer(call -> {
            Collection<UUID> batch = call.getArgument(0);
            return many.stream().filter(trade -> batch.contains(trade.getId())).toList();
        });
        var request = new BacktestingTradeBulkUpdateRequest();
        request.setTradeIds(many.stream().map(BacktestingTrade::getId).toList());
        request.setFields(Set.of("notes"));
        assertThatThrownBy(() -> service.updateTrades(workspace.getId(), request)).isInstanceOf(EntityNotFoundException.class);
        assertThat(many).allSatisfy(trade -> assertThat(trade.getNotes()).isEqualTo("Keep this note"));
        verify(repository, never()).saveAll(any());
    }
}
