package com.tradevault.service.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.domain.entity.BacktestRun;
import com.tradevault.domain.entity.BacktestTrade;
import com.tradevault.domain.entity.BacktestDataset;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestExitReason;
import com.tradevault.domain.enums.BacktestOrderType;
import com.tradevault.domain.enums.BacktestRunStatus;
import com.tradevault.domain.enums.ContextSnapshotMode;
import com.tradevault.domain.enums.Direction;
import com.tradevault.dto.backtest.BacktestCandlesResponse;
import com.tradevault.dto.backtest.BacktestCandleDto;
import com.tradevault.dto.backtest.BacktestRunRequest;
import com.tradevault.dto.backtest.BacktestRunResponse;
import com.tradevault.dto.backtest.BacktestTradeResponse;
import com.tradevault.dto.backtest.BacktestTradeSimulateRequest;
import com.tradevault.exception.BacktestDomainException;
import com.tradevault.exception.BacktestErrorCodes;
import com.tradevault.repository.BacktestRunRepository;
import com.tradevault.repository.BacktestTradeRepository;
import com.tradevault.service.ContextSnapshotService;
import com.tradevault.service.CurrentUserService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BacktestService {
    private final BacktestRunRepository backtestRunRepository;
    private final BacktestTradeRepository backtestTradeRepository;
    private final CandleDataService candleDataService;
    private final BacktestDatasetService backtestDatasetService;
    private final CurrentUserService currentUserService;
    private final ContextSnapshotService contextSnapshotService;
    private final ObjectMapper objectMapper;

    @Transactional
    public BacktestRunResponse createRun(BacktestRunRequest request) {
        User user = currentUserService.getCurrentUser();
        ResolvedCandleRequest resolved = resolveCandleRequest(
                user,
                request.getDataSource() == null ? request.getProvider() : request.getDataSource(),
                request.getDatasetId(),
                request.getSourceId(),
                request.getSymbol(),
                request.getTimeframe(),
                request.getFrom(),
                request.getTo()
        );

        List<BacktestCandle> candles = resolved.rangeEmpty()
                ? List.of()
                : candleDataService.getCandles(
                user.getId(),
                resolved.source().name(),
                resolved.sourceId(),
                resolved.symbol(),
                resolved.timeframe(),
                resolved.rangeFrom(),
                resolved.rangeTo(),
                request.isRefresh()
        );
        candles = filterBySessionWindow(candles, request.getSessionWindow());

        BacktestRun run = BacktestRun.builder()
                .user(user)
                .symbol(resolved.symbol())
                .timeframe(resolved.timeframe())
                .rangeFrom(resolved.rangeFrom())
                .rangeTo(resolved.rangeTo())
                .sessionWindow(normalizeOptionalText(request.getSessionWindow()))
                .spread(request.getSpread())
                .slippage(request.getSlippage())
                .provider(resolved.source().name())
                .sourceId(resolved.sourceId())
                .datasetId(resolved.datasetId())
                .status(BacktestRunStatus.READY)
                .candleCount(candles.size())
                .build();

        BacktestRun saved = backtestRunRepository.save(run);
        return toRunResponse(saved, toCandleDto(candles));
    }

    @Transactional(readOnly = true)
    public BacktestCandlesResponse loadCandles(String sourceRaw,
                                               UUID datasetId,
                                               String sourceIdRaw,
                                               String symbolRaw,
                                               String timeframeRaw,
                                               OffsetDateTime from,
                                               OffsetDateTime to,
                                               String sessionWindow,
                                               boolean refresh) {
        User user = currentUserService.getCurrentUser();
        ResolvedCandleRequest resolved = resolveCandleRequest(
                user,
                sourceRaw,
                datasetId,
                sourceIdRaw,
                symbolRaw,
                timeframeRaw,
                from,
                to
        );

        List<BacktestCandle> candles = resolved.rangeEmpty()
                ? List.of()
                : candleDataService.getCandles(
                user.getId(),
                resolved.source().name(),
                resolved.sourceId(),
                resolved.symbol(),
                resolved.timeframe(),
                resolved.rangeFrom(),
                resolved.rangeTo(),
                refresh
        );
        List<BacktestCandle> filtered = filterBySessionWindow(candles, sessionWindow);
        String message = filtered.isEmpty() ? "No candles for range" : null;

        return BacktestCandlesResponse.builder()
                .provider(resolved.source().name())
                .sourceId(resolved.sourceId())
                .datasetId(resolved.datasetId())
                .symbol(resolved.symbol())
                .timeframe(resolved.timeframe())
                .from(resolved.rangeFrom())
                .to(resolved.rangeTo())
                .candleCount(filtered.size())
                .message(message)
                .candles(toCandleDto(filtered))
                .build();
    }

    @Transactional(readOnly = true)
    public List<BacktestRunResponse> listRuns() {
        User user = currentUserService.getCurrentUser();
        return backtestRunRepository.findByUser_IdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(run -> toRunResponse(run, List.of()))
                .toList();
    }

    @Transactional(readOnly = true)
    public BacktestRunResponse getRun(UUID runId) {
        User user = currentUserService.getCurrentUser();
        BacktestRun run = requireRun(runId, user.getId());
        List<BacktestCandle> candles = loadRunCandles(run);
        return toRunResponse(run, toCandleDto(candles));
    }

    @Transactional(readOnly = true)
    public List<BacktestTradeResponse> listRunTrades(UUID runId) {
        User user = currentUserService.getCurrentUser();
        requireRun(runId, user.getId());
        return backtestTradeRepository.findByRun_IdAndUser_IdOrderByCreatedAtDesc(runId, user.getId())
                .stream()
                .map(this::toTradeResponse)
                .toList();
    }

    @Transactional
    public BacktestTradeResponse simulateTrade(UUID runId, BacktestTradeSimulateRequest request) {
        User user = currentUserService.getCurrentUser();
        BacktestRun run = requireRun(runId, user.getId());
        List<BacktestCandle> candles = loadRunCandles(run);
        if (candles.isEmpty()) {
            throw new IllegalArgumentException("No candles loaded for this run");
        }

        BacktestOrderType orderType = request.getOrderType() == null ? BacktestOrderType.MARKET : request.getOrderType();
        boolean conservativeSameBar = request.getConservativeSameBar() == null || request.getConservativeSameBar();

        int cursorIndex = findCursorIndex(candles, request.getReplayCursorTime());
        FillOutcome fill = resolveFill(candles, cursorIndex, request, orderType);

        BacktestTrade trade = BacktestTrade.builder()
                .run(run)
                .user(user)
                .strategyId(request.getStrategyId())
                .symbol(run.getSymbol())
                .direction(request.getDirection())
                .orderType(orderType)
                .entryPrice(fill.entryPrice())
                .stopLossPrice(request.getStopLossPrice())
                .takeProfitPrice(request.getTakeProfitPrice())
                .riskAmount(request.getRiskAmount())
                .invalidationText(normalizeOptionalText(request.getInvalidationText()))
                .requestedAt(OffsetDateTime.now())
                .filled(fill.filled())
                .breakEven(false)
                .metadataJson(buildMetadata(cursorIndex, fill.candleIndex(), null, null))
                .build();

        if (!fill.filled()) {
            trade.setExitReason(BacktestExitReason.OPEN);
            var snapshot = contextSnapshotService.createSnapshot(
                    user,
                    ContextSnapshotMode.BACKTEST,
                    request.getStrategyId(),
                    request.getPrereqsTemplateId(),
                    writeJsonAsString(request.getPrereqsStatesJson(), true),
                    request.getTriggersTemplateId(),
                    writeJsonAsString(request.getTriggersStatesJson(), true),
                    request.getSelectedSweepLevelId(),
                    fallbackArray(request.getLevelsSnapshotJson()),
                    fallbackObject(request.getLockInSnapshotJson()),
                    computeRr(request.getDirection(), fill.entryPrice(), request.getStopLossPrice(), request.getTakeProfitPrice()),
                    fallbackObject(request.getQualityScoreInputsJson()),
                    run.getProvider(),
                    run.getSourceId(),
                    run.getDatasetId(),
                    run.getSymbol(),
                    run.getTimeframe(),
                    request.getReplayCursorTime()
            );
            trade.setContextSnapshotId(snapshot.getId());
            trade.setStrategyVersionId(snapshot.getStrategyVersionId());
            return toTradeResponse(backtestTradeRepository.save(trade));
        }

        ExitOutcome exit = resolveExit(
                candles,
                fill.candleIndex(),
                request.getDirection(),
                fill.entryPrice(),
                request.getStopLossPrice(),
                request.getTakeProfitPrice(),
                conservativeSameBar
        );

        BigDecimal riskPerUnit = fill.entryPrice().subtract(request.getStopLossPrice()).abs();
        Excursion excursion = computeExcursion(candles, fill.candleIndex(), exit.exitIndex(), request.getDirection(), fill.entryPrice(), riskPerUnit);

        trade.setEntryTime(fill.entryTime());
        trade.setExitTime(exit.exitTime());
        trade.setExitReason(exit.exitReason());
        trade.setMetadataJson(buildMetadata(cursorIndex, fill.candleIndex(), exit.exitIndex(), conservativeSameBar));
        trade.setMaePrice(excursion.maePrice());
        trade.setMfePrice(excursion.mfePrice());
        trade.setMaeR(excursion.maeR());
        trade.setMfeR(excursion.mfeR());
        trade.setTimeToPlus1RBars(excursion.timeToPlus1RBars());
        trade.setTimeToPlus1RMinutes(excursion.timeToPlus1RMinutes());

        if (exit.exitPrice() != null && exit.exitReason() != BacktestExitReason.OPEN) {
            BigDecimal pnlPerUnit = request.getDirection() == Direction.LONG
                    ? exit.exitPrice().subtract(fill.entryPrice())
                    : fill.entryPrice().subtract(exit.exitPrice());
            BigDecimal rMultiple = pnlPerUnit.divide(riskPerUnit, 4, RoundingMode.HALF_UP);
            trade.setRMultiple(rMultiple);
            trade.setWin(rMultiple.compareTo(BigDecimal.ZERO) > 0);
            trade.setBreakEven(rMultiple.compareTo(BigDecimal.ZERO) == 0);
            if (exit.exitTime() != null && fill.entryTime() != null) {
                long mins = Duration.between(fill.entryTime(), exit.exitTime()).toMinutes();
                trade.setDurationMinutes((int) Math.max(0, mins));
            }
            if (exit.exitIndex() != null) {
                trade.setDurationBars(Math.max(1, exit.exitIndex() - fill.candleIndex() + 1));
            }
        }

        var snapshot = contextSnapshotService.createSnapshot(
                user,
                ContextSnapshotMode.BACKTEST,
                request.getStrategyId(),
                request.getPrereqsTemplateId(),
                writeJsonAsString(request.getPrereqsStatesJson(), true),
                request.getTriggersTemplateId(),
                writeJsonAsString(request.getTriggersStatesJson(), true),
                request.getSelectedSweepLevelId(),
                fallbackArray(request.getLevelsSnapshotJson()),
                fallbackObject(request.getLockInSnapshotJson()),
                computeRr(request.getDirection(), fill.entryPrice(), request.getStopLossPrice(), request.getTakeProfitPrice()),
                fallbackObject(request.getQualityScoreInputsJson()),
                run.getProvider(),
                run.getSourceId(),
                run.getDatasetId(),
                run.getSymbol(),
                run.getTimeframe(),
                request.getReplayCursorTime()
        );
        trade.setContextSnapshotId(snapshot.getId());
        trade.setStrategyVersionId(snapshot.getStrategyVersionId());
        return toTradeResponse(backtestTradeRepository.save(trade));
    }

    private BacktestRun requireRun(UUID runId, UUID userId) {
        return backtestRunRepository.findByIdAndUser_Id(runId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Backtest run not found"));
    }

    private List<BacktestCandle> loadRunCandles(BacktestRun run) {
        List<BacktestCandle> candles = candleDataService.getCandles(
                run.getUser().getId(),
                run.getProvider(),
                run.getSourceId(),
                run.getSymbol(),
                run.getTimeframe(),
                run.getRangeFrom(),
                run.getRangeTo(),
                false
        );
        return filterBySessionWindow(candles, run.getSessionWindow());
    }

    private ResolvedCandleRequest resolveCandleRequest(User user,
                                                       String sourceRaw,
                                                       UUID datasetId,
                                                       String sourceIdRaw,
                                                       String symbolRaw,
                                                       String timeframeRaw,
                                                       OffsetDateTime fromRaw,
                                                       OffsetDateTime toRaw) {
        BacktestCandleSource source = normalizeSource(sourceRaw);
        String sourceId = normalizeOptionalText(sourceIdRaw);
        String symbol = normalizeOptionalText(symbolRaw);
        String timeframe = normalizeTimeframe(timeframeRaw);
        OffsetDateTime rangeFrom = fromRaw;
        OffsetDateTime rangeTo = toRaw;
        boolean rangeEmpty = false;

        if (source == BacktestCandleSource.CSV || source == BacktestCandleSource.DEMO) {
            if (datasetId == null) {
                throw new BacktestDomainException(
                        BacktestErrorCodes.DATASET_NOT_FOUND,
                        "Dataset is required for the selected source",
                        "Choose an ingested dataset before loading backtest candles.",
                        HttpStatus.BAD_REQUEST
                );
            }
            BacktestDataset dataset = backtestDatasetService.requireDataset(user.getId(), datasetId);
            if (dataset.getProvider() != source) {
                throw new BacktestDomainException(
                        BacktestErrorCodes.DATASET_NOT_FOUND,
                        "Dataset provider mismatch",
                        "Select a dataset that matches the selected data source.",
                        HttpStatus.BAD_REQUEST
                );
            }
            sourceId = dataset.getSourceId();
            symbol = normalizeSymbol(dataset.getSymbolDisplay());
            timeframe = dataset.getTimeframe().name();

            DatasetRange range = resolveDatasetRange(dataset, rangeFrom, rangeTo);
            rangeFrom = range.from();
            rangeTo = range.to();
            rangeEmpty = range.empty();
        } else {
            symbol = normalizeSymbol(symbolRaw);
            if (source == BacktestCandleSource.OANDA && sourceId == null) {
                sourceId = user.getId().toString();
            }

            OffsetDateTime nowUtc = OffsetDateTime.now(ZoneOffset.UTC);
            if (rangeTo == null) {
                rangeTo = nowUtc;
            }
            if (rangeFrom == null) {
                rangeFrom = rangeTo.minusDays(90);
            }
        }

        validateDateRange(rangeFrom, rangeTo);

        return new ResolvedCandleRequest(
                source,
                sourceId,
                symbol,
                timeframe,
                datasetId,
                rangeFrom,
                rangeTo,
                rangeEmpty
        );
    }

    private DatasetRange resolveDatasetRange(BacktestDataset dataset, OffsetDateTime fromRaw, OffsetDateTime toRaw) {
        OffsetDateTime datasetFrom = dataset.getDataFrom();
        OffsetDateTime datasetTo = dataset.getDataTo();

        OffsetDateTime to = toRaw;
        if (to == null) {
            to = datasetTo;
        }
        if (to == null) {
            to = OffsetDateTime.now(ZoneOffset.UTC);
        }

        OffsetDateTime from = fromRaw;
        if (from == null) {
            OffsetDateTime defaultFrom = to.minusDays(90);
            if (datasetFrom != null && defaultFrom.isBefore(datasetFrom)) {
                defaultFrom = datasetFrom;
            }
            from = defaultFrom;
        }

        if (fromRaw == null && datasetFrom != null && from.isBefore(datasetFrom)) {
            from = datasetFrom;
        }
        if (toRaw == null && datasetTo != null && to.isAfter(datasetTo)) {
            to = datasetTo;
        }

        if (datasetFrom != null && datasetTo != null) {
            if (to.isBefore(datasetFrom) || from.isAfter(datasetTo)) {
                return new DatasetRange(from, to, true);
            }
        }
        return new DatasetRange(from, to, false);
    }

    private int findCursorIndex(List<BacktestCandle> candles, OffsetDateTime replayCursorTime) {
        if (replayCursorTime == null) {
            return 0;
        }
        for (int i = 0; i < candles.size(); i++) {
            if (!candles.get(i).timestamp().isBefore(replayCursorTime)) {
                return i;
            }
        }
        return Math.max(0, candles.size() - 1);
    }

    private FillOutcome resolveFill(List<BacktestCandle> candles,
                                    int cursorIndex,
                                    BacktestTradeSimulateRequest request,
                                    BacktestOrderType orderType) {
        int fromIndex = Math.min(candles.size() - 1, Math.max(0, cursorIndex + 1));
        if (fromIndex >= candles.size()) {
            return new FillOutcome(false, null, null, null);
        }

        if (orderType == BacktestOrderType.MARKET) {
            BacktestCandle candle = candles.get(fromIndex);
            return new FillOutcome(true, fromIndex, candle.timestamp(), candle.open());
        }

        if (request.getEntryPrice() == null) {
            throw new IllegalArgumentException("entryPrice is required for LIMIT orders");
        }

        for (int index = fromIndex; index < candles.size(); index++) {
            BacktestCandle candle = candles.get(index);
            if (touchesPrice(candle, request.getEntryPrice())) {
                return new FillOutcome(true, index, candle.timestamp(), request.getEntryPrice());
            }
        }

        return new FillOutcome(false, null, null, request.getEntryPrice());
    }

    private ExitOutcome resolveExit(List<BacktestCandle> candles,
                                    int fillIndex,
                                    Direction direction,
                                    BigDecimal entryPrice,
                                    BigDecimal stopLossPrice,
                                    BigDecimal takeProfitPrice,
                                    boolean conservativeSameBar) {
        for (int index = fillIndex; index < candles.size(); index++) {
            BacktestCandle candle = candles.get(index);
            boolean slHit;
            boolean tpHit;
            if (direction == Direction.LONG) {
                slHit = candle.low().compareTo(stopLossPrice) <= 0;
                tpHit = takeProfitPrice != null && candle.high().compareTo(takeProfitPrice) >= 0;
            } else {
                slHit = candle.high().compareTo(stopLossPrice) >= 0;
                tpHit = takeProfitPrice != null && candle.low().compareTo(takeProfitPrice) <= 0;
            }

            if (slHit && tpHit) {
                if (conservativeSameBar) {
                    return new ExitOutcome(index, candle.timestamp(), stopLossPrice, BacktestExitReason.SL);
                }
                return new ExitOutcome(index, candle.timestamp(), takeProfitPrice, BacktestExitReason.TP);
            }
            if (slHit) {
                return new ExitOutcome(index, candle.timestamp(), stopLossPrice, BacktestExitReason.SL);
            }
            if (tpHit) {
                return new ExitOutcome(index, candle.timestamp(), takeProfitPrice, BacktestExitReason.TP);
            }
        }

        return new ExitOutcome(candles.size() - 1, null, null, BacktestExitReason.OPEN);
    }

    private Excursion computeExcursion(List<BacktestCandle> candles,
                                       int fillIndex,
                                       Integer exitIndex,
                                       Direction direction,
                                       BigDecimal entryPrice,
                                       BigDecimal riskPerUnit) {
        int end = exitIndex == null ? candles.size() - 1 : Math.min(exitIndex, candles.size() - 1);
        BigDecimal mae = BigDecimal.ZERO;
        BigDecimal mfe = BigDecimal.ZERO;
        Integer timeToPlus1RBars = null;
        Integer timeToPlus1RMinutes = null;

        for (int index = fillIndex; index <= end; index++) {
            BacktestCandle candle = candles.get(index);
            BigDecimal adverse;
            BigDecimal favorable;
            if (direction == Direction.LONG) {
                adverse = entryPrice.subtract(candle.low());
                favorable = candle.high().subtract(entryPrice);
            } else {
                adverse = candle.high().subtract(entryPrice);
                favorable = entryPrice.subtract(candle.low());
            }
            if (adverse.compareTo(BigDecimal.ZERO) < 0) {
                adverse = BigDecimal.ZERO;
            }
            if (favorable.compareTo(BigDecimal.ZERO) < 0) {
                favorable = BigDecimal.ZERO;
            }
            if (adverse.compareTo(mae) > 0) {
                mae = adverse;
            }
            if (favorable.compareTo(mfe) > 0) {
                mfe = favorable;
            }
            if (riskPerUnit.compareTo(BigDecimal.ZERO) > 0
                    && timeToPlus1RBars == null
                    && favorable.compareTo(riskPerUnit) >= 0) {
                timeToPlus1RBars = Math.max(1, index - fillIndex + 1);
                long mins = Duration.between(candles.get(fillIndex).timestamp(), candle.timestamp()).toMinutes();
                timeToPlus1RMinutes = (int) Math.max(0, mins);
            }
        }

        BigDecimal maeR = riskPerUnit.compareTo(BigDecimal.ZERO) == 0
                ? null
                : mae.divide(riskPerUnit, 4, RoundingMode.HALF_UP);
        BigDecimal mfeR = riskPerUnit.compareTo(BigDecimal.ZERO) == 0
                ? null
                : mfe.divide(riskPerUnit, 4, RoundingMode.HALF_UP);

        return new Excursion(mae, mfe, maeR, mfeR, timeToPlus1RBars, timeToPlus1RMinutes);
    }

    private JsonNode buildMetadata(int cursorIndex, Integer fillIndex, Integer exitIndex, Boolean conservativeSameBar) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("cursorIndex", cursorIndex);
        if (fillIndex != null) {
            node.put("fillIndex", fillIndex);
        }
        if (exitIndex != null) {
            node.put("exitIndex", exitIndex);
        }
        if (conservativeSameBar != null) {
            node.put("conservativeSameBar", conservativeSameBar);
        }
        return node;
    }

    private boolean touchesPrice(BacktestCandle candle, BigDecimal price) {
        return candle.low().compareTo(price) <= 0 && candle.high().compareTo(price) >= 0;
    }

    private List<BacktestCandle> filterBySessionWindow(List<BacktestCandle> candles, String sessionWindow) {
        String normalized = normalizeOptionalText(sessionWindow);
        if (normalized == null || "ALL".equalsIgnoreCase(normalized)) {
            return candles;
        }

        String upper = normalized.toUpperCase(Locale.ROOT);
        if ("LONDON".equals(upper)) {
            return candles.stream()
                    .filter(c -> {
                        int hour = c.timestamp().getHour();
                        return hour >= 7 && hour < 12;
                    })
                    .toList();
        }
        if ("NY".equals(upper) || "NEW_YORK".equals(upper)) {
            return candles.stream()
                    .filter(c -> {
                        int hour = c.timestamp().getHour();
                        return hour >= 13 && hour < 17;
                    })
                    .toList();
        }

        String[] parts = normalized.split("-");
        if (parts.length == 2) {
            try {
                LocalTime from = LocalTime.parse(parts[0].trim());
                LocalTime to = LocalTime.parse(parts[1].trim());
                return candles.stream()
                        .filter(c -> {
                            LocalTime time = c.timestamp().toLocalTime();
                            return !time.isBefore(from) && !time.isAfter(to);
                        })
                        .toList();
            } catch (Exception ignored) {
                return candles;
            }
        }
        return candles;
    }

    private BacktestRunResponse toRunResponse(BacktestRun run, List<BacktestCandleDto> candles) {
        return BacktestRunResponse.builder()
                .id(run.getId())
                .symbol(run.getSymbol())
                .timeframe(run.getTimeframe())
                .from(run.getRangeFrom())
                .to(run.getRangeTo())
                .sessionWindow(run.getSessionWindow())
                .spread(run.getSpread())
                .slippage(run.getSlippage())
                .provider(run.getProvider())
                .dataSource(run.getProvider())
                .sourceId(run.getSourceId())
                .datasetId(run.getDatasetId())
                .status(run.getStatus())
                .candleCount(run.getCandleCount() == null ? 0 : run.getCandleCount())
                .createdAt(run.getCreatedAt())
                .updatedAt(run.getUpdatedAt())
                .candles(candles)
                .build();
    }

    private List<BacktestCandleDto> toCandleDto(List<BacktestCandle> candles) {
        return candles.stream()
                .sorted(Comparator.comparing(BacktestCandle::timestamp))
                .map(item -> BacktestCandleDto.builder()
                        .timestamp(item.timestamp())
                        .open(item.open())
                        .high(item.high())
                        .low(item.low())
                        .close(item.close())
                        .volume(item.volume())
                        .build())
                .toList();
    }

    private BacktestTradeResponse toTradeResponse(BacktestTrade trade) {
        return BacktestTradeResponse.builder()
                .id(trade.getId())
                .runId(trade.getRun().getId())
                .strategyId(trade.getStrategyId())
                .strategyVersionId(trade.getStrategyVersionId())
                .contextSnapshotId(trade.getContextSnapshotId())
                .symbol(trade.getSymbol())
                .direction(trade.getDirection())
                .orderType(trade.getOrderType())
                .entryPrice(trade.getEntryPrice())
                .stopLossPrice(trade.getStopLossPrice())
                .takeProfitPrice(trade.getTakeProfitPrice())
                .riskAmount(trade.getRiskAmount())
                .invalidationText(trade.getInvalidationText())
                .requestedAt(trade.getRequestedAt())
                .entryTime(trade.getEntryTime())
                .exitTime(trade.getExitTime())
                .filled(trade.isFilled())
                .exitReason(trade.getExitReason())
                .win(trade.getWin())
                .breakEven(trade.isBreakEven())
                .rMultiple(trade.getRMultiple())
                .maePrice(trade.getMaePrice())
                .mfePrice(trade.getMfePrice())
                .maeR(trade.getMaeR())
                .mfeR(trade.getMfeR())
                .durationMinutes(trade.getDurationMinutes())
                .durationBars(trade.getDurationBars())
                .timeToPlus1RMinutes(trade.getTimeToPlus1RMinutes())
                .timeToPlus1RBars(trade.getTimeToPlus1RBars())
                .createdAt(trade.getCreatedAt())
                .updatedAt(trade.getUpdatedAt())
                .build();
    }

    private BacktestCandleSource normalizeSource(String provider) {
        if (provider == null || provider.isBlank()) {
            return BacktestCandleSource.OANDA;
        }
        try {
            return BacktestCandleSource.valueOf(provider.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.UNSUPPORTED_SYMBOL_TIMEFRAME,
                    "Unsupported backtest source: " + provider,
                    "Supported sources are CSV, OANDA, and DEMO.",
                    HttpStatus.BAD_REQUEST
            );
        }
    }

    private String normalizeSymbol(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            throw new IllegalArgumentException("Symbol is required");
        }
        return symbol.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeTimeframe(String timeframe) {
        if (timeframe == null || timeframe.isBlank()) {
            return "M1";
        }
        return timeframe.trim().toUpperCase(Locale.ROOT);
    }

    private void validateDateRange(OffsetDateTime from, OffsetDateTime to) {
        if (from == null || to == null) {
            throw new IllegalArgumentException("from and to are required");
        }
        if (from.isAfter(to)) {
            throw new IllegalArgumentException("from must be before to");
        }
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private JsonNode fallbackArray(JsonNode value) {
        if (value == null || value.isNull()) {
            return objectMapper.createArrayNode();
        }
        return value;
    }

    private JsonNode fallbackObject(JsonNode value) {
        if (value == null || value.isNull()) {
            return objectMapper.createObjectNode();
        }
        return value;
    }

    private String writeJsonAsString(JsonNode value, boolean asArrayFallback) {
        JsonNode safe = asArrayFallback ? fallbackArray(value) : fallbackObject(value);
        return safe.toString();
    }

    private BigDecimal computeRr(Direction direction,
                                 BigDecimal entry,
                                 BigDecimal stopLoss,
                                 BigDecimal takeProfit) {
        if (direction == null || entry == null || stopLoss == null || takeProfit == null) {
            return null;
        }
        BigDecimal risk = entry.subtract(stopLoss).abs();
        if (risk.compareTo(BigDecimal.ZERO) == 0) {
            return null;
        }
        BigDecimal reward = takeProfit.subtract(entry).abs();
        return reward.divide(risk, 4, RoundingMode.HALF_UP);
    }

    private record FillOutcome(boolean filled, Integer candleIndex, OffsetDateTime entryTime, BigDecimal entryPrice) {}

    private record ExitOutcome(Integer exitIndex, OffsetDateTime exitTime, BigDecimal exitPrice, BacktestExitReason exitReason) {}

    private record DatasetRange(OffsetDateTime from, OffsetDateTime to, boolean empty) {}

    private record ResolvedCandleRequest(
            BacktestCandleSource source,
            String sourceId,
            String symbol,
            String timeframe,
            UUID datasetId,
            OffsetDateTime rangeFrom,
            OffsetDateTime rangeTo,
            boolean rangeEmpty
    ) {}

    private record Excursion(
            BigDecimal maePrice,
            BigDecimal mfePrice,
            BigDecimal maeR,
            BigDecimal mfeR,
            Integer timeToPlus1RBars,
            Integer timeToPlus1RMinutes
    ) {}
}
