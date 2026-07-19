package com.tradevault.service.backtesting;

import com.tradevault.domain.entity.BacktestEvidenceLink;
import com.tradevault.domain.entity.BacktestingWorkspace;
import com.tradevault.domain.entity.UserStrategy;
import com.tradevault.domain.enums.BacktestingAutoImportMode;
import com.tradevault.domain.enums.BacktestingClassificationStatus;
import com.tradevault.domain.enums.BacktestingSyncStatus;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class BacktestingWorkspaceCompatibilityServiceTest {
    private final InstrumentAliasService aliases = new InstrumentAliasService();
    private final BacktestingWorkspaceCompatibilityService service = new BacktestingWorkspaceCompatibilityService(aliases);
    private final UUID strategyId = UUID.randomUUID();

    @Test
    void reportsDaxAliasMatchAndTreatsIncompleteClassificationAsNonBlocking() {
        var result = service.evaluate(workspace(BacktestingAutoImportMode.EXACT_MATCH, strategyId, "DAX", "London", "1m"),
                evidence(strategyId, "GER40", "London", "1m", BacktestingSyncStatus.NOT_LINKED));

        assertThat(result.isCompatible()).isTrue();
        assertThat(result.getCanonicalInstrumentId()).isEqualTo(InstrumentAliasService.DAX_INDEX);
        assertThat(result.getChecks()).anySatisfy(check -> {
            assertThat(check.getCode()).isEqualTo("INSTRUMENT_ALIAS_MATCH");
            assertThat(check.isMatches()).isTrue();
            assertThat(check.isBlocking()).isTrue();
        });
        assertThat(result.getChecks()).anySatisfy(check -> {
            assertThat(check.getCode()).isEqualTo("CLASSIFICATION_INCOMPLETE");
            assertThat(check.isBlocking()).isFalse();
        });
    }

    @Test
    void strategyMismatchIsAlwaysBlockingAndExplicit() {
        var result = service.evaluate(workspace(BacktestingAutoImportMode.STRATEGY_MATCH, UUID.randomUUID(), "DAX", null, null),
                evidence(strategyId, "GER40", "London", "1m", BacktestingSyncStatus.NOT_LINKED));

        assertThat(result.isSelectable()).isFalse();
        assertThat(result.getChecks()).anySatisfy(check -> {
            assertThat(check.getCode()).isEqualTo("STRATEGY_MISMATCH");
            assertThat(check.isBlocking()).isTrue();
        });
    }

    @Test
    void exactModeBlocksSessionAndTimeframeMismatches() {
        var result = service.evaluate(workspace(BacktestingAutoImportMode.EXACT_MATCH, strategyId, "DAX", "New York", "5m"),
                evidence(strategyId, "DE40", "London", "1m", BacktestingSyncStatus.NOT_LINKED));

        assertThat(result.isCompatible()).isFalse();
        assertThat(result.getChecks()).filteredOn(check -> !check.isMatches() && check.isBlocking())
                .extracting("code").containsExactlyInAnyOrder("SESSION_MISMATCH", "TIMEFRAME_MISMATCH");
    }

    @Test
    void strategyModeShowsInstrumentMismatchWithoutMakingItABlocker() {
        var result = service.evaluate(workspace(BacktestingAutoImportMode.STRATEGY_MATCH, strategyId, "NQ", "New York", "5m"),
                evidence(strategyId, "GER40", "London", "1m", BacktestingSyncStatus.NOT_LINKED));

        assertThat(result.isCompatible()).isTrue();
        assertThat(result.getChecks()).anySatisfy(check -> {
            assertThat(check.getCode()).isEqualTo("INSTRUMENT_MISMATCH");
            assertThat(check.isBlocking()).isFalse();
        });
    }

    @Test
    void excludedTradeAndDisabledWorkspaceAreNotSelectable() {
        var result = service.evaluate(workspace(BacktestingAutoImportMode.DISABLED, strategyId, "DAX", null, null),
                evidence(strategyId, "GER40", null, null, BacktestingSyncStatus.EXCLUDED));

        assertThat(result.isSelectable()).isFalse();
        assertThat(result.getChecks()).extracting("code")
                .contains("TRADE_EXCLUDED", "WORKSPACE_IMPORT_DISABLED");
    }

    private BacktestingWorkspace workspace(BacktestingAutoImportMode mode, UUID linkedStrategyId, String instrument,
                                           String session, String timeframe) {
        return BacktestingWorkspace.builder()
                .id(UUID.randomUUID())
                .title("Money maker")
                .strategy(UserStrategy.builder().id(linkedStrategyId).name("Liquidity setup").build())
                .symbol(instrument)
                .session(session)
                .primaryTimeframe(timeframe)
                .autoImportMode(mode)
                .build();
    }

    private BacktestEvidenceLink evidence(UUID tradeStrategyId, String instrument, String session, String timeframe,
                                          BacktestingSyncStatus syncStatus) {
        return BacktestEvidenceLink.builder()
                .strategyId(tradeStrategyId)
                .strategyNameSnapshot("Liquidity setup")
                .instrument(instrument)
                .session(session)
                .timeframe(timeframe)
                .syncStatus(syncStatus)
                .classificationStatus(BacktestingClassificationStatus.NEEDS_CLASSIFICATION)
                .build();
    }
}
