package com.tradevault.service.backtesting;

import com.tradevault.domain.entity.BacktestEvidenceLink;
import com.tradevault.domain.entity.BacktestingWorkspace;
import com.tradevault.domain.enums.BacktestingAutoImportMode;
import com.tradevault.domain.enums.BacktestingClassificationStatus;
import com.tradevault.domain.enums.BacktestingSyncStatus;
import com.tradevault.dto.backtesting.BacktestingCompatibilityCheckResponse;
import com.tradevault.dto.backtesting.BacktestingWorkspaceCompatibilityResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class BacktestingWorkspaceCompatibilityService {
    private final InstrumentAliasService instrumentAliasService;

    public BacktestingWorkspaceCompatibilityResponse evaluate(BacktestingWorkspace workspace,
                                                              BacktestEvidenceLink evidence) {
        BacktestingAutoImportMode mode = workspace.getAutoImportMode() == null
                ? BacktestingAutoImportMode.EXACT_MATCH : workspace.getAutoImportMode();
        boolean exactRulesRequired = mode == BacktestingAutoImportMode.EXACT_MATCH;
        List<BacktestingCompatibilityCheckResponse> checks = new ArrayList<>();

        boolean included = evidence.getSyncStatus() != BacktestingSyncStatus.EXCLUDED;
        checks.add(check(included ? "TRADE_INCLUDED" : "TRADE_EXCLUDED", included, true, null, null));

        boolean strategyMatches = workspace.getStrategy() != null
                && Objects.equals(workspace.getStrategy().getId(), evidence.getStrategyId());
        checks.add(check(strategyMatches ? "STRATEGY_MATCH" : "STRATEGY_MISMATCH", strategyMatches, true,
                evidence.getStrategyNameSnapshot(), strategyName(workspace)));

        InstrumentMatch instrumentMatch = instrumentMatch(workspace.getSymbol(), evidence.getInstrument());
        checks.add(check(instrumentMatch.code(), instrumentMatch.matches(), exactRulesRequired,
                evidence.getInstrument(), workspace.getSymbol()));

        boolean sessionMatches = optionalSessionMatch(workspace.getSession(), evidence.getSession());
        checks.add(check(sessionMatches ? "SESSION_MATCH" : "SESSION_MISMATCH", sessionMatches,
                exactRulesRequired && StringUtils.hasText(workspace.getSession()), evidence.getSession(), workspace.getSession()));

        boolean timeframeMatches = optionalTimeframeMatch(workspace.getPrimaryTimeframe(), evidence.getTimeframe());
        checks.add(check(timeframeMatches ? "TIMEFRAME_MATCH" : "TIMEFRAME_MISMATCH", timeframeMatches,
                exactRulesRequired && StringUtils.hasText(workspace.getPrimaryTimeframe()), evidence.getTimeframe(), workspace.getPrimaryTimeframe()));

        boolean classificationComplete = evidence.getClassificationStatus() == BacktestingClassificationStatus.COMPLETE;
        if (!classificationComplete) {
            checks.add(check("CLASSIFICATION_INCOMPLETE", false, false,
                    evidence.getClassificationStatus() == null ? BacktestingClassificationStatus.NEEDS_CLASSIFICATION.name()
                            : evidence.getClassificationStatus().name(), null));
        }

        boolean acceptsLiveEvidence = mode != BacktestingAutoImportMode.DISABLED;
        if (!acceptsLiveEvidence) {
            checks.add(check("WORKSPACE_IMPORT_DISABLED", false, true, null, null));
        }

        boolean compatible = checks.stream().noneMatch(item -> item.isBlocking() && !item.isMatches());
        return BacktestingWorkspaceCompatibilityResponse.builder()
                .workspaceId(workspace.getId())
                .workspaceName(workspaceName(workspace))
                .strategyName(strategyName(workspace))
                .instrument(workspace.getSymbol())
                .canonicalInstrumentId(instrumentAliasService.resolveCanonicalInstrument(workspace.getSymbol())
                        .map(InstrumentAliasService.CanonicalInstrument::id).orElse(null))
                .session(workspace.getSession())
                .timeframe(workspace.getPrimaryTimeframe())
                .autoImportMode(mode.name())
                .compatible(compatible)
                .selectable(compatible)
                .checks(List.copyOf(checks))
                .build();
    }

    public boolean isAutomaticMatch(BacktestingWorkspace workspace, BacktestEvidenceLink evidence) {
        BacktestingAutoImportMode mode = workspace.getAutoImportMode();
        return (mode == BacktestingAutoImportMode.EXACT_MATCH || mode == BacktestingAutoImportMode.STRATEGY_MATCH)
                && evaluate(workspace, evidence).isCompatible();
    }

    public boolean isReviewMatch(BacktestingWorkspace workspace, BacktestEvidenceLink evidence) {
        return workspace.getAutoImportMode() == BacktestingAutoImportMode.REVIEW_BEFORE_IMPORT
                && evaluate(workspace, evidence).isCompatible();
    }

    private InstrumentMatch instrumentMatch(String workspaceSymbol, String tradeSymbol) {
        String workspaceToken = instrumentAliasService.normalizeDisplayToken(workspaceSymbol);
        String tradeToken = instrumentAliasService.normalizeDisplayToken(tradeSymbol);
        if (!workspaceToken.isEmpty() && workspaceToken.equals(tradeToken)) {
            return new InstrumentMatch(true, "INSTRUMENT_MATCH");
        }
        var workspaceCanonical = instrumentAliasService.resolveCanonicalInstrument(workspaceSymbol);
        var tradeCanonical = instrumentAliasService.resolveCanonicalInstrument(tradeSymbol);
        if (workspaceCanonical.isPresent() && tradeCanonical.isPresent()
                && workspaceCanonical.get().id().equals(tradeCanonical.get().id())) {
            return new InstrumentMatch(true, "INSTRUMENT_ALIAS_MATCH");
        }
        return new InstrumentMatch(false, "INSTRUMENT_MISMATCH");
    }

    private boolean optionalSessionMatch(String expected, String actual) {
        if (!StringUtils.hasText(expected)) return true;
        if (!StringUtils.hasText(actual)) return false;
        return normalizeSession(expected).equals(normalizeSession(actual));
    }

    private boolean optionalTimeframeMatch(String expected, String actual) {
        if (!StringUtils.hasText(expected)) return true;
        if (!StringUtils.hasText(actual)) return false;
        return normalizeTimeframe(expected).equals(normalizeTimeframe(actual));
    }

    private String normalizeSession(String value) {
        return switch (instrumentAliasService.normalizeDisplayToken(value)) {
            case "NEWYORKAM", "NYAM" -> "NYAM";
            case "NEWYORKPM", "NYPM" -> "NYPM";
            case "NEWYORK", "NY" -> "NY";
            default -> instrumentAliasService.normalizeDisplayToken(value);
        };
    }

    private String normalizeTimeframe(String value) {
        String normalized = instrumentAliasService.normalizeDisplayToken(value)
                .replace("MINUTES", "M")
                .replace("MINUTE", "M")
                .replace("MINS", "M")
                .replace("MIN", "M")
                .replace("HOURS", "H")
                .replace("HOUR", "H")
                .replace("HRS", "H")
                .replace("HR", "H");
        if (normalized.matches("M[0-9]+")) return normalized.substring(1) + "M";
        if (normalized.matches("H[0-9]+")) return normalized.substring(1) + "H";
        return normalized;
    }

    private BacktestingCompatibilityCheckResponse check(String code, boolean matches, boolean blocking,
                                                         String tradeValue, String workspaceValue) {
        return BacktestingCompatibilityCheckResponse.builder()
                .code(code)
                .matches(matches)
                .blocking(blocking)
                .tradeValue(tradeValue)
                .workspaceValue(workspaceValue)
                .build();
    }

    private String strategyName(BacktestingWorkspace workspace) {
        return workspace.getStrategy() == null ? workspace.getStrategyNameSnapshot() : workspace.getStrategy().getName();
    }

    private String workspaceName(BacktestingWorkspace workspace) {
        if (StringUtils.hasText(workspace.getTitle())) return workspace.getTitle();
        String strategy = strategyName(workspace);
        return workspace.getSymbol() + (StringUtils.hasText(strategy) ? " · " + strategy : "");
    }

    private record InstrumentMatch(boolean matches, String code) { }
}
