package com.tradevault.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.BacktestingEdgeLens;
import com.tradevault.domain.entity.BacktestingScreenshot;
import com.tradevault.domain.entity.BacktestingTrade;
import com.tradevault.domain.entity.BacktestingWorkspace;
import com.tradevault.domain.entity.BacktestEvidenceLink;
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
import com.tradevault.service.backtesting.LiveTradeEvidenceSyncService;
import com.tradevault.service.backtesting.ReplayCsvParser;
import com.tradevault.dto.backtesting.BacktestingCurrencyMetricResponse;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStreamReader;
import java.io.PushbackReader;
import java.time.LocalDateTime;
import java.time.Duration;
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
    private final LiveTradeEvidenceSyncService evidenceSyncService;
    private final BacktestingEvidenceAssessmentService evidenceAssessmentService;

    @Transactional(readOnly = true)
    public List<BacktestingTradeResponse> listTrades(UUID workspaceId) {
        User user = currentUserService.getCurrentUser();
        requireOwnedWorkspace(workspaceId, user);
        List<BacktestingTradeResponse> responses = new ArrayList<>(toTradeResponses(
                tradeRepository.findByWorkspace_IdAndUser_IdOrderByDateAscEntryTimeAscCreatedAtAsc(workspaceId, user.getId())));
        evidenceSyncService.includedLinks(workspaceId, user.getId()).stream()
                .map(evidenceSyncService::toTradeResponse)
                .forEach(responses::add);
        responses.sort(Comparator.comparing(BacktestingTradeResponse::getDate)
                .thenComparing(BacktestingTradeResponse::getEntryTime));
        return responses;
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
        return importCsv(workspaceId, file, null, null, false);
    }

    @Transactional
    public BacktestingImportResponse importCsv(UUID workspaceId, MultipartFile file, String instrument,
                                               String timezone, boolean preview) {
        User user = currentUserService.getCurrentUser();
        BacktestingWorkspace workspace = requireOwnedWorkspace(workspaceId, user);
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("CSV file is required");
        if (file.getSize() > 10 * 1024 * 1024) throw new IllegalArgumentException("CSV exceeds the 10 MB limit");
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<BacktestingTrade> candidates = new ArrayList<>();
        String format;
        int rowCount;
        int duplicates = 0;
        try (var reader = new PushbackReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8), 1)) {
            int first = reader.read();
            if (first != -1 && first != 0xfeff) reader.unread(first);
            try (var parser = CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true)
                    .setIgnoreSurroundingSpaces(true).setTrim(true).build().parse(reader)) {
                List<CSVRecord> records = new ArrayList<>();
                for (CSVRecord record : parser) {
                    if (records.size() >= 20000) throw new IllegalArgumentException("CSV exceeds the 20,000 row limit");
                    records.add(record);
                }
                rowCount = records.size();
                if (ReplayCsvParser.supports(parser.getHeaderNames())) {
                    format = ReplayCsvParser.FORMAT;
                    String symbol = StringUtils.hasText(instrument) ? instrument : ReplayCsvParser.symbolFromFilename(file.getOriginalFilename());
                    var parsed = ReplayCsvParser.parse(records, parser.getHeaderNames(), symbol, timezone, file.getOriginalFilename());
                    errors.addAll(parsed.errors());
                    candidates.addAll(parsed.trades());
                    duplicates = parsed.duplicates();
                    warnings.add("Replay results are simulated. Initial stop/risk is absent; R, risk percentage and planned R:R are unavailable.");
                    warnings.add("Export cumulative PnL can reset between replay runs. Analytics recompute totals from each closed trade once.");
                    if (!StringUtils.hasText(timezone)) warnings.add("Timezone is unspecified; timestamps and entry-hour breakdowns retain the exported local clock.");
                    if (symbol != null && !symbol.equalsIgnoreCase(workspace.getSymbol()))
                        warnings.add("Imported instrument " + symbol + " differs from workspace " + workspace.getSymbol() + ". The CSV instrument is retained.");
                } else {
                    format = "TRADEJAUDIT_CSV";
                    for (CSVRecord record : records) {
                        try {
                            if (!record.isConsistent()) throw new IllegalArgumentException("column count does not match header");
                            BacktestingTrade trade = BacktestingTrade.builder().workspace(workspace).user(user).build();
                            applyTradeRequest(trade, requestFromCsv(record.toMap()), BacktestingTradeSource.IMPORT);
                            candidates.add(trade);
                        } catch (RuntimeException ex) { errors.add("Row " + (record.getRecordNumber() + 1) + ": " + ex.getMessage()); }
                    }
                }
            }
        } catch (Exception ex) { throw new IllegalArgumentException("Could not import CSV: " + ex.getMessage(), ex); }
        Map<String, BacktestingTrade> existing = tradeRepository
                .findByWorkspace_IdAndUser_IdOrderByDateAscEntryTimeAscCreatedAtAsc(workspaceId, user.getId()).stream()
                .filter(t -> t.getImportFingerprint() != null)
                .collect(Collectors.toMap(BacktestingTrade::getImportFingerprint, Function.identity(), (a, b) -> a));
        List<BacktestingTrade> imported = new ArrayList<>();
        for (BacktestingTrade trade : candidates) {
            trade.setWorkspace(workspace);
            trade.setUser(user);
            String key = trade.getImportFingerprint();
            if (key != null && existing.containsKey(key)) {
                if (existing.get(key).getNetPnl().compareTo(trade.getNetPnl()) != 0)
                    errors.add("Trade " + trade.getImportTradeNumber() + " at " + trade.getDate() + " " + trade.getEntryTime() + ": existing execution has different net PnL; review it before reimporting");
                else duplicates++;
                continue;
            }
            if (key != null) existing.put(key, trade);
            imported.add(trade);
        }
        if (!preview && !imported.isEmpty()) {
            tradeRepository.saveAll(imported);
            workspace.setUpdatedAt(OffsetDateTime.now());
        }
        return BacktestingImportResponse.builder().format(format).rowCount(rowCount).duplicates(duplicates).preview(preview)
                .warnings(warnings).imported(imported.size()).invalid(errors.size()).errors(errors.stream().limit(100).toList())
                .trades(imported.stream().map(t -> toTradeResponse(t, 0)).toList()).build();
    }

    @Transactional(readOnly = true)
    public BacktestingAnalyticsResponse analytics(UUID workspaceId) {
        User user = currentUserService.getCurrentUser();
        requireOwnedWorkspace(workspaceId, user);
        List<BacktestingTrade> trades = researchTrades(workspaceId, user);
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
        breakdowns.put("source", breakdown("source", trades, baseline, trade -> trade.getSource().name(), label -> Map.of("source", label)));
        List<BacktestingBreakdownRowResponse> impacts = breakdowns.values().stream()
                .flatMap(List::stream)
                .sorted(Comparator.comparing((BacktestingBreakdownRowResponse row) -> row.getExpectancyDelta() == null ? BigDecimal.ZERO : row.getExpectancyDelta()).reversed())
                .toList();
        Map<String, BacktestingMetricResponse> sourceMetrics = new LinkedHashMap<>();
        for (BacktestingTradeSource source : List.of(BacktestingTradeSource.MANUAL, BacktestingTradeSource.IMPORT, BacktestingTradeSource.LIVE)) {
            sourceMetrics.put(source.name(), calculateMetrics(trades.stream().filter(trade -> trade.getSource() == source).toList()));
        }
        List<BacktestingTrade> historical = trades.stream().filter(trade -> trade.getSource() != BacktestingTradeSource.LIVE).toList();
        List<BacktestingTrade> live = trades.stream().filter(trade -> trade.getSource() == BacktestingTradeSource.LIVE).toList();
        BigDecimal liveGap = difference(calculateMetrics(live).getExpectancy(), calculateMetrics(historical).getExpectancy());
        List<BacktestingTrade> recentLive = live.stream()
                .sorted(Comparator.comparing(BacktestingTrade::getDate).thenComparing(BacktestingTrade::getEntryTime).reversed())
                .limit(evidenceAssessmentService.recentLiveWindow())
                .toList();
        String regressionStatus = regressionStatus(historical, recentLive);
        return BacktestingAnalyticsResponse.builder()
                .baseline(baseline)
                .breakdowns(breakdowns)
                .impactRows(impacts)
                .sourceMetrics(sourceMetrics)
                .liveExpectancyGap(liveGap)
                .regressionStatus(regressionStatus)
                .recentLiveSampleSize(recentLive.size())
                .build();
    }

    @Transactional(readOnly = true)
    public List<BacktestingEdgeLensResponse> listEdgeLenses(UUID workspaceId) {
        User user = currentUserService.getCurrentUser();
        requireOwnedWorkspace(workspaceId, user);
        List<BacktestingTrade> trades = researchTrades(workspaceId, user);
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
        List<BacktestingTrade> trades = researchTrades(workspaceId, user);
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
        List<BacktestingTrade> trades = researchTrades(lens.getWorkspace().getId(), user);
        recalculateLens(lens, trades);
        lens.getWorkspace().setUpdatedAt(OffsetDateTime.now());
        return toEdgeLensResponse(edgeLensRepository.save(lens), trades);
    }

    @Transactional
    public BacktestingEdgeLensResponse recalculateEdgeLens(UUID lensId) {
        User user = currentUserService.getCurrentUser();
        BacktestingEdgeLens lens = edgeLensRepository.findByIdAndUser_Id(lensId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Edge Lens not found"));
        List<BacktestingTrade> trades = researchTrades(lens.getWorkspace().getId(), user);
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
        List<BacktestingTrade> rows = trades == null ? List.of() : trades.stream().sorted(realizedOrder()).toList();
        int rCount = (int) rows.stream().filter(t -> t.getPnlR() != null).count();
        boolean completeR = rCount == rows.size();
        Map<String, BacktestingCurrencyMetricResponse> currencies = new LinkedHashMap<>();
        rows.stream().filter(t -> t.getNetPnl() != null && t.getCurrency() != null)
                .collect(Collectors.groupingBy(BacktestingTrade::getCurrency, LinkedHashMap::new, Collectors.toList()))
                .forEach((currency, items) -> currencies.put(currency, currencyMetrics(currency, items)));
        int total = rows.size();
        int wins = (int) rows.stream().filter(item -> item.getResult() == BacktestingTradeResult.WIN).count();
        int losses = (int) rows.stream().filter(item -> item.getResult() == BacktestingTradeResult.LOSS).count();
        int breakevens = (int) rows.stream().filter(item -> item.getResult() == BacktestingTradeResult.BREAKEVEN).count();
        BigDecimal totalR = rows.stream().map(BacktestingTrade::getPnlR).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal grossWin = rows.stream().map(BacktestingTrade::getPnlR).filter(Objects::nonNull).filter(value -> value.compareTo(BigDecimal.ZERO) > 0).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal grossLoss = rows.stream().map(BacktestingTrade::getPnlR).filter(Objects::nonNull).filter(value -> value.compareTo(BigDecimal.ZERO) < 0).reduce(BigDecimal.ZERO, BigDecimal::add).abs();
        BigDecimal avgWin = average(rows.stream().map(BacktestingTrade::getPnlR).filter(value -> value != null && value.compareTo(BigDecimal.ZERO) > 0).toList());
        BigDecimal avgLoss = average(rows.stream().map(BacktestingTrade::getPnlR).filter(value -> value != null && value.compareTo(BigDecimal.ZERO) < 0).toList());
        List<BigDecimal> sortedR = rows.stream().map(BacktestingTrade::getPnlR).filter(Objects::nonNull).sorted().toList();
        BigDecimal medianR = median(sortedR);
        BigDecimal cumulative = BigDecimal.ZERO;
        BigDecimal peak = BigDecimal.ZERO;
        BigDecimal maximumDrawdown = BigDecimal.ZERO;
        int losingStreak = 0;
        int maximumLosingStreak = 0;
        for (BacktestingTrade row : rows) {
            BigDecimal value = row.getPnlR() == null ? BigDecimal.ZERO : row.getPnlR();
            cumulative = cumulative.add(value);
            if (cumulative.compareTo(peak) > 0) peak = cumulative;
            BigDecimal drawdown = peak.subtract(cumulative);
            if (drawdown.compareTo(maximumDrawdown) > 0) maximumDrawdown = drawdown;
            if (row.getResult() == BacktestingTradeResult.LOSS) {
                losingStreak++;
                maximumLosingStreak = Math.max(maximumLosingStreak, losingStreak);
            } else {
                losingStreak = 0;
            }
        }
        return BacktestingMetricResponse.builder()
                .rSampleSize(rCount).currencyMetrics(currencies)
                .trades(total)
                .wins(wins)
                .losses(losses)
                .breakevens(breakevens)
                .winRate(rate(wins, total))
                .lossRate(rate(losses, total))
                .breakevenRate(rate(breakevens, total))
                .totalR(completeR ? (scale(totalR)) : null)
                .averageR(completeR ? (total == 0 ? BigDecimal.ZERO : scale(totalR.divide(BigDecimal.valueOf(total), 4, RoundingMode.HALF_UP))) : null)
                .expectancy(completeR ? (total == 0 ? BigDecimal.ZERO : scale(totalR.divide(BigDecimal.valueOf(total), 4, RoundingMode.HALF_UP))) : null)
                .profitFactor(completeR ? (grossLoss.compareTo(BigDecimal.ZERO) == 0 ? (grossWin.compareTo(BigDecimal.ZERO) > 0 ? null : BigDecimal.ZERO) : scale(grossWin.divide(grossLoss, 4, RoundingMode.HALF_UP))) : null)
                .averageWinR(completeR ? (avgWin) : null)
                .averageLossR(completeR ? (avgLoss) : null)
                .largestWinR(completeR ? (rows.stream().map(BacktestingTrade::getPnlR).filter(v -> v != null && v.signum() > 0).max(Comparator.naturalOrder()).map(this::scale).orElse(BigDecimal.ZERO)) : null)
                .largestLossR(completeR ? (rows.stream().map(BacktestingTrade::getPnlR).filter(v -> v != null && v.signum() < 0).min(Comparator.naturalOrder()).map(this::scale).orElse(BigDecimal.ZERO)) : null)
                .medianR(completeR ? (medianR) : null)
                .maximumDrawdownR(completeR ? (scale(maximumDrawdown)) : null)
                .maximumLosingStreak(maximumLosingStreak)
                .currentLosingStreak(losingStreak)
                .sampleQuality(sampleQuality(total))
                .build();
    }

    private Comparator<BacktestingTrade> realizedOrder() {
        return Comparator.comparing((BacktestingTrade t) -> t.getExitDate() != null ? t.getExitDate() : t.getDate(), Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(t -> t.getExitTime() != null ? t.getExitTime() : t.getEntryTime(), Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(BacktestingTrade::getDate, Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(BacktestingTrade::getEntryTime, Comparator.nullsFirst(Comparator.naturalOrder()));
    }

    private BacktestingCurrencyMetricResponse currencyMetrics(String currency, List<BacktestingTrade> rows) {
        List<BigDecimal> values = rows.stream().map(BacktestingTrade::getNetPnl).toList();
        List<BigDecimal> winners = values.stream().filter(v -> v.signum() > 0).toList();
        List<BigDecimal> losers = values.stream().filter(v -> v.signum() < 0).toList();
        BigDecimal grossWin = winners.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal grossLoss = losers.stream().reduce(BigDecimal.ZERO, BigDecimal::add).abs();
        BigDecimal total = values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal cumulative = BigDecimal.ZERO, peak = BigDecimal.ZERO, drawdown = BigDecimal.ZERO;
        for (BigDecimal value : values) {
            cumulative = cumulative.add(value);
            peak = peak.max(cumulative);
            drawdown = drawdown.max(peak.subtract(cumulative));
        }
        List<BigDecimal> durations = rows.stream().filter(t -> t.getExitDate() != null && t.getExitTime() != null)
                .map(t -> BigDecimal.valueOf(Duration.between(LocalDateTime.of(t.getDate(), t.getEntryTime()),
                        LocalDateTime.of(t.getExitDate(), t.getExitTime())).toSeconds()).divide(BigDecimal.valueOf(60), 8, RoundingMode.HALF_UP)).toList();
        return BacktestingCurrencyMetricResponse.builder().currency(currency).trades(rows.size())
                .netPnl(scale(total)).grossProfit(scale(grossWin)).grossLoss(scale(grossLoss)).expectancy(average(values))
                .profitFactor(grossLoss.signum() == 0 ? (grossWin.signum() > 0 ? null : BigDecimal.ZERO) : scale(grossWin.divide(grossLoss, 8, RoundingMode.HALF_UP)))
                .averageWinner(average(winners)).averageLoser(average(losers))
                .largestWinner(winners.stream().max(Comparator.naturalOrder()).map(this::scale).orElse(BigDecimal.ZERO))
                .largestLoser(losers.stream().min(Comparator.naturalOrder()).map(this::scale).orElse(BigDecimal.ZERO))
                .maximumDrawdown(scale(drawdown))
                .commission(sumKnown(rows, BacktestingTrade::getCommission))
                .averageHoldingMinutes(averageKnown(durations))
                .averageDurationBars(averageKnown(rows.stream().map(BacktestingTrade::getDurationBars).filter(Objects::nonNull).map(BigDecimal::valueOf).toList()))
                .averageFavorableExcursion(averageKnown(rows.stream().map(BacktestingTrade::getFavorableExcursion).filter(Objects::nonNull).toList()))
                .averageAdverseExcursion(averageKnown(rows.stream().map(BacktestingTrade::getAdverseExcursion).filter(Objects::nonNull).toList())).build();
    }

    private BigDecimal averageKnown(List<BigDecimal> values) { return values.isEmpty() ? null : average(values); }
    private BigDecimal sumKnown(List<BacktestingTrade> rows, Function<BacktestingTrade, BigDecimal> field) {
        return rows.stream().anyMatch(t -> field.apply(t) == null) ? null : scale(rows.stream().map(field).reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    public String sampleQuality(int trades) {
        if (trades < 5) return "Insufficient data";
        if (trades < 10) return "Exploratory";
        if (trades < 30) return "Early signal";
        if (trades < 50) return "Developing edge";
        return "Validated sample";
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
                    BigDecimal expectancyDelta = difference(metrics.getExpectancy(), baseline.getExpectancy());
                    BigDecimal totalRDelta = difference(metrics.getTotalR(), baseline.getTotalR());
                    return BacktestingBreakdownRowResponse.builder()
                            .dimension(dimension)
                            .label(entry.getKey())
                            .filters(filters.apply(entry.getKey()))
                            .metrics(metrics)
                            .expectancyDelta(expectancyDelta)
                            .totalRDelta(totalRDelta)
                            .verdict(verdict(metrics.getTrades(), expectancyDelta))
                            .warning(expectancyDelta != null && metrics.getTrades() < 10 && expectancyDelta.compareTo(BigDecimal.ZERO) > 0
                                    ? "Caution: this filter improves expectancy but only " + metrics.getTrades() + " trades remain. Gather more evidence before changing your trading plan."
                                    : null)
                            .build();
                })
                .sorted(Comparator.comparing((BacktestingBreakdownRowResponse row) -> row.getMetrics().getExpectancy(), Comparator.nullsFirst(Comparator.naturalOrder())).reversed())
                .toList();
    }

    private void applyTradeRequest(BacktestingTrade trade, BacktestingTradeRequest request, BacktestingTradeSource fallbackSource) {
        if (trade.getImportFormat() != null && (!Objects.equals(trade.getDate(), request.getDate())
                || !Objects.equals(trade.getEntryTime(), request.getEntryTime())
                || !trade.getInstrument().equalsIgnoreCase(Objects.toString(request.getInstrument(), ""))
                || trade.getDirection() != request.getDirection() || trade.getResult() != request.getResult())) {
            throw new IllegalArgumentException("Replay execution fields are preserved from the export; edit classification, notes or explicit R only");
        }
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
        if (request.getPnlR() == null && trade.getNetPnl() == null) throw new IllegalArgumentException("pnlR is required for trades without monetary PnL");
        trade.setPnlR(request.getPnlR());
        trade.setContextTimeframe(normalizeText(request.getContextTimeframe()));
        trade.setExecutionTimeframe(normalizeText(request.getExecutionTimeframe()));
        trade.setEntryTimeframe(normalizeText(request.getEntryTimeframe()));
        trade.setTagsJson(writeList(normalizeList(request.getTags())));
        trade.setNotes(normalizeText(request.getNotes()));
        trade.setSource(trade.getImportFormat() != null ? BacktestingTradeSource.IMPORT : request.getSource() == null || request.getSource() == BacktestingTradeSource.LIVE
                ? fallbackSource : request.getSource());
        trade.setTradeScope(trade.getImportFormat() != null ? BacktestingTradeScope.REPLAY : request.getTradeScope() == null ? BacktestingTradeScope.BACKTEST : request.getTradeScope());
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
                .exitDate(trade.getExitDate())
                .exitTime(trade.getExitTime())
                .entryPrice(trade.getEntryPrice())
                .exitPrice(trade.getExitPrice())
                .quantity(trade.getQuantity())
                .positionValue(trade.getPositionValue())
                .netPnl(trade.getNetPnl())
                .currency(trade.getCurrency())
                .returnPercent(trade.getReturnPercent())
                .commission(trade.getCommission())
                .favorableExcursion(trade.getFavorableExcursion())
                .adverseExcursion(trade.getAdverseExcursion())
                .favorableExcursionPercent(trade.getFavorableExcursionPercent())
                .adverseExcursionPercent(trade.getAdverseExcursionPercent())
                .reportedCumulativePnl(trade.getReportedCumulativePnl())
                .reportedCumulativePercent(trade.getReportedCumulativePercent())
                .durationBars(trade.getDurationBars())
                .entrySignal(trade.getEntrySignal())
                .exitSignal(trade.getExitSignal())
                .importFormat(trade.getImportFormat())
                .importFileName(trade.getImportFileName())
                .importTradeNumber(trade.getImportTradeNumber())
                .importFingerprint(trade.getImportFingerprint())
                .sourceTimezone(trade.getSourceTimezone())
                .contextTimeframe(trade.getContextTimeframe())
                .executionTimeframe(trade.getExecutionTimeframe())
                .entryTimeframe(trade.getEntryTimeframe())
                .tags(readList(trade.getTagsJson()))
                .notes(trade.getNotes())
                .source(trade.getSource())
                .tradeScope(trade.getTradeScope())
                .syncStatus("SYNCED")
                .classificationStatus(trade.getImportFormat() != null ? "PARTIAL" : "COMPLETE")
                .includedInAnalytics(true)
                .ruleBreakCount(trade.getImportFormat() != null ? null : 0)
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
                case "source" -> value.equalsIgnoreCase(trade.getSource().name());
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
        if (expectancyDelta == null) return "R unavailable";
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

    private BigDecimal median(List<BigDecimal> values) {
        if (values == null || values.isEmpty()) return BigDecimal.ZERO;
        int middle = values.size() / 2;
        if (values.size() % 2 == 1) return scale(values.get(middle));
        return scale(values.get(middle - 1).add(values.get(middle)).divide(BigDecimal.valueOf(2), 4, RoundingMode.HALF_UP));
    }

    private List<BacktestingTrade> researchTrades(UUID workspaceId, User user) {
        List<BacktestingTrade> trades = new ArrayList<>(
                tradeRepository.findByWorkspace_IdAndUser_IdOrderByDateAscEntryTimeAscCreatedAtAsc(workspaceId, user.getId()));
        evidenceSyncService.includedLinks(workspaceId, user.getId()).stream()
                .map(evidenceSyncService::materialize)
                .forEach(trades::add);
        trades.sort(Comparator.comparing(BacktestingTrade::getDate).thenComparing(BacktestingTrade::getEntryTime));
        return trades;
    }

    private String regressionStatus(List<BacktestingTrade> historical, List<BacktestingTrade> recentLive) {
        if (recentLive.size() < 5 || historical.isEmpty() || historical.stream().anyMatch(t -> t.getPnlR() == null)
                || recentLive.stream().anyMatch(t -> t.getPnlR() == null)) return "INSUFFICIENT_LIVE_DATA";
        BigDecimal delta = calculateMetrics(recentLive).getExpectancy().subtract(calculateMetrics(historical).getExpectancy());
        if (delta.compareTo(evidenceAssessmentService.materialExpectancyGap().negate()) <= 0) return "DETERIORATING";
        if (delta.compareTo(BigDecimal.valueOf(-0.2)) < 0) return "WATCH";
        if (delta.compareTo(BigDecimal.valueOf(0.2)) > 0) return "IMPROVING";
        return "STABLE";
    }

    private BigDecimal difference(BigDecimal left, BigDecimal right) {
        return left == null || right == null ? null : scale(left.subtract(right));
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
