package com.tradevault.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.BacktestingEdgeLens;
import com.tradevault.domain.entity.BacktestingScreenshot;
import com.tradevault.domain.entity.BacktestingTrade;
import com.tradevault.domain.entity.BacktestingWorkspace;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.BacktestingTradeDirection;
import com.tradevault.domain.enums.BacktestingTradeResult;
import com.tradevault.domain.enums.BacktestingTradeScope;
import com.tradevault.domain.enums.BacktestingTradeSource;
import com.tradevault.domain.enums.BacktestingGapFillStatus;
import com.tradevault.domain.enums.BacktestingGapLiquidityRelation;
import com.tradevault.domain.enums.BacktestingGapType;
import com.tradevault.dto.backtesting.BacktestingAnalyticsResponse;
import com.tradevault.dto.backtesting.BacktestingBreakdownRowResponse;
import com.tradevault.dto.backtesting.BacktestingEdgeLensRequest;
import com.tradevault.dto.backtesting.BacktestingEdgeLensResponse;
import com.tradevault.dto.backtesting.BacktestingImportResponse;
import com.tradevault.dto.backtesting.BacktestingMetricResponse;
import com.tradevault.dto.backtesting.BacktestingTradeRequest;
import com.tradevault.dto.backtesting.BacktestingTradeResponse;
import com.tradevault.repository.BacktestingEdgeLensRepository;
import com.tradevault.repository.BacktestingScreenshotRepository;
import com.tradevault.repository.BacktestingTradeRepository;
import com.tradevault.repository.BacktestingWorkspaceRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoField;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BacktestingResearchService {
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {};
    private static final DateTimeFormatter FLEX_TIME = new DateTimeFormatterBuilder()
            .appendValue(ChronoField.HOUR_OF_DAY, 1, 2, java.time.format.SignStyle.NOT_NEGATIVE)
            .appendLiteral(':')
            .appendValue(ChronoField.MINUTE_OF_HOUR, 2)
            .optionalStart()
            .appendLiteral(':')
            .appendValue(ChronoField.SECOND_OF_MINUTE, 2)
            .optionalEnd()
            .toFormatter();

    private final BacktestingWorkspaceRepository workspaceRepository;
    private final BacktestingTradeRepository tradeRepository;
    private final BacktestingScreenshotRepository screenshotRepository;
    private final BacktestingEdgeLensRepository edgeLensRepository;
    private final CurrentUserService currentUserService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<BacktestingTradeResponse> listTrades(UUID workspaceId) {
        User user = currentUserService.getCurrentUser();
        requireOwnedWorkspace(workspaceId, user);
        return toTradeResponses(tradeRepository.findByWorkspace_IdAndUser_IdOrderByDateAscEntryTimeAscCreatedAtAsc(workspaceId, user.getId()));
    }

    @Transactional
    public BacktestingTradeResponse createTrade(UUID workspaceId, BacktestingTradeRequest request) {
        User user = currentUserService.getCurrentUser();
        BacktestingWorkspace workspace = requireOwnedWorkspace(workspaceId, user);
        BacktestingTrade trade = BacktestingTrade.builder().workspace(workspace).user(user).build();
        applyTradeRequest(trade, request, BacktestingTradeSource.MANUAL);
        workspace.setUpdatedAt(OffsetDateTime.now());
        return toTradeResponse(tradeRepository.save(trade), 0);
    }

    @Transactional
    public BacktestingTradeResponse updateTrade(UUID tradeId, BacktestingTradeRequest request) {
        User user = currentUserService.getCurrentUser();
        BacktestingTrade trade = tradeRepository.findById(tradeId)
                .filter(item -> item.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new EntityNotFoundException("Backtesting trade not found"));
        applyTradeRequest(trade, request, trade.getSource());
        trade.getWorkspace().setUpdatedAt(OffsetDateTime.now());
        return toTradeResponse(tradeRepository.save(trade), screenshotCount(trade.getId()));
    }

    @Transactional
    public void deleteTrade(UUID tradeId) {
        User user = currentUserService.getCurrentUser();
        BacktestingTrade trade = tradeRepository.findById(tradeId)
                .filter(item -> item.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new EntityNotFoundException("Backtesting trade not found"));
        screenshotRepository.findByWorkspace_IdAndUser_IdOrderBySortOrderAscCreatedAtAsc(trade.getWorkspace().getId(), user.getId()).stream()
                .filter(shot -> shot.getBacktestingTrade() != null && tradeId.equals(shot.getBacktestingTrade().getId()))
                .forEach(shot -> shot.setBacktestingTrade(null));
        trade.getWorkspace().setUpdatedAt(OffsetDateTime.now());
        tradeRepository.delete(trade);
    }

    @Transactional
    public BacktestingImportResponse importCsv(UUID workspaceId, MultipartFile file) {
        User user = currentUserService.getCurrentUser();
        BacktestingWorkspace workspace = requireOwnedWorkspace(workspaceId, user);
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("CSV file is required");
        }
        List<String> errors = new ArrayList<>();
        List<BacktestingTrade> imported = new ArrayList<>();
        try (var reader = new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8)) {
            Iterable<CSVRecord> records = CSVFormat.DEFAULT.builder()
                    .setHeader()
                    .setSkipHeaderRecord(true)
                    .setIgnoreSurroundingSpaces(true)
                    .setTrim(true)
                    .build()
                    .parse(reader);
            int rowNumber = 1;
            for (CSVRecord record : records) {
                rowNumber++;
                try {
                    BacktestingTradeRequest request = requestFromCsv(record.toMap());
                    BacktestingTrade trade = BacktestingTrade.builder().workspace(workspace).user(user).build();
                    applyTradeRequest(trade, request, BacktestingTradeSource.IMPORT);
                    imported.add(tradeRepository.save(trade));
                } catch (RuntimeException ex) {
                    errors.add("Row " + rowNumber + ": " + ex.getMessage());
                }
            }
        } catch (Exception ex) {
            throw new IllegalArgumentException("Could not import CSV: " + ex.getMessage());
        }
        workspace.setUpdatedAt(OffsetDateTime.now());
        return BacktestingImportResponse.builder()
                .imported(imported.size())
                .invalid(errors.size())
                .errors(errors)
                .trades(toTradeResponses(imported))
                .build();
    }

    @Transactional(readOnly = true)
    public BacktestingAnalyticsResponse analytics(UUID workspaceId) {
        User user = currentUserService.getCurrentUser();
        requireOwnedWorkspace(workspaceId, user);
        List<BacktestingTrade> trades = tradeRepository.findByWorkspace_IdAndUser_IdOrderByDateAscEntryTimeAscCreatedAtAsc(workspaceId, user.getId());
        BacktestingMetricResponse baseline = calculateMetrics(trades);
        Map<String, List<BacktestingBreakdownRowResponse>> breakdowns = new LinkedHashMap<>();
        breakdowns.put("hour", breakdown("hour", trades, baseline, trade -> "%02d:00".formatted(trade.getEntryTime().getHour()), label -> Map.of("hour", label)));
        breakdowns.put("halfHour", breakdown("halfHour", trades, baseline, this::halfHourBucket, label -> Map.of("halfHour", label)));
        breakdowns.put("weekday", breakdown("weekday", trades, baseline, BacktestingTrade::getWeekday, label -> Map.of("weekday", label)));
        breakdowns.put("instrument", breakdown("instrument", trades, baseline, BacktestingTrade::getInstrument, label -> Map.of("instrument", label)));
        breakdowns.put("session", breakdown("session", trades, baseline, trade -> fallback(trade.getSession(), "Unspecified"), label -> Map.of("session", label)));
        breakdowns.put("setup", breakdown("setup", trades, baseline, trade -> fallback(trade.getSetupName(), "Unspecified"), label -> Map.of("setup", label)));
        breakdowns.put("direction", breakdown("direction", trades, baseline, trade -> trade.getDirection().name(), label -> Map.of("direction", label)));
        breakdowns.put("timeframe", breakdown("timeframe", trades, baseline, this::timeframeSet, label -> Map.of("timeframeSet", label)));
        breakdowns.put("strategy", breakdown("strategy", trades, baseline, trade -> fallback(trade.getStrategyNameSnapshot(), "Unlinked"), label -> Map.of("strategyName", label)));
        breakdowns.put("strategySource", breakdown("strategySource", trades, baseline, trade -> fallback(trade.getStrategySource(), "Unlinked"), label -> Map.of("strategySource", label)));
        breakdowns.put("gapPresent", breakdown("gapPresent", trades, baseline, trade -> trade.isGapPresent() ? "Gap/FVG" : "No gap", label -> Map.of("gapPresent", "Gap/FVG".equals(label))));
        breakdowns.put("gapType", breakdown("gapType", trades, baseline, trade -> trade.isGapPresent() && trade.getGapType() != null ? trade.getGapType().name() : "Unspecified", label -> Map.of("gapType", label)));
        breakdowns.put("gapTimeframe", breakdown("gapTimeframe", trades, baseline, trade -> trade.isGapPresent() ? fallback(trade.getGapTimeframe(), "Unspecified") : "No gap", label -> Map.of("gapTimeframe", label)));
        breakdowns.put("gapFillStatus", breakdown("gapFillStatus", trades, baseline, trade -> trade.isGapPresent() && trade.getGapFillStatus() != null ? trade.getGapFillStatus().name() : "Unspecified", label -> Map.of("gapFillStatus", label)));
        List<BacktestingBreakdownRowResponse> impacts = breakdowns.values().stream()
                .flatMap(List::stream)
                .sorted(Comparator.comparing((BacktestingBreakdownRowResponse row) -> row.getExpectancyDelta() == null ? BigDecimal.ZERO : row.getExpectancyDelta()).reversed())
                .toList();
        return BacktestingAnalyticsResponse.builder().baseline(baseline).breakdowns(breakdowns).impactRows(impacts).build();
    }

    @Transactional(readOnly = true)
    public List<BacktestingEdgeLensResponse> listEdgeLenses(UUID workspaceId) {
        User user = currentUserService.getCurrentUser();
        requireOwnedWorkspace(workspaceId, user);
        List<BacktestingTrade> trades = tradeRepository.findByWorkspace_IdAndUser_IdOrderByDateAscEntryTimeAscCreatedAtAsc(workspaceId, user.getId());
        return edgeLensRepository.findByWorkspace_IdAndUser_IdOrderByUpdatedAtDesc(workspaceId, user.getId()).stream()
                .map(lens -> toEdgeLensResponse(lens, trades))
                .toList();
    }

    @Transactional
    public BacktestingEdgeLensResponse createEdgeLens(UUID workspaceId, BacktestingEdgeLensRequest request) {
        User user = currentUserService.getCurrentUser();
        BacktestingWorkspace workspace = requireOwnedWorkspace(workspaceId, user);
        BacktestingEdgeLens lens = BacktestingEdgeLens.builder()
                .workspace(workspace)
                .user(user)
                .name(requireText(request.getName(), "name"))
                .description(normalizeText(request.getDescription()))
                .filterDefinitionJson(writeJson(request.getFilterDefinition()))
                .recalculatedAt(OffsetDateTime.now())
                .build();
        List<BacktestingTrade> trades = tradeRepository.findByWorkspace_IdAndUser_IdOrderByDateAscEntryTimeAscCreatedAtAsc(workspaceId, user.getId());
        BacktestingEdgeLens saved = edgeLensRepository.save(lens);
        recalculateLens(saved, trades);
        workspace.setUpdatedAt(OffsetDateTime.now());
        return toEdgeLensResponse(saved, trades);
    }

    @Transactional
    public BacktestingEdgeLensResponse updateEdgeLens(UUID lensId, BacktestingEdgeLensRequest request) {
        User user = currentUserService.getCurrentUser();
        BacktestingEdgeLens lens = edgeLensRepository.findByIdAndUser_Id(lensId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Edge Lens not found"));
        lens.setName(requireText(request.getName(), "name"));
        lens.setDescription(normalizeText(request.getDescription()));
        lens.setFilterDefinitionJson(writeJson(request.getFilterDefinition()));
        List<BacktestingTrade> trades = tradeRepository.findByWorkspace_IdAndUser_IdOrderByDateAscEntryTimeAscCreatedAtAsc(lens.getWorkspace().getId(), user.getId());
        recalculateLens(lens, trades);
        lens.getWorkspace().setUpdatedAt(OffsetDateTime.now());
        return toEdgeLensResponse(edgeLensRepository.save(lens), trades);
    }

    @Transactional
    public BacktestingEdgeLensResponse recalculateEdgeLens(UUID lensId) {
        User user = currentUserService.getCurrentUser();
        BacktestingEdgeLens lens = edgeLensRepository.findByIdAndUser_Id(lensId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Edge Lens not found"));
        List<BacktestingTrade> trades = tradeRepository.findByWorkspace_IdAndUser_IdOrderByDateAscEntryTimeAscCreatedAtAsc(lens.getWorkspace().getId(), user.getId());
        recalculateLens(lens, trades);
        return toEdgeLensResponse(edgeLensRepository.save(lens), trades);
    }

    @Transactional
    public void deleteEdgeLens(UUID lensId) {
        User user = currentUserService.getCurrentUser();
        BacktestingEdgeLens lens = edgeLensRepository.findByIdAndUser_Id(lensId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Edge Lens not found"));
        edgeLensRepository.delete(lens);
    }

    public BacktestingMetricResponse calculateMetrics(List<BacktestingTrade> trades) {
        List<BacktestingTrade> rows = trades == null ? List.of() : trades;
        int total = rows.size();
        int wins = (int) rows.stream().filter(item -> item.getResult() == BacktestingTradeResult.WIN).count();
        int losses = (int) rows.stream().filter(item -> item.getResult() == BacktestingTradeResult.LOSS).count();
        int breakevens = (int) rows.stream().filter(item -> item.getResult() == BacktestingTradeResult.BREAKEVEN).count();
        BigDecimal totalR = rows.stream().map(BacktestingTrade::getPnlR).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal grossWin = rows.stream().map(BacktestingTrade::getPnlR).filter(Objects::nonNull).filter(value -> value.compareTo(BigDecimal.ZERO) > 0).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal grossLoss = rows.stream().map(BacktestingTrade::getPnlR).filter(Objects::nonNull).filter(value -> value.compareTo(BigDecimal.ZERO) < 0).reduce(BigDecimal.ZERO, BigDecimal::add).abs();
        BigDecimal avgWin = average(rows.stream().map(BacktestingTrade::getPnlR).filter(value -> value != null && value.compareTo(BigDecimal.ZERO) > 0).toList());
        BigDecimal avgLoss = average(rows.stream().map(BacktestingTrade::getPnlR).filter(value -> value != null && value.compareTo(BigDecimal.ZERO) < 0).toList());
        return BacktestingMetricResponse.builder()
                .trades(total)
                .wins(wins)
                .losses(losses)
                .breakevens(breakevens)
                .winRate(rate(wins, total))
                .lossRate(rate(losses, total))
                .breakevenRate(rate(breakevens, total))
                .totalR(scale(totalR))
                .averageR(total == 0 ? BigDecimal.ZERO : scale(totalR.divide(BigDecimal.valueOf(total), 4, RoundingMode.HALF_UP)))
                .expectancy(total == 0 ? BigDecimal.ZERO : scale(totalR.divide(BigDecimal.valueOf(total), 4, RoundingMode.HALF_UP)))
                .profitFactor(grossLoss.compareTo(BigDecimal.ZERO) == 0 ? (grossWin.compareTo(BigDecimal.ZERO) > 0 ? null : BigDecimal.ZERO) : scale(grossWin.divide(grossLoss, 4, RoundingMode.HALF_UP)))
                .averageWinR(avgWin)
                .averageLossR(avgLoss)
                .largestWinR(rows.stream().map(BacktestingTrade::getPnlR).filter(Objects::nonNull).max(Comparator.naturalOrder()).map(this::scale).orElse(BigDecimal.ZERO))
                .largestLossR(rows.stream().map(BacktestingTrade::getPnlR).filter(Objects::nonNull).min(Comparator.naturalOrder()).map(this::scale).orElse(BigDecimal.ZERO))
                .sampleQuality(sampleQuality(total))
                .build();
    }

    public String sampleQuality(int trades) {
        if (trades < 10) return "Exploratory only";
        if (trades < 30) return "Early signal";
        if (trades < 60) return "Developing evidence";
        return "More reliable pattern";
    }

    private List<BacktestingBreakdownRowResponse> breakdown(String dimension,
                                                            List<BacktestingTrade> trades,
                                                            BacktestingMetricResponse baseline,
                                                            Function<BacktestingTrade, String> classifier,
                                                            Function<String, Map<String, Object>> filters) {
        return trades.stream()
                .collect(Collectors.groupingBy(classifier, LinkedHashMap::new, Collectors.toList()))
                .entrySet()
                .stream()
                .filter(entry -> StringUtils.hasText(entry.getKey()))
                .map(entry -> {
                    BacktestingMetricResponse metrics = calculateMetrics(entry.getValue());
                    BigDecimal expectancyDelta = scale(metrics.getExpectancy().subtract(baseline.getExpectancy()));
                    BigDecimal totalRDelta = scale(metrics.getTotalR().subtract(baseline.getTotalR()));
                    return BacktestingBreakdownRowResponse.builder()
                            .dimension(dimension)
                            .label(entry.getKey())
                            .filters(filters.apply(entry.getKey()))
                            .metrics(metrics)
                            .expectancyDelta(expectancyDelta)
                            .totalRDelta(totalRDelta)
                            .verdict(verdict(metrics.getTrades(), expectancyDelta))
                            .warning(metrics.getTrades() < 10 && expectancyDelta.compareTo(BigDecimal.ZERO) > 0
                                    ? "Caution: this filter improves expectancy but only " + metrics.getTrades() + " trades remain. Gather more evidence before changing your trading plan."
                                    : null)
                            .build();
                })
                .sorted(Comparator.comparing((BacktestingBreakdownRowResponse row) -> row.getMetrics().getExpectancy()).reversed())
                .toList();
    }

    private void applyTradeRequest(BacktestingTrade trade, BacktestingTradeRequest request, BacktestingTradeSource fallbackSource) {
        if (request.getGapEntryPositionPercent() != null && (request.getGapEntryPositionPercent().compareTo(BigDecimal.ZERO) < 0 || request.getGapEntryPositionPercent().compareTo(BigDecimal.valueOf(100)) > 0)) {
            throw new IllegalArgumentException("gapEntryPositionPercent must be between 0 and 100");
        }
        if (request.getGapSizePercent() != null && request.getGapSizePercent().compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("gapSizePercent must be positive");
        }
        if (request.getGapHigh() != null && request.getGapLow() != null && request.getGapHigh().compareTo(request.getGapLow()) < 0) {
            throw new IllegalArgumentException("gapHigh must be greater than or equal to gapLow");
        }
        trade.setDate(Objects.requireNonNull(request.getDate(), "date is required"));
        trade.setEntryTime(Objects.requireNonNull(request.getEntryTime(), "entryTime is required"));
        trade.setInstrument(requireText(request.getInstrument(), "instrument").toUpperCase(Locale.ROOT));
        trade.setDirection(Objects.requireNonNull(request.getDirection(), "direction is required"));
        trade.setSession(normalizeText(request.getSession()));
        trade.setSetupName(normalizeText(request.getSetupName()));
        trade.setStrategyId(request.getStrategyId());
        trade.setStrategySource(normalizeStrategySource(request.getStrategySource()));
        trade.setStrategyNameSnapshot(normalizeText(request.getStrategyNameSnapshot()));
        trade.setGapPresent(request.isGapPresent());
        trade.setGapType(request.isGapPresent() ? request.getGapType() : null);
        trade.setGapTimeframe(request.isGapPresent() ? normalizeText(request.getGapTimeframe()) : null);
        trade.setGapCreatedAt(request.isGapPresent() ? request.getGapCreatedAt() : null);
        trade.setGapMitigatedAt(request.isGapPresent() ? request.getGapMitigatedAt() : null);
        trade.setGapHigh(request.isGapPresent() ? request.getGapHigh() : null);
        trade.setGapLow(request.isGapPresent() ? request.getGapLow() : null);
        trade.setGapMidpoint(request.isGapPresent() ? request.getGapMidpoint() : null);
        trade.setGapSizePoints(request.isGapPresent() ? request.getGapSizePoints() : null);
        trade.setGapSizePercent(request.isGapPresent() ? request.getGapSizePercent() : null);
        trade.setGapEntryPositionPercent(request.isGapPresent() ? request.getGapEntryPositionPercent() : null);
        trade.setGapFillStatus(request.isGapPresent() ? request.getGapFillStatus() : null);
        trade.setGapRelationToLiquidity(request.isGapPresent() ? request.getGapRelationToLiquidity() : null);
        trade.setGapConfluenceNotes(request.isGapPresent() ? normalizeText(request.getGapConfluenceNotes()) : null);
        trade.setRiskPercent(request.getRiskPercent());
        trade.setPlannedRR(request.getPlannedRR());
        trade.setResult(Objects.requireNonNull(request.getResult(), "result is required"));
        trade.setPnlR(Objects.requireNonNull(request.getPnlR(), "pnlR is required"));
        trade.setContextTimeframe(normalizeText(request.getContextTimeframe()));
        trade.setExecutionTimeframe(normalizeText(request.getExecutionTimeframe()));
        trade.setEntryTimeframe(normalizeText(request.getEntryTimeframe()));
        trade.setTagsJson(writeList(normalizeList(request.getTags())));
        trade.setNotes(normalizeText(request.getNotes()));
        trade.setSource(request.getSource() == null ? fallbackSource : request.getSource());
        trade.setTradeScope(request.getTradeScope() == null ? BacktestingTradeScope.BACKTEST : request.getTradeScope());
    }

    private BacktestingTradeRequest requestFromCsv(Map<String, String> values) {
        BacktestingTradeRequest request = new BacktestingTradeRequest();
        request.setDate(parseDate(value(values, "date", "trade date")));
        request.setEntryTime(parseTime(value(values, "time", "entry time", "entrytime")));
        request.setInstrument(value(values, "instrument", "symbol", "market"));
        request.setDirection(parseDirection(value(values, "direction", "side")));
        request.setSession(value(values, "session"));
        request.setSetupName(value(values, "setup", "setup name", "setup code"));
        request.setStrategyId(parseUuid(value(values, "strategy id", "strategyid")));
        request.setStrategySource(value(values, "strategy source", "strategysource"));
        request.setStrategyNameSnapshot(value(values, "strategy", "strategy name", "strategynamesnapshot"));
        request.setGapPresent(parseBoolean(value(values, "gap present", "gappresent", "fvg present", "fvg used")));
        request.setGapType(parseEnum(value(values, "gap type", "gaptype", "fvg type"), BacktestingGapType.class));
        request.setGapTimeframe(value(values, "gap timeframe", "gaptimeframe", "fvg timeframe"));
        request.setGapCreatedAt(parseOptionalTime(value(values, "gap created at", "gapcreatedat", "gap created time")));
        request.setGapMitigatedAt(parseOptionalTime(value(values, "gap mitigated at", "gapmitigatedat", "gap mitigated time")));
        request.setGapHigh(parseDecimal(value(values, "gap high", "gaphigh")));
        request.setGapLow(parseDecimal(value(values, "gap low", "gaplow")));
        request.setGapMidpoint(parseDecimal(value(values, "gap midpoint", "gapmidpoint", "gap ce")));
        request.setGapSizePoints(parseDecimal(value(values, "gap size points", "gapsizepoints", "gap size pips")));
        request.setGapSizePercent(parseDecimal(value(values, "gap size percent", "gapsizepercent", "gap size %")));
        request.setGapEntryPositionPercent(parseDecimal(value(values, "gap entry position percent", "gapentrypositionpercent", "entry in gap %")));
        request.setGapFillStatus(parseEnum(value(values, "gap fill status", "gapfillstatus"), BacktestingGapFillStatus.class));
        request.setGapRelationToLiquidity(parseEnum(value(values, "gap relation to liquidity", "gaprelationtoliquidity"), BacktestingGapLiquidityRelation.class));
        request.setGapConfluenceNotes(value(values, "gap confluence notes", "gapconfluencenotes"));
        request.setRiskPercent(parseDecimal(value(values, "risk", "risk %", "risk percent")));
        request.setPlannedRR(parseDecimal(value(values, "rr", "r:r", "planned rr", "planned r:r")));
        request.setResult(parseResult(value(values, "result", "outcome")));
        request.setPnlR(parseDecimal(value(values, "pnlr", "p&l(r)", "p&l r", "pnl r", "pnl", "r multiple")));
        request.setContextTimeframe(value(values, "context tf", "context timeframe"));
        request.setExecutionTimeframe(value(values, "execution tf", "execution timeframe"));
        request.setEntryTimeframe(value(values, "entry tf", "entry timeframe"));
        request.setTags(splitTags(value(values, "tags", "tag")));
        request.setNotes(value(values, "notes", "note"));
        request.setSource(BacktestingTradeSource.IMPORT);
        request.setTradeScope(BacktestingTradeScope.BACKTEST);
        return request;
    }

    private BacktestingTradeResponse toTradeResponse(BacktestingTrade trade, int screenshotCount) {
        return BacktestingTradeResponse.builder()
                .id(trade.getId())
                .workspaceId(trade.getWorkspace().getId())
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
                .gapPresent(trade.isGapPresent())
                .gapType(trade.getGapType())
                .gapTimeframe(trade.getGapTimeframe())
                .gapCreatedAt(trade.getGapCreatedAt())
                .gapMitigatedAt(trade.getGapMitigatedAt())
                .gapHigh(trade.getGapHigh())
                .gapLow(trade.getGapLow())
                .gapMidpoint(trade.getGapMidpoint())
                .gapSizePoints(trade.getGapSizePoints())
                .gapSizePercent(trade.getGapSizePercent())
                .gapEntryPositionPercent(trade.getGapEntryPositionPercent())
                .gapFillStatus(trade.getGapFillStatus())
                .gapRelationToLiquidity(trade.getGapRelationToLiquidity())
                .gapConfluenceNotes(trade.getGapConfluenceNotes())
                .riskPercent(trade.getRiskPercent())
                .plannedRR(trade.getPlannedRR())
                .result(trade.getResult())
                .pnlR(trade.getPnlR())
                .contextTimeframe(trade.getContextTimeframe())
                .executionTimeframe(trade.getExecutionTimeframe())
                .entryTimeframe(trade.getEntryTimeframe())
                .tags(readList(trade.getTagsJson()))
                .notes(trade.getNotes())
                .source(trade.getSource())
                .tradeScope(trade.getTradeScope())
                .screenshotCount(screenshotCount)
                .createdAt(trade.getCreatedAt())
                .updatedAt(trade.getUpdatedAt())
                .build();
    }

    private List<BacktestingTradeResponse> toTradeResponses(List<BacktestingTrade> trades) {
        Map<UUID, Long> screenshotCounts = trades.isEmpty() ? Map.of() : screenshotRepository.findByWorkspace_IdAndUser_IdOrderBySortOrderAscCreatedAtAsc(trades.get(0).getWorkspace().getId(), trades.get(0).getUser().getId())
                .stream()
                .filter(shot -> shot.getBacktestingTrade() != null)
                .collect(Collectors.groupingBy(shot -> shot.getBacktestingTrade().getId(), Collectors.counting()));
        return trades.stream().map(trade -> toTradeResponse(trade, screenshotCounts.getOrDefault(trade.getId(), 0L).intValue())).toList();
    }

    private BacktestingEdgeLensResponse toEdgeLensResponse(BacktestingEdgeLens lens, List<BacktestingTrade> trades) {
        Map<String, Object> filters = readMap(lens.getFilterDefinitionJson());
        BacktestingMetricResponse metrics = trades != null
                ? calculateMetrics(applyFilters(trades, filters))
                : readMetric(lens.getMetricsSnapshotJson());
        return BacktestingEdgeLensResponse.builder()
                .id(lens.getId())
                .workspaceId(lens.getWorkspace().getId())
                .name(lens.getName())
                .description(lens.getDescription())
                .filterDefinition(filters)
                .metrics(metrics)
                .recalculatedAt(lens.getRecalculatedAt())
                .createdAt(lens.getCreatedAt())
                .updatedAt(lens.getUpdatedAt())
                .build();
    }

    private void recalculateLens(BacktestingEdgeLens lens, List<BacktestingTrade> trades) {
        BacktestingMetricResponse metrics = calculateMetrics(applyFilters(trades, readMap(lens.getFilterDefinitionJson())));
        lens.setMetricsSnapshotJson(writeJson(metrics));
        lens.setRecalculatedAt(OffsetDateTime.now());
    }

    private List<BacktestingTrade> applyFilters(List<BacktestingTrade> trades, Map<String, Object> filters) {
        if (filters == null || filters.isEmpty()) return trades == null ? List.of() : trades;
        return (trades == null ? List.<BacktestingTrade>of() : trades).stream().filter(trade -> matches(trade, filters)).toList();
    }

    private boolean matches(BacktestingTrade trade, Map<String, Object> filters) {
        for (Map.Entry<String, Object> entry : filters.entrySet()) {
            String key = entry.getKey();
            String value = Objects.toString(entry.getValue(), "");
            if (!StringUtils.hasText(value)) continue;
            boolean matched = switch (key) {
                case "instrument" -> value.equalsIgnoreCase(trade.getInstrument());
                case "direction" -> value.equalsIgnoreCase(trade.getDirection().name());
                case "session" -> value.equalsIgnoreCase(fallback(trade.getSession(), "Unspecified"));
                case "setup" -> value.equalsIgnoreCase(fallback(trade.getSetupName(), "Unspecified"));
                case "result" -> value.equalsIgnoreCase(trade.getResult().name());
                case "weekday" -> value.equalsIgnoreCase(trade.getWeekday());
                case "hour" -> value.equals("%02d:00".formatted(trade.getEntryTime().getHour()));
                case "halfHour" -> value.equals(halfHourBucket(trade));
                case "timeframeSet" -> value.equals(timeframeSet(trade));
                case "contextTimeframe" -> value.equalsIgnoreCase(fallback(trade.getContextTimeframe(), ""));
                case "executionTimeframe" -> value.equalsIgnoreCase(fallback(trade.getExecutionTimeframe(), ""));
                case "entryTimeframe" -> value.equalsIgnoreCase(fallback(trade.getEntryTimeframe(), ""));
                case "strategyName" -> value.equalsIgnoreCase(fallback(trade.getStrategyNameSnapshot(), "Unlinked"));
                case "strategySource" -> value.equalsIgnoreCase(fallback(trade.getStrategySource(), "Unlinked"));
                case "gapPresent" -> parseBoolean(value) == trade.isGapPresent();
                case "gapType" -> value.equalsIgnoreCase(trade.getGapType() == null ? "Unspecified" : trade.getGapType().name());
                case "gapTimeframe" -> value.equalsIgnoreCase(fallback(trade.getGapTimeframe(), "No gap"));
                case "gapFillStatus" -> value.equalsIgnoreCase(trade.getGapFillStatus() == null ? "Unspecified" : trade.getGapFillStatus().name());
                default -> true;
            };
            if (!matched) return false;
        }
        return true;
    }

    private BacktestingWorkspace requireOwnedWorkspace(UUID id, User user) {
        return workspaceRepository.findByIdAndUser_Id(id, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Backtesting workspace not found"));
    }

    private int screenshotCount(UUID tradeId) {
        return (int) screenshotRepository.countByBacktestingTrade_Id(tradeId);
    }

    private String verdict(int trades, BigDecimal expectancyDelta) {
        if (trades < 10) return "Exploratory only";
        if (expectancyDelta.abs().compareTo(BigDecimal.valueOf(0.05)) < 0) return "Neutral";
        if (expectancyDelta.compareTo(BigDecimal.ZERO) > 0 && trades >= 30) return "Strong improvement";
        if (expectancyDelta.compareTo(BigDecimal.ZERO) > 0) return "Positive but early";
        return "Weak / avoid";
    }

    private BigDecimal rate(int part, int total) {
        if (total == 0) return BigDecimal.ZERO;
        return scale(BigDecimal.valueOf(part).multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(total), 4, RoundingMode.HALF_UP));
    }

    private BigDecimal average(List<BigDecimal> values) {
        if (values == null || values.isEmpty()) return BigDecimal.ZERO;
        return scale(values.stream().reduce(BigDecimal.ZERO, BigDecimal::add).divide(BigDecimal.valueOf(values.size()), 4, RoundingMode.HALF_UP));
    }

    private BigDecimal scale(BigDecimal value) {
        return value == null ? null : value.setScale(2, RoundingMode.HALF_UP).stripTrailingZeros();
    }

    private String halfHourBucket(BacktestingTrade trade) {
        int minute = trade.getEntryTime().getMinute() < 30 ? 0 : 30;
        int endMinute = minute == 0 ? 30 : 0;
        int endHour = minute == 0 ? trade.getEntryTime().getHour() : (trade.getEntryTime().getHour() + 1) % 24;
        return "%02d:%02d-%02d:%02d".formatted(trade.getEntryTime().getHour(), minute, endHour, endMinute);
    }

    private String timeframeSet(BacktestingTrade trade) {
        return List.of(fallback(trade.getContextTimeframe(), "-"), fallback(trade.getExecutionTimeframe(), "-"), fallback(trade.getEntryTimeframe(), "-"))
                .stream().collect(Collectors.joining(" / "));
    }

    private String fallback(String value, String fallback) {
        return StringUtils.hasText(value) ? value : fallback;
    }

    private String requireText(String value, String field) {
        String normalized = normalizeText(value);
        if (!StringUtils.hasText(normalized)) throw new IllegalArgumentException(field + " is required");
        return normalized;
    }

    private String normalizeText(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private List<String> normalizeList(List<String> values) {
        if (values == null) return List.of();
        return values.stream().map(this::normalizeText).filter(StringUtils::hasText).distinct().toList();
    }

    private String writeList(List<String> values) {
        return writeJson(values == null ? List.of() : values);
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Could not serialize research data");
        }
    }

    private List<String> readList(String json) {
        if (!StringUtils.hasText(json)) return List.of();
        try {
            return objectMapper.readValue(json, STRING_LIST);
        } catch (Exception ex) {
            return List.of();
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

    private BacktestingMetricResponse readMetric(String json) {
        try {
            return objectMapper.readValue(json, BacktestingMetricResponse.class);
        } catch (Exception ex) {
            return calculateMetrics(List.of());
        }
    }

    private String value(Map<String, String> values, String... names) {
        Map<String, String> normalized = values.entrySet().stream()
                .collect(Collectors.toMap(entry -> normalizeHeader(entry.getKey()), Map.Entry::getValue, (a, b) -> a));
        for (String name : names) {
            String value = normalized.get(normalizeHeader(name));
            if (StringUtils.hasText(value)) return value.trim();
        }
        return null;
    }

    private String normalizeHeader(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private LocalDate parseDate(String value) {
        if (!StringUtils.hasText(value)) throw new IllegalArgumentException("date is required");
        for (DateTimeFormatter formatter : List.of(DateTimeFormatter.ISO_LOCAL_DATE, DateTimeFormatter.ofPattern("M/d/yyyy"), DateTimeFormatter.ofPattern("d/M/yyyy"))) {
            try {
                return LocalDate.parse(value.trim(), formatter);
            } catch (DateTimeParseException ignored) {
            }
        }
        throw new IllegalArgumentException("invalid date");
    }

    private LocalTime parseTime(String value) {
        if (!StringUtils.hasText(value)) throw new IllegalArgumentException("time is required");
        try {
            return LocalTime.parse(value.trim(), FLEX_TIME);
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("invalid time");
        }
    }

    private BigDecimal parseDecimal(String value) {
        if (!StringUtils.hasText(value)) return null;
        return new BigDecimal(value.trim().replace("%", ""));
    }

    private UUID parseUuid(String value) {
        if (!StringUtils.hasText(value)) return null;
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("invalid strategy id");
        }
    }

    private boolean parseBoolean(String value) {
        if (!StringUtils.hasText(value)) return false;
        return List.of("true", "yes", "y", "1", "da").contains(value.trim().toLowerCase(Locale.ROOT));
    }

    private LocalTime parseOptionalTime(String value) {
        return StringUtils.hasText(value) ? parseTime(value) : null;
    }

    private <E extends Enum<E>> E parseEnum(String value, Class<E> type) {
        if (!StringUtils.hasText(value)) return null;
        try {
            return Enum.valueOf(type, value.trim().toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_'));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("invalid " + type.getSimpleName());
        }
    }

    private String normalizeStrategySource(String value) {
        String normalized = normalizeText(value);
        if (normalized == null) return null;
        normalized = normalized.toUpperCase(Locale.ROOT);
        if (!List.of("MY", "MENTOR").contains(normalized)) throw new IllegalArgumentException("strategySource must be MY or MENTOR");
        return normalized;
    }

    private BacktestingTradeDirection parseDirection(String value) {
        if (!StringUtils.hasText(value)) throw new IllegalArgumentException("direction is required");
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (List.of("long", "buy", "b").contains(normalized)) return BacktestingTradeDirection.LONG;
        if (List.of("short", "sell", "s").contains(normalized)) return BacktestingTradeDirection.SHORT;
        throw new IllegalArgumentException("invalid direction");
    }

    private BacktestingTradeResult parseResult(String value) {
        if (!StringUtils.hasText(value)) throw new IllegalArgumentException("result is required");
        String normalized = value.trim().toLowerCase(Locale.ROOT).replace("-", "").replace(" ", "");
        if (List.of("win", "winner", "w").contains(normalized)) return BacktestingTradeResult.WIN;
        if (List.of("loss", "loser", "l").contains(normalized)) return BacktestingTradeResult.LOSS;
        if (List.of("be", "breakeven", "break even").contains(normalized)) return BacktestingTradeResult.BREAKEVEN;
        throw new IllegalArgumentException("invalid result");
    }

    private List<String> splitTags(String value) {
        if (!StringUtils.hasText(value)) return List.of();
        return List.of(value.split("[,;|]")).stream().map(String::trim).filter(StringUtils::hasText).distinct().toList();
    }
}
