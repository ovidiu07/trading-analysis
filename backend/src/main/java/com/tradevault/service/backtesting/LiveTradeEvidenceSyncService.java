package com.tradevault.service.backtesting;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.BacktestEvidenceLink;
import com.tradevault.domain.entity.BacktestingTrade;
import com.tradevault.domain.entity.BacktestingWorkspace;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.BacktestingAutoImportMode;
import com.tradevault.domain.enums.BacktestingClassificationStatus;
import com.tradevault.domain.enums.BacktestingEvidenceSource;
import com.tradevault.domain.enums.BacktestingSyncStatus;
import com.tradevault.domain.enums.BacktestingTradeDirection;
import com.tradevault.domain.enums.BacktestingTradeResult;
import com.tradevault.domain.enums.BacktestingTradeScope;
import com.tradevault.domain.enums.BacktestingTradeSource;
import com.tradevault.domain.enums.BacktestingWorkspaceStatus;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.backtesting.BacktestingEvidenceResponse;
import com.tradevault.dto.backtesting.BacktestingEvidenceLinkRequest;
import com.tradevault.dto.backtesting.BacktestingEvidenceUpdateRequest;
import com.tradevault.dto.backtesting.BacktestingResearchInboxResponse;
import com.tradevault.dto.backtesting.BacktestingTradeResponse;
import com.tradevault.dto.backtesting.BacktestingWorkspaceCompatibilityResponse;
import com.tradevault.repository.BacktestEvidenceLinkRepository;
import com.tradevault.repository.BacktestingWorkspaceRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.repository.UserStrategyRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LiveTradeEvidenceSyncService {
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() { };

    private final BacktestEvidenceLinkRepository evidenceRepository;
    private final BacktestingWorkspaceRepository workspaceRepository;
    private final TradeRepository tradeRepository;
    private final UserStrategyRepository strategyRepository;
    private final ObjectMapper objectMapper;
    private final InstrumentAliasService instrumentAliasService;
    private final BacktestingWorkspaceCompatibilityService compatibilityService;

    @Transactional
    public BacktestEvidenceLink synchronize(UUID liveTradeId, UUID userId) {
        Trade trade = tradeRepository.findByIdAndUserId(liveTradeId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Live trade not found"));
        return synchronize(trade);
    }

    @Transactional
    public BacktestEvidenceLink synchronize(Trade trade) {
        User user = Objects.requireNonNull(trade.getUser(), "trade user is required");
        BacktestEvidenceLink link = evidenceRepository.findByLiveTradeIdAndUser_Id(trade.getId(), user.getId())
                .orElseGet(() -> BacktestEvidenceLink.builder()
                        .user(user)
                        .liveTradeId(trade.getId())
                        .sourceType(BacktestingEvidenceSource.LIVE)
                        .syncStatus(BacktestingSyncStatus.PENDING)
                        .classificationStatus(BacktestingClassificationStatus.NEEDS_CLASSIFICATION)
                        .includedInAnalytics(false)
                        .build());

        applySnapshot(link, trade);
        if (link.getSyncStatus() == BacktestingSyncStatus.EXCLUDED) {
            link.setIncludedInAnalytics(false);
            return evidenceRepository.save(link);
        }
        if (trade.getStatus() != TradeStatus.CLOSED) {
            link.setSyncStatus(BacktestingSyncStatus.PENDING);
            link.setIncludedInAnalytics(false);
            link.setExcludedReason("TRADE_OPEN_OR_REOPENED");
            return evidenceRepository.save(link);
        }
        if (!hasValidOutcome(trade)) {
            link.setSyncStatus(BacktestingSyncStatus.PENDING);
            link.setIncludedInAnalytics(false);
            link.setExcludedReason("MISSING_REALIZED_OUTCOME");
            return evidenceRepository.save(link);
        }
        if (link.getWorkspace() != null
                && (link.getWorkspace().getStatus() == BacktestingWorkspaceStatus.ARCHIVED
                || link.getWorkspace().getAutoImportMode() == BacktestingAutoImportMode.DISABLED)) {
            // Disabling or archiving stops new matches, but previously linked evidence remains intact.
            link.setSyncStatus(BacktestingSyncStatus.SYNCED);
            link.setIncludedInAnalytics(true);
            link.setExcludedReason(null);
            return evidenceRepository.save(link);
        }
        if (trade.getStrategyId() == null) {
            link.setWorkspace(null);
            link.setSyncStatus(BacktestingSyncStatus.NOT_LINKED);
            link.setIncludedInAnalytics(false);
            link.setExcludedReason("MISSING_STRATEGY");
            return evidenceRepository.save(link);
        }

        List<BacktestingWorkspace> strategyWorkspaces = workspaceRepository
                .findByUser_IdAndStatusAndStrategy_IdOrderByUpdatedAtDesc(
                        user.getId(), BacktestingWorkspaceStatus.ACTIVE, trade.getStrategyId());
        List<BacktestingWorkspace> automaticMatches = strategyWorkspaces.stream()
                .filter(workspace -> compatibilityService.isAutomaticMatch(workspace, link))
                .toList();

        if (automaticMatches.size() == 1) {
            link.setWorkspace(automaticMatches.get(0));
            link.setSyncStatus(BacktestingSyncStatus.SYNCED);
            link.setIncludedInAnalytics(true);
            link.setExcludedReason(null);
            automaticMatches.get(0).setUpdatedAt(OffsetDateTime.now());
            return evidenceRepository.save(link);
        }
        if (automaticMatches.size() > 1) {
            link.setWorkspace(null);
            link.setSyncStatus(BacktestingSyncStatus.NEEDS_REVIEW);
            link.setIncludedInAnalytics(false);
            link.setExcludedReason("AMBIGUOUS_WORKSPACE_MATCH");
            return evidenceRepository.save(link);
        }

        List<BacktestingWorkspace> reviewMatches = strategyWorkspaces.stream()
                .filter(workspace -> compatibilityService.isReviewMatch(workspace, link))
                .toList();
        if (reviewMatches.size() == 1) {
            link.setWorkspace(reviewMatches.get(0));
            link.setSyncStatus(BacktestingSyncStatus.NEEDS_REVIEW);
            link.setIncludedInAnalytics(false);
            link.setExcludedReason("REVIEW_BEFORE_IMPORT");
        } else if (reviewMatches.size() > 1) {
            link.setWorkspace(null);
            link.setSyncStatus(BacktestingSyncStatus.NEEDS_REVIEW);
            link.setIncludedInAnalytics(false);
            link.setExcludedReason("AMBIGUOUS_WORKSPACE_MATCH");
        } else {
            link.setWorkspace(null);
            link.setSyncStatus(BacktestingSyncStatus.NOT_LINKED);
            link.setIncludedInAnalytics(false);
            link.setExcludedReason("NO_MATCHING_WORKSPACE");
        }
        return evidenceRepository.save(link);
    }

    @Transactional
    public void reconcileWorkspace(BacktestingWorkspace workspace) {
        if (workspace.getStrategy() == null || workspace.getStatus() != BacktestingWorkspaceStatus.ACTIVE
                || workspace.getAutoImportMode() == BacktestingAutoImportMode.DISABLED) {
            return;
        }
        tradeRepository.findByUser_IdAndStrategyIdAndStatus(
                        workspace.getUser().getId(), workspace.getStrategy().getId(), TradeStatus.CLOSED)
                .forEach(this::synchronize);
    }

    @Transactional
    public void markDeleted(UUID liveTradeId, UUID userId) {
        evidenceRepository.findByLiveTradeIdAndUser_Id(liveTradeId, userId).ifPresent(link -> {
            link.setSyncStatus(BacktestingSyncStatus.EXCLUDED);
            link.setIncludedInAnalytics(false);
            link.setExcludedReason("LIVE_TRADE_DELETED");
            link.setLastSyncedAt(OffsetDateTime.now());
            evidenceRepository.save(link);
        });
    }

    @Transactional
    public void markError(UUID liveTradeId, UUID userId, String message) {
        BacktestEvidenceLink link = evidenceRepository.findByLiveTradeIdAndUser_Id(liveTradeId, userId).orElse(null);
        if (link == null) return;
        link.setSyncStatus(BacktestingSyncStatus.ERROR);
        link.setIncludedInAnalytics(false);
        link.setExcludedReason(StringUtils.hasText(message) ? message : "SYNC_ERROR");
        link.setLastSyncedAt(OffsetDateTime.now());
        evidenceRepository.save(link);
    }

    @Transactional(readOnly = true)
    public List<BacktestEvidenceLink> includedLinks(UUID workspaceId, UUID userId) {
        return evidenceRepository
                .findByWorkspace_IdAndUser_IdAndIncludedInAnalyticsTrueOrderByTradeDateAscOpenedAtAscCreatedAtAsc(workspaceId, userId);
    }

    @Transactional(readOnly = true)
    public List<BacktestEvidenceLink> linksForWorkspaces(List<UUID> workspaceIds) {
        return workspaceIds.isEmpty() ? List.of() : evidenceRepository.findByWorkspace_IdIn(workspaceIds);
    }

    @Transactional(readOnly = true)
    public BacktestingResearchInboxResponse researchInbox(UUID userId) {
        List<BacktestingWorkspace> activeWorkspaces = workspaceRepository
                .findByUser_IdAndStatusOrderByUpdatedAtDesc(userId, BacktestingWorkspaceStatus.ACTIVE);
        List<BacktestingEvidenceResponse> items = evidenceRepository.findByUser_IdOrderByUpdatedAtDesc(userId).stream()
                .filter(link -> link.getSyncStatus() != BacktestingSyncStatus.SYNCED
                        || link.getClassificationStatus() != BacktestingClassificationStatus.COMPLETE)
                .map(link -> toEvidenceResponse(link, activeWorkspaces))
                .toList();
        return BacktestingResearchInboxResponse.builder()
                .total(items.size())
                .needsWorkspace((int) items.stream().filter(item -> "NOT_LINKED".equals(item.getSyncStatus())).count())
                .needsClassification((int) items.stream().filter(item -> "NEEDS_CLASSIFICATION".equals(item.getClassificationStatus()) || "PARTIAL".equals(item.getClassificationStatus())).count())
                .ambiguousMatch((int) items.stream().filter(item -> "NEEDS_REVIEW".equals(item.getSyncStatus()) && "AMBIGUOUS_WORKSPACE_MATCH".equals(item.getExcludedReason())).count())
                .syncErrors((int) items.stream().filter(item -> "ERROR".equals(item.getSyncStatus())).count())
                .excluded((int) items.stream().filter(item -> "EXCLUDED".equals(item.getSyncStatus())).count())
                .items(items)
                .build();
    }

    @Transactional
    public BacktestingEvidenceResponse updateEvidence(UUID evidenceId, UUID userId, BacktestingEvidenceUpdateRequest request) {
        BacktestEvidenceLink link = evidenceRepository.findByIdAndUser_Id(evidenceId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Backtesting evidence not found"));
        if (request.getWorkspaceId() != null) {
            if (link.getSyncStatus() == BacktestingSyncStatus.EXCLUDED) {
                throw new IllegalArgumentException("Excluded evidence must be included before linking");
            }
            BacktestingWorkspace workspace = workspaceRepository
                    .findByIdAndUser_IdAndStatus(request.getWorkspaceId(), userId, BacktestingWorkspaceStatus.ACTIVE)
                    .orElseThrow(() -> new EntityNotFoundException("Active backtesting workspace not found"));
            if (!compatibilityService.evaluate(workspace, link).isSelectable()) {
                throw new IllegalArgumentException("Backtesting workspace is not compatible with this trade");
            }
            link.setWorkspace(workspace);
            link.setSyncStatus(BacktestingSyncStatus.SYNCED);
            link.setExcludedReason(null);
        }
        if (request.getClassificationStatus() != null) {
            link.setClassificationStatus(request.getClassificationStatus());
        }
        if (request.getResearchClassification() != null) {
            link.setResearchClassificationJson(writeMap(request.getResearchClassification()));
        }
        if (StringUtils.hasText(request.getExcludedReason())) {
            link.setExcludedReason("USER_EXCLUDED");
            link.setSyncStatus(BacktestingSyncStatus.EXCLUDED);
            link.setIncludedInAnalytics(false);
        } else if (request.getIncludedInAnalytics() != null) {
            boolean canInclude = link.getWorkspace() != null && link.getResult() != null
                    && link.getSyncStatus() != BacktestingSyncStatus.EXCLUDED;
            link.setIncludedInAnalytics(request.getIncludedInAnalytics() && canInclude);
            if (link.isIncludedInAnalytics()) link.setSyncStatus(BacktestingSyncStatus.SYNCED);
        }
        link.setLastSyncedAt(OffsetDateTime.now());
        return toEvidenceResponseWithOptions(evidenceRepository.save(link), userId);
    }

    @Transactional
    public BacktestingEvidenceResponse includeInResearch(UUID evidenceId, UUID userId) {
        BacktestEvidenceLink link = evidenceRepository.findByIdAndUser_Id(evidenceId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Backtesting evidence not found"));
        if (link.getSyncStatus() != BacktestingSyncStatus.EXCLUDED) {
            return toEvidenceResponseWithOptions(link, userId);
        }
        if ("LIVE_TRADE_DELETED".equals(link.getExcludedReason())) {
            throw new IllegalArgumentException("Deleted live-trade evidence cannot be re-included");
        }
        link.setSyncStatus(BacktestingSyncStatus.PENDING);
        link.setIncludedInAnalytics(false);
        link.setExcludedReason(null);
        link.setLastSyncedAt(OffsetDateTime.now());
        evidenceRepository.save(link);
        return toEvidenceResponseWithOptions(synchronize(link.getLiveTradeId(), userId), userId);
    }

    @Transactional
    public BacktestingEvidenceResponse excludeFromResearch(UUID evidenceId, UUID userId) {
        BacktestEvidenceLink link = evidenceRepository.findByIdAndUser_Id(evidenceId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Backtesting evidence not found"));
        if (link.getSyncStatus() != BacktestingSyncStatus.EXCLUDED) {
            link.setSyncStatus(BacktestingSyncStatus.EXCLUDED);
            link.setIncludedInAnalytics(false);
            link.setExcludedReason("USER_EXCLUDED");
            link.setLastSyncedAt(OffsetDateTime.now());
            if (link.getWorkspace() != null) link.getWorkspace().setUpdatedAt(OffsetDateTime.now());
            link = evidenceRepository.save(link);
        }
        return toEvidenceResponseWithOptions(link, userId);
    }

    @Transactional
    public BacktestingEvidenceResponse linkToWorkspace(UUID evidenceId, UUID userId,
                                                       BacktestingEvidenceLinkRequest request) {
        BacktestEvidenceLink link = evidenceRepository.findByIdAndUser_Id(evidenceId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Backtesting evidence not found"));
        if (link.getSyncStatus() == BacktestingSyncStatus.EXCLUDED) {
            throw new IllegalArgumentException("Excluded evidence must be included before linking");
        }
        BacktestingWorkspace workspace = workspaceRepository
                .findByIdAndUser_IdAndStatus(request.getWorkspaceId(), userId, BacktestingWorkspaceStatus.ACTIVE)
                .orElseThrow(() -> new EntityNotFoundException("Active backtesting workspace not found"));
        BacktestingWorkspaceCompatibilityResponse compatibility = compatibilityService.evaluate(workspace, link);
        if (!compatibility.isSelectable()) {
            throw new IllegalArgumentException("Backtesting workspace is not compatible with this trade");
        }
        link.setWorkspace(workspace);
        link.setSyncStatus(BacktestingSyncStatus.SYNCED);
        link.setExcludedReason(null);
        link.setIncludedInAnalytics(link.getClosedAt() != null && link.getResult() != null
                && link.getDirection() != null && link.getRealizedR() != null);
        link.setLastSyncedAt(OffsetDateTime.now());
        workspace.setUpdatedAt(OffsetDateTime.now());
        return toEvidenceResponseWithOptions(evidenceRepository.save(link), userId);
    }

    @Transactional
    public BacktestingEvidenceResponse retry(UUID evidenceId, UUID userId) {
        BacktestEvidenceLink link = evidenceRepository.findByIdAndUser_Id(evidenceId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Backtesting evidence not found"));
        if (link.getSyncStatus() == BacktestingSyncStatus.EXCLUDED) {
            throw new IllegalArgumentException("Excluded evidence must be included explicitly before retrying");
        }
        return toEvidenceResponseWithOptions(synchronize(link.getLiveTradeId(), userId), userId);
    }

    public BacktestingTrade materialize(BacktestEvidenceLink link) {
        if (link.getWorkspace() == null) {
            throw new IllegalArgumentException("Linked evidence must have a workspace before analytics materialization");
        }
        LocalDate date = link.getTradeDate() != null ? link.getTradeDate()
                : link.getClosedAt() != null ? link.getClosedAt().toLocalDate() : LocalDate.now();
        String weekday = weekday(date);
        return BacktestingTrade.builder()
                .id(link.getId())
                .workspace(link.getWorkspace())
                .user(link.getUser())
                .date(date)
                .weekday(weekday)
                .entryTime(link.getOpenedAt() == null ? LocalTime.MIDNIGHT : link.getOpenedAt().toLocalTime())
                .instrument(link.getInstrument())
                .direction(BacktestingTradeDirection.valueOf(link.getDirection()))
                .session(link.getSession())
                .setupName(link.getSetupName())
                .strategyId(link.getStrategyId())
                .strategySource("MY")
                .strategyNameSnapshot(link.getStrategyNameSnapshot())
                .riskPercent(link.getRiskPercent())
                .result(BacktestingTradeResult.valueOf(link.getResult()))
                .pnlR(link.getRealizedR())
                .contextTimeframe(link.getTimeframe())
                .executionTimeframe(link.getTimeframe())
                .entryTimeframe(link.getTimeframe())
                .tagsJson("[]")
                .notes(link.getNotesSnapshot())
                .source(BacktestingTradeSource.LIVE)
                .tradeScope(BacktestingTradeScope.LIVE)
                .createdAt(link.getCreatedAt())
                .updatedAt(link.getUpdatedAt())
                .build();
    }

    public BacktestingTradeResponse toTradeResponse(BacktestEvidenceLink link) {
        BacktestingTrade trade = materialize(link);
        return BacktestingTradeResponse.builder()
                .id(link.getId())
                .workspaceId(link.getWorkspace().getId())
                .liveTradeId(link.getLiveTradeId())
                .date(trade.getDate())
                .weekday(trade.getWeekday())
                .entryTime(trade.getEntryTime())
                .instrument(trade.getInstrument())
                .direction(trade.getDirection())
                .session(trade.getSession())
                .setupName(trade.getSetupName())
                .strategyId(trade.getStrategyId())
                .strategySource(trade.getStrategySource())
                .strategyNameSnapshot(trade.getStrategyNameSnapshot())
                .riskPercent(trade.getRiskPercent())
                .result(trade.getResult())
                .pnlR(trade.getPnlR())
                .contextTimeframe(trade.getContextTimeframe())
                .executionTimeframe(trade.getExecutionTimeframe())
                .entryTimeframe(trade.getEntryTimeframe())
                .tags(List.of())
                .notes(trade.getNotes())
                .source(BacktestingTradeSource.LIVE)
                .tradeScope(BacktestingTradeScope.LIVE)
                .syncStatus(link.getSyncStatus().name())
                .classificationStatus(link.getClassificationStatus().name())
                .includedInAnalytics(link.isIncludedInAnalytics())
                .excludedReason(link.getExcludedReason())
                .ruleBreakCount(link.getRuleBreakCount())
                .screenshotCount(link.getScreenshotCount())
                .createdAt(link.getCreatedAt())
                .updatedAt(link.getUpdatedAt())
                .build();
    }

    public BacktestingEvidenceResponse toEvidenceResponse(BacktestEvidenceLink link) {
        return toEvidenceResponse(link, List.of());
    }

    private BacktestingEvidenceResponse toEvidenceResponseWithOptions(BacktestEvidenceLink link, UUID userId) {
        List<BacktestingWorkspace> activeWorkspaces = workspaceRepository
                .findByUser_IdAndStatusOrderByUpdatedAtDesc(userId, BacktestingWorkspaceStatus.ACTIVE);
        return toEvidenceResponse(link, activeWorkspaces);
    }

    private BacktestingEvidenceResponse toEvidenceResponse(BacktestEvidenceLink link,
                                                            List<BacktestingWorkspace> activeWorkspaces) {
        List<BacktestingWorkspaceCompatibilityResponse> workspaceOptions = activeWorkspaces.stream()
                .map(workspace -> compatibilityService.evaluate(workspace, link))
                .sorted(Comparator.comparing(BacktestingWorkspaceCompatibilityResponse::isCompatible).reversed()
                        .thenComparing(BacktestingWorkspaceCompatibilityResponse::getWorkspaceName,
                                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();
        return BacktestingEvidenceResponse.builder()
                .id(link.getId())
                .workspaceId(link.getWorkspace() == null ? null : link.getWorkspace().getId())
                .workspaceName(link.getWorkspace() == null ? null : workspaceName(link.getWorkspace()))
                .liveTradeId(link.getLiveTradeId())
                .sourceType(link.getSourceType().name())
                .syncStatus(link.getSyncStatus().name())
                .researchInclusionStatus(link.getSyncStatus() == BacktestingSyncStatus.EXCLUDED ? "EXCLUDED" : "INCLUDED")
                .workspaceLinkStatus(workspaceLinkStatus(link))
                .classificationStatus(link.getClassificationStatus().name())
                .includedInAnalytics(link.isIncludedInAnalytics())
                .excludedReason(link.getExcludedReason())
                .canonicalInstrumentId(instrumentAliasService.resolveCanonicalInstrument(link.getInstrument())
                        .map(InstrumentAliasService.CanonicalInstrument::id).orElse(null))
                .workspaceOptions(workspaceOptions)
                .researchClassification(readMap(link.getResearchClassificationJson()))
                .tradeDate(link.getTradeDate())
                .openedAt(link.getOpenedAt())
                .closedAt(link.getClosedAt())
                .instrument(link.getInstrument())
                .direction(link.getDirection())
                .session(link.getSession())
                .timeframe(link.getTimeframe())
                .strategyId(link.getStrategyId())
                .strategyName(link.getStrategyNameSnapshot())
                .setupName(link.getSetupName())
                .setupGrade(link.getSetupGrade())
                .result(link.getResult())
                .realizedR(link.getRealizedR())
                .netPnl(link.getNetPnl())
                .riskPercent(link.getRiskPercent())
                .ruleBreakCount(link.getRuleBreakCount())
                .screenshotCount(link.getScreenshotCount())
                .notes(link.getNotesSnapshot())
                .lastSyncedAt(link.getLastSyncedAt())
                .createdAt(link.getCreatedAt())
                .updatedAt(link.getUpdatedAt())
                .build();
    }

    private boolean hasValidOutcome(Trade trade) {
        return trade.getClosedAt() != null
                && trade.getRMultiple() != null
                && (trade.getDirection() == Direction.LONG || trade.getDirection() == Direction.SHORT);
    }

    private void applySnapshot(BacktestEvidenceLink link, Trade trade) {
        link.setTradeDate(trade.getClosedAt() != null ? trade.getClosedAt().toLocalDate()
                : trade.getOpenedAt() != null ? trade.getOpenedAt().toLocalDate() : null);
        link.setOpenedAt(trade.getOpenedAt());
        link.setClosedAt(trade.getClosedAt());
        link.setInstrument(trade.getSymbol());
        link.setDirection(trade.getDirection() == null ? null : trade.getDirection().name());
        link.setSession(trade.getSession() == null ? null : trade.getSession().name());
        link.setTimeframe(trade.getTimeframe());
        link.setStrategyId(trade.getStrategyId());
        link.setStrategyNameSnapshot(resolveStrategyName(trade));
        link.setSetupName(StringUtils.hasText(trade.getSetup()) ? trade.getSetup() : trade.getStrategyTag());
        link.setSetupGrade(trade.getSetupGrade() == null ? null : trade.getSetupGrade().name());
        link.setResult(trade.getRMultiple() == null ? null : result(trade.getRMultiple()).name());
        link.setRealizedR(trade.getRMultiple());
        link.setNetPnl(trade.getPnlNet());
        link.setRiskPercent(trade.getRiskPercent());
        link.setRuleBreakCount(trade.getRuleBreaks() == null ? 0 : trade.getRuleBreaks().size());
        link.setScreenshotCount(trade.getEntryScreenshotAssetIds() == null ? 0 : trade.getEntryScreenshotAssetIds().size());
        link.setNotesSnapshot(trade.getNotes());
        link.setLastSyncedAt(OffsetDateTime.now());
    }

    private String resolveStrategyName(Trade trade) {
        if (trade.getStrategyId() != null) {
            return strategyRepository.findByIdAndUser_Id(trade.getStrategyId(), trade.getUser().getId())
                    .map(strategy -> strategy.getName())
                    .orElse(trade.getStrategyTag());
        }
        return trade.getStrategyTag();
    }

    private BacktestingTradeResult result(BigDecimal rMultiple) {
        if (rMultiple.compareTo(BigDecimal.ZERO) > 0) return BacktestingTradeResult.WIN;
        if (rMultiple.compareTo(BigDecimal.ZERO) < 0) return BacktestingTradeResult.LOSS;
        return BacktestingTradeResult.BREAKEVEN;
    }

    private String workspaceLinkStatus(BacktestEvidenceLink link) {
        if (link.getWorkspace() != null) {
            return link.getSyncStatus() == BacktestingSyncStatus.NEEDS_REVIEW ? "NEEDS_REVIEW" : "LINKED";
        }
        return switch (link.getSyncStatus()) {
            case NEEDS_REVIEW -> "AMBIGUOUS";
            case ERROR -> "ERROR";
            default -> "NOT_LINKED";
        };
    }

    private String workspaceName(BacktestingWorkspace workspace) {
        if (StringUtils.hasText(workspace.getTitle())) return workspace.getTitle();
        String strategy = workspace.getStrategy() == null ? workspace.getStrategyNameSnapshot() : workspace.getStrategy().getName();
        return workspace.getSymbol() + (StringUtils.hasText(strategy) ? " · " + strategy : "");
    }

    private String weekday(LocalDate date) {
        DayOfWeek day = date.getDayOfWeek();
        return day.name().substring(0, 1) + day.name().substring(1).toLowerCase(Locale.ROOT);
    }

    private String writeMap(Map<String, Object> value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Map.of() : new LinkedHashMap<>(value));
        } catch (Exception ex) {
            throw new IllegalArgumentException("Could not serialize research classification");
        }
    }

    private Map<String, Object> readMap(String json) {
        if (!StringUtils.hasText(json)) return Map.of();
        try {
            return objectMapper.readValue(json, MAP);
        } catch (Exception ex) {
            return Map.of();
        }
    }
}
