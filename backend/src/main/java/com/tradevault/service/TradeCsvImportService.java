package com.tradevault.service;

import com.tradevault.domain.entity.TradeImportRow;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.trade.ImportedTradeCandidate;
import com.tradevault.dto.trade.TradeCsvImportGroupResult;
import com.tradevault.dto.trade.TradeCsvImportSummary;
import com.tradevault.repository.TradeImportRowRepository;
import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.StringReader;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TradeCsvImportService {
    private static final CSVFormat CSV_FORMAT = CSVFormat.DEFAULT.builder()
            .setHeader()
            .setSkipHeaderRecord(true)
            .setCommentMarker('#')
            .setIgnoreEmptyLines(true)
            .setTrim(true)
            .build();

    private static final Set<String> NATIVE_HEADERS = Set.of(
            "symbol",
            "market",
            "direction",
            "openedAt",
            "quantity",
            "entryPrice"
    );

    private static final Set<String> LEGACY_ACTIVITY_HEADERS = Set.of(
            "Action",
            "Time",
            "ISIN",
            "Ticker",
            "ID",
            "No. of shares",
            "Price / share"
    );

    private static final Set<String> TRADOVATE_HEADERS = Set.of(
            "orderId",
            "Account",
            "Order ID",
            "B/S",
            "Contract",
            "Status",
            "Type"
    );

    private static final DateTimeFormatter LEGACY_TIME_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss", Locale.ENGLISH);
    private static final DateTimeFormatter TRADOVATE_TIME_FORMATTER =
            DateTimeFormatter.ofPattern("MM/dd/yyyy HH:mm:ss", Locale.ENGLISH);
    private static final BigDecimal ZERO_TOLERANCE = new BigDecimal("0.00000001");

    private final CurrentUserService currentUserService;
    private final TradeImportRowRepository tradeImportRowRepository;
    private final TradeService tradeService;
    private final TimezoneService timezoneService;

    public TradeCsvImportSummary importCsv(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV file is required");
        }

        User user = currentUserService.getCurrentUser();
        ZoneId userZone = timezoneService.resolveZone(null, user);
        ParsedCsv csv = parseCsv(file.getBytes());
        CsvImportFormat format = detectFormat(csv.headers());

        return switch (format) {
            case NATIVE_TRADE_EXPORT -> importNativeTradeExport(csv.records(), user);
            case LEGACY_ACTIVITY -> importLegacyActivityCsv(csv.records(), user, userZone);
            case TRADOVATE_ORDERS -> importTradovateOrdersCsv(csv.records(), user, userZone);
        };
    }

    private TradeCsvImportSummary importNativeTradeExport(List<CSVRecord> records, User user) {
        List<TradeCsvImportGroupResult> groupResults = new ArrayList<>();
        int parsedRows = 0;
        int groupsSkipped = 0;
        int tradesCreated = 0;
        int tradesUpdated = 0;

        for (CSVRecord record : records) {
            String key = fallbackLabel(trim(record.get("symbol")), "row " + record.getRecordNumber());
            try {
                ImportedTradeCandidate candidate = mapNativeTradeRecord(record);
                parsedRows++;
                TradeService.ImportUpsertResult upsert = tradeService.upsertImportedTrade(candidate);
                if (upsert.updated()) {
                    tradesUpdated++;
                } else {
                    tradesCreated++;
                }
                groupResults.add(buildGroupResult(
                        key,
                        candidate.getSymbol(),
                        candidate.getAccountId(),
                        1,
                        upsert.updated() ? "UPDATED" : "CREATED",
                        null
                ));
            } catch (Exception ex) {
                groupsSkipped++;
                groupResults.add(buildGroupResult(key, key, null, 1, "SKIPPED", safeReason(ex)));
            }
        }

        return buildSummary(
                CsvImportFormat.NATIVE_TRADE_EXPORT,
                records.size(),
                parsedRows,
                groupResults.size(),
                tradesCreated,
                tradesUpdated,
                groupsSkipped,
                groupResults
        );
    }

    private ImportedTradeCandidate mapNativeTradeRecord(CSVRecord record) {
        String symbol = requiredText(record, "symbol");
        Market market = Market.valueOf(requiredText(record, "market").toUpperCase(Locale.ROOT));
        Direction direction = Direction.valueOf(requiredText(record, "direction").toUpperCase(Locale.ROOT));
        OffsetDateTime openedAt = parseIsoDateTime(requiredText(record, "openedAt"));
        OffsetDateTime closedAt = parseIsoDateTime(optionalText(record, "closedAt"));
        BigDecimal quantity = parseDecimal(requiredText(record, "quantity"));
        BigDecimal entryPrice = parseDecimal(requiredText(record, "entryPrice"));
        BigDecimal exitPrice = parseDecimal(optionalText(record, "exitPrice"));
        BigDecimal stopLossPrice = parseDecimal(optionalText(record, "stopLossPrice"));
        BigDecimal takeProfitPrice = parseDecimal(optionalText(record, "takeProfitPrice"));
        BigDecimal fees = parseDecimal(optionalText(record, "fees"));
        BigDecimal commission = parseDecimal(optionalText(record, "commission"));
        BigDecimal slippage = parseDecimal(optionalText(record, "slippage"));
        String accountId = firstNonBlank(optionalText(record, "accountId"), optionalText(record, "brokerAccountId"));
        BigDecimal contractMultiplier = parseDecimal(optionalText(record, "contractMultiplier"));
        String tradeCurrency = optionalText(record, "tradeCurrency");
        String profileCurrency = optionalText(record, "profileCurrency");
        TradeStatus status = parseNativeStatus(optionalText(record, "status"), closedAt, exitPrice);

        return ImportedTradeCandidate.builder()
                .symbol(symbol)
                .market(market)
                .direction(direction)
                .status(status)
                .openedAt(openedAt)
                .closedAt(closedAt)
                .quantity(quantity)
                .entryPrice(entryPrice)
                .exitPrice(exitPrice)
                .stopLossPrice(stopLossPrice)
                .takeProfitPrice(takeProfitPrice)
                .fees(fees)
                .commission(commission)
                .slippage(slippage)
                .tradeCurrency(tradeCurrency)
                .profileCurrency(profileCurrency)
                .accountId(accountId)
                .contractMultiplier(contractMultiplier)
                .build();
    }

    private TradeStatus parseNativeStatus(String rawStatus, OffsetDateTime closedAt, BigDecimal exitPrice) {
        String status = trim(rawStatus);
        if (status != null) {
            return TradeStatus.valueOf(status.toUpperCase(Locale.ROOT));
        }
        return closedAt != null || exitPrice != null ? TradeStatus.CLOSED : TradeStatus.OPEN;
    }

    private TradeCsvImportSummary importLegacyActivityCsv(List<CSVRecord> records, User user, ZoneId userZone) {
        List<LegacyActivityRow> parsedRows = new ArrayList<>();
        List<TradeCsvImportGroupResult> groupResults = new ArrayList<>();

        int totalRows = 0;
        int rowsSkipped = 0;
        for (CSVRecord record : records) {
            totalRows++;
            LegacyActivityRow row = parseLegacyActivityRow(record, userZone);
            if (row == null) {
                rowsSkipped++;
                continue;
            }
            parsedRows.add(row);
        }

        Set<String> existingRowIds = loadExistingImportRowIds(user, parsedRows.stream()
                .map(LegacyActivityRow::transactionId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));

        Map<String, List<LegacyActivityRow>> grouped = parsedRows.stream()
                .collect(Collectors.groupingBy(
                        LegacyActivityRow::groupKey,
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        int tradesCreated = 0;
        int tradesUpdated = 0;
        int groupsSkipped = 0;

        for (Map.Entry<String, List<LegacyActivityRow>> entry : grouped.entrySet()) {
            String groupKey = entry.getKey();
            List<LegacyActivityRow> rows = entry.getValue();
            LegacyComputation computation = computeLegacyGroup(rows);
            if (computation.skipped()) {
                groupsSkipped++;
                groupResults.add(buildGroupResult(groupKey, firstNonBlank(rows.get(0).ticker(), groupKey), null, rows.size(), "SKIPPED", computation.reason()));
                continue;
            }

            TradeService.ImportUpsertResult upsert = tradeService.upsertImportedTrade(computation.candidate());
            if (upsert.updated()) {
                tradesUpdated++;
            } else {
                tradesCreated++;
            }
            saveImportRows(user, rows.stream().map(LegacyActivityRow::transactionId).collect(Collectors.toCollection(LinkedHashSet::new)), existingRowIds);
            groupResults.add(buildGroupResult(
                    groupKey,
                    computation.candidate().getSymbol(),
                    null,
                    rows.size(),
                    upsert.updated() ? "UPDATED" : "CREATED",
                    null
            ));
        }

        return TradeCsvImportSummary.builder()
                .detectedFormat(CsvImportFormat.LEGACY_ACTIVITY.name())
                .totalRows(totalRows)
                .parsedRows(parsedRows.size())
                .rowsSkipped(rowsSkipped)
                .tradeGroups(groupResults.size())
                .isinGroups(groupResults.size())
                .tradesCreated(tradesCreated)
                .tradesUpdated(tradesUpdated)
                .groupsSkipped(groupsSkipped)
                .groupResults(groupResults)
                .build();
    }

    private LegacyActivityRow parseLegacyActivityRow(CSVRecord record, ZoneId userZone) {
        String action = optionalText(record, "Action");
        String time = optionalText(record, "Time");
        String isin = optionalText(record, "ISIN");
        String ticker = optionalText(record, "Ticker");
        String transactionId = optionalText(record, "ID");
        String sharesRaw = optionalText(record, "No. of shares");
        String priceRaw = optionalText(record, "Price / share");

        if (action == null || time == null || isin == null || sharesRaw == null || priceRaw == null) {
            return null;
        }

        LegacySide side = parseLegacySide(action);
        if (side == null) {
            return null;
        }

        OffsetDateTime parsedTime = parseLocalDateTime(time, LEGACY_TIME_FORMATTER, userZone);
        if (parsedTime == null) {
            return null;
        }

        BigDecimal shares = parseDecimal(sharesRaw);
        BigDecimal price = parseDecimal(priceRaw);
        if (shares == null || price == null) {
            return null;
        }

        return new LegacyActivityRow(
                isin,
                ticker,
                transactionId,
                side,
                parsedTime,
                shares,
                price,
                optionalText(record, "Currency (Price / share)")
        );
    }

    private LegacyComputation computeLegacyGroup(List<LegacyActivityRow> rows) {
        List<LegacyActivityRow> buys = rows.stream().filter(row -> row.side() == LegacySide.BUY).toList();
        List<LegacyActivityRow> sells = rows.stream().filter(row -> row.side() == LegacySide.SELL).toList();

        BigDecimal totalBuyShares = sumShares(buys);
        BigDecimal totalSellShares = sumShares(sells);
        if (totalBuyShares.compareTo(ZERO_TOLERANCE) <= 0) {
            return LegacyComputation.skipped("Buy shares missing");
        }
        if (totalSellShares.subtract(totalBuyShares).compareTo(ZERO_TOLERANCE) > 0) {
            return LegacyComputation.skipped("Sell shares exceed buy shares");
        }

        TradeStatus status = totalSellShares.compareTo(totalBuyShares) >= 0 ? TradeStatus.CLOSED : TradeStatus.OPEN;
        BigDecimal openQuantity = status == TradeStatus.CLOSED ? totalBuyShares : totalBuyShares.subtract(totalSellShares);
        String symbol = rows.stream()
                .map(LegacyActivityRow::ticker)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(rows.get(0).isin());
        BigDecimal exitPrice = sells.isEmpty() ? null : weightedAverage(rows.stream().filter(row -> row.side() == LegacySide.SELL).toList());
        OffsetDateTime closedAt = status == TradeStatus.CLOSED && !sells.isEmpty() ? sells.get(sells.size() - 1).time() : null;
        String currency = rows.stream()
                .map(LegacyActivityRow::currency)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);

        ImportedTradeCandidate candidate = ImportedTradeCandidate.builder()
                .symbol(symbol)
                .market(Market.STOCK)
                .direction(Direction.LONG)
                .status(status)
                .openedAt(buys.get(0).time())
                .closedAt(closedAt)
                .quantity(openQuantity)
                .entryPrice(weightedAverage(buys))
                .exitPrice(exitPrice)
                .tradeCurrency(currency)
                .accountId(null)
                .contractMultiplier(BigDecimal.ONE)
                .initialNotes("Imported from legacy activity CSV group " + rows.get(0).isin())
                .build();

        return LegacyComputation.processed(candidate);
    }

    private TradeCsvImportSummary importTradovateOrdersCsv(List<CSVRecord> records, User user, ZoneId userZone) {
        List<TradovateOrderRow> parsedRows = new ArrayList<>();
        List<TradeCsvImportGroupResult> groupResults = new ArrayList<>();
        int totalRows = 0;
        int rowsSkipped = 0;

        for (CSVRecord record : records) {
            totalRows++;
            TradovateOrderRow row = parseTradovateOrderRow(record, userZone);
            if (row == null) {
                rowsSkipped++;
                continue;
            }
            parsedRows.add(row);
        }

        Set<String> existingRowIds = loadExistingImportRowIds(user, parsedRows.stream()
                .map(TradovateOrderRow::rowId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));

        Map<String, List<TradovateOrderRow>> grouped = parsedRows.stream()
                .collect(Collectors.groupingBy(
                        TradovateOrderRow::groupKey,
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        int tradesCreated = 0;
        int tradesUpdated = 0;
        int groupsSkipped = 0;
        int tradeGroups = 0;

        for (Map.Entry<String, List<TradovateOrderRow>> entry : grouped.entrySet()) {
            TradovateGroupReconstruction reconstruction = reconstructTradovateGroup(entry.getValue());
            for (TradeCsvImportGroupResult skipped : reconstruction.skippedResults()) {
                groupResults.add(skipped);
                groupsSkipped++;
            }

            for (TradovateTradeEnvelope envelope : reconstruction.trades()) {
                tradeGroups++;
                try {
                    TradeService.ImportUpsertResult upsert = tradeService.upsertImportedTrade(envelope.candidate());
                    saveImportRows(user, envelope.rowIds(), existingRowIds);
                    if (upsert.updated()) {
                        tradesUpdated++;
                    } else {
                        tradesCreated++;
                    }
                    groupResults.add(buildGroupResult(
                            envelope.key(),
                            envelope.candidate().getSymbol(),
                            envelope.candidate().getAccountId(),
                            envelope.rowIds().size(),
                            upsert.updated() ? "UPDATED" : "CREATED",
                            null
                    ));
                } catch (Exception ex) {
                    groupsSkipped++;
                    groupResults.add(buildGroupResult(
                            envelope.key(),
                            envelope.candidate().getSymbol(),
                            envelope.candidate().getAccountId(),
                            envelope.rowIds().size(),
                            "SKIPPED",
                            safeReason(ex)
                    ));
                }
            }
        }

        return TradeCsvImportSummary.builder()
                .detectedFormat(CsvImportFormat.TRADOVATE_ORDERS.name())
                .totalRows(totalRows)
                .parsedRows(parsedRows.size())
                .rowsSkipped(rowsSkipped)
                .tradeGroups(tradeGroups)
                .isinGroups(tradeGroups)
                .tradesCreated(tradesCreated)
                .tradesUpdated(tradesUpdated)
                .groupsSkipped(groupsSkipped)
                .groupResults(groupResults)
                .build();
    }

    /**
     * Tradovate Orders CSV mapping used by this importer:
     * - orderId / Order ID / Version ID: row identity and traceability; `orderId` is persisted in `trade_import_rows`.
     * - Account: broker account identifier mapped to `Trade.brokerAccountId` and exposed as API `accountId`.
     * - B/S: execution side used to derive trade direction and entry/exit classification.
     * - Contract: mapped to TradeJAudit `symbol`; Product/Product Description are retained in import notes.
     * - avgPrice / Avg Fill Price, filledQty / Filled Qty, Fill Time: required filled execution inputs.
     * - Status + Type + Limit Price + Stop Price: used to ignore non-fills as executions while capturing canceled TP/SL anchors.
     * - Notional Value: used to infer the futures contract multiplier so persisted P&L matches calendar/analytics math.
     * - Currency: mapped to trade/profile currency when present.
     * - Timestamp / Date / Text / Venue / formatting columns: informational or fallback parsing inputs only.
     */
    private TradovateOrderRow parseTradovateOrderRow(CSVRecord record, ZoneId userZone) {
        String accountId = optionalText(record, "Account");
        String contract = firstNonBlank(optionalText(record, "Contract"), optionalText(record, "Product"));
        TradovateSide side = parseTradovateSide(optionalText(record, "B/S"));
        OffsetDateTime timestamp = firstNonNull(
                parseLocalDateTime(optionalText(record, "Fill Time"), TRADOVATE_TIME_FORMATTER, userZone),
                parseLocalDateTime(optionalText(record, "Timestamp"), TRADOVATE_TIME_FORMATTER, userZone)
        );
        if (accountId == null || contract == null || side == null || timestamp == null) {
            return null;
        }

        BigDecimal averagePrice = firstNonNull(
                parseDecimal(optionalText(record, "avgPrice")),
                parseDecimal(optionalText(record, "Avg Fill Price"))
        );
        BigDecimal filledQuantity = firstNonNull(
                parseDecimal(optionalText(record, "filledQty")),
                parseDecimal(optionalText(record, "Filled Qty"))
        );
        BigDecimal limitPrice = firstNonNull(
                parseDecimal(optionalText(record, "Limit Price")),
                parseDecimal(optionalText(record, "decimalLimit"))
        );
        BigDecimal stopPrice = firstNonNull(
                parseDecimal(optionalText(record, "Stop Price")),
                parseDecimal(optionalText(record, "decimalStop"))
        );

        return new TradovateOrderRow(
                trim(optionalText(record, "orderId")),
                accountId,
                side,
                contract,
                optionalText(record, "Product"),
                optionalText(record, "Product Description"),
                trim(optionalText(record, "Status")),
                trim(optionalText(record, "Type")),
                averagePrice,
                filledQuantity,
                timestamp,
                limitPrice,
                stopPrice,
                parseDecimal(optionalText(record, "Quantity")),
                parseDecimal(optionalText(record, "Notional Value")),
                optionalText(record, "Currency"),
                optionalText(record, "Text"),
                optionalText(record, "Order ID"),
                optionalText(record, "Version ID")
        );
    }

    private TradovateGroupReconstruction reconstructTradovateGroup(List<TradovateOrderRow> rows) {
        List<TradovateOrderRow> ordered = rows.stream()
                .sorted(Comparator
                        .comparing(TradovateOrderRow::eventTime, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(TradovateOrderRow::rowId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        List<TradovateTradeEnvelope> trades = new ArrayList<>();
        List<TradeCsvImportGroupResult> skippedResults = new ArrayList<>();
        TradovateAccumulator current = null;
        boolean sawExecution = false;

        for (TradovateOrderRow row : ordered) {
            if (row.isExecution()) {
                sawExecution = true;
                current = applyTradovateExecution(current, row, trades);
                continue;
            }

            if (row.isAnchorCandidate() && current != null && row.side().isOpposite(current.direction())) {
                current.recordAnchor(row);
            }
        }

        if (!sawExecution) {
            skippedResults.add(buildGroupResult(
                    ordered.get(0).groupKey(),
                    ordered.get(0).contract(),
                    ordered.get(0).accountId(),
                    ordered.size(),
                    "SKIPPED",
                    "No filled executions found"
            ));
        } else if (current != null) {
            trades.add(current.toEnvelope());
        }

        return new TradovateGroupReconstruction(trades, skippedResults);
    }

    private TradovateAccumulator applyTradovateExecution(TradovateAccumulator current,
                                                         TradovateOrderRow row,
                                                         List<TradovateTradeEnvelope> completedTrades) {
        BigDecimal remainingQty = defaultQuantity(row.executionQuantity());
        if (remainingQty.compareTo(ZERO_TOLERANCE) <= 0) {
            return current;
        }

        if (current == null) {
            TradovateAccumulator next = TradovateAccumulator.start(row, remainingQty);
            next.recordExecutionRow(row);
            return next;
        }

        Direction executionDirection = row.side().toDirection();
        if (executionDirection == current.direction()) {
            current.addEntry(row, remainingQty);
            current.recordExecutionRow(row);
            return current;
        }

        TradovateAccumulator active = current;
        while (remainingQty.compareTo(ZERO_TOLERANCE) > 0) {
            BigDecimal closeQty = remainingQty.min(active.openQuantity());
            active.addExit(row, closeQty);
            active.recordExecutionRow(row);
            remainingQty = remainingQty.subtract(closeQty);

            if (active.isFlat()) {
                completedTrades.add(active.toEnvelope());
                active = null;
                if (remainingQty.compareTo(ZERO_TOLERANCE) > 0) {
                    active = TradovateAccumulator.start(row, remainingQty);
                    active.recordExecutionRow(row);
                    remainingQty = BigDecimal.ZERO;
                }
            } else {
                remainingQty = BigDecimal.ZERO;
            }
        }

        return active;
    }

    private ParsedCsv parseCsv(byte[] bytes) throws IOException {
        String csvText = new String(bytes, StandardCharsets.UTF_8);
        if (csvText.startsWith("\uFEFF")) {
            csvText = csvText.substring(1);
        }

        try (CSVParser parser = new CSVParser(new StringReader(csvText), CSV_FORMAT)) {
            Map<String, Integer> headerMap = parser.getHeaderMap();
            if (headerMap == null || headerMap.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV headers are missing");
            }
            return new ParsedCsv(new LinkedHashSet<>(headerMap.keySet()), parser.getRecords());
        }
    }

    private CsvImportFormat detectFormat(Set<String> headers) {
        Set<String> normalized = headers.stream()
                .map(TradeCsvImportService::normalizeHeader)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (containsAllHeaders(normalized, NATIVE_HEADERS)) {
            return CsvImportFormat.NATIVE_TRADE_EXPORT;
        }
        if (containsAllHeaders(normalized, LEGACY_ACTIVITY_HEADERS)) {
            return CsvImportFormat.LEGACY_ACTIVITY;
        }
        if (containsAllHeaders(normalized, TRADOVATE_HEADERS)) {
            return CsvImportFormat.TRADOVATE_ORDERS;
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV headers do not match a supported import format");
    }

    private boolean containsAllHeaders(Set<String> normalizedHeaders, Set<String> requiredHeaders) {
        return requiredHeaders.stream().map(TradeCsvImportService::normalizeHeader).allMatch(normalizedHeaders::contains);
    }

    private static String normalizeHeader(String header) {
        return header == null ? "" : header.replace("\uFEFF", "").trim();
    }

    private Set<String> loadExistingImportRowIds(User user, Set<String> rowIds) {
        if (rowIds == null || rowIds.isEmpty()) {
            return new LinkedHashSet<>();
        }
        return tradeImportRowRepository.findAllByUserIdAndTransactionIdIn(user.getId(), rowIds).stream()
                .map(TradeImportRow::getTransactionId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private void saveImportRows(User user, Collection<String> rowIds, Set<String> existingRowIds) {
        if (rowIds == null || rowIds.isEmpty()) {
            return;
        }
        List<TradeImportRow> newRows = rowIds.stream()
                .filter(Objects::nonNull)
                .map(TradeCsvImportService::trim)
                .filter(Objects::nonNull)
                .distinct()
                .filter(rowId -> !existingRowIds.contains(rowId))
                .map(rowId -> TradeImportRow.builder()
                        .user(user)
                        .transactionId(rowId)
                        .importedAt(OffsetDateTime.now(ZoneOffset.UTC))
                        .build())
                .toList();
        if (!newRows.isEmpty()) {
            tradeImportRowRepository.saveAll(newRows);
            newRows.stream().map(TradeImportRow::getTransactionId).forEach(existingRowIds::add);
        }
    }

    private TradeCsvImportSummary buildSummary(CsvImportFormat format,
                                               int totalRows,
                                               int parsedRows,
                                               int tradeGroups,
                                               int tradesCreated,
                                               int tradesUpdated,
                                               int groupsSkipped,
                                               List<TradeCsvImportGroupResult> groupResults) {
        return TradeCsvImportSummary.builder()
                .detectedFormat(format.name())
                .totalRows(totalRows)
                .parsedRows(parsedRows)
                .rowsSkipped(Math.max(totalRows - parsedRows, 0))
                .tradeGroups(tradeGroups)
                .isinGroups(tradeGroups)
                .tradesCreated(tradesCreated)
                .tradesUpdated(tradesUpdated)
                .groupsSkipped(groupsSkipped)
                .groupResults(groupResults)
                .build();
    }

    private TradeCsvImportGroupResult buildGroupResult(String key,
                                                       String symbol,
                                                       String accountId,
                                                       Integer rowCount,
                                                       String status,
                                                       String reason) {
        return TradeCsvImportGroupResult.builder()
                .key(key)
                .isin(key)
                .symbol(symbol)
                .accountId(accountId)
                .rowCount(rowCount)
                .status(status)
                .reason(reason)
                .build();
    }

    private LegacySide parseLegacySide(String action) {
        String normalized = trim(action);
        if (normalized == null) {
            return null;
        }
        String lower = normalized.toLowerCase(Locale.ENGLISH);
        if (lower.endsWith("buy")) {
            return LegacySide.BUY;
        }
        if (lower.endsWith("sell")) {
            return LegacySide.SELL;
        }
        return null;
    }

    private TradovateSide parseTradovateSide(String rawSide) {
        String normalized = trim(rawSide);
        if (normalized == null) {
            return null;
        }
        return switch (normalized.toUpperCase(Locale.ROOT)) {
            case "BUY" -> TradovateSide.BUY;
            case "SELL" -> TradovateSide.SELL;
            default -> null;
        };
    }

    private BigDecimal weightedAverage(List<? extends SharesAndPrice> rows) {
        BigDecimal totalShares = sumShares(rows);
        if (totalShares.compareTo(ZERO_TOLERANCE) <= 0) {
            return null;
        }
        BigDecimal totalNotional = rows.stream()
                .map(row -> row.shares().multiply(row.price()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return totalNotional.divide(totalShares, 10, RoundingMode.HALF_UP);
    }

    private BigDecimal sumShares(List<? extends SharesAndPrice> rows) {
        return rows.stream()
                .map(SharesAndPrice::shares)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private OffsetDateTime parseLocalDateTime(String value, DateTimeFormatter formatter, ZoneId zone) {
        String normalized = trim(value);
        if (normalized == null) {
            return null;
        }
        try {
            return LocalDateTime.parse(normalized, formatter)
                    .atZone(zone)
                    .withZoneSameInstant(ZoneOffset.UTC)
                    .toOffsetDateTime();
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private OffsetDateTime parseIsoDateTime(String value) {
        String normalized = trim(value);
        if (normalized == null) {
            return null;
        }
        return OffsetDateTime.parse(normalized);
    }

    private String requiredText(CSVRecord record, String header) {
        String value = optionalText(record, header);
        if (value == null) {
            throw new IllegalArgumentException("Missing required column '" + header + "'");
        }
        return value;
    }

    private String optionalText(CSVRecord record, String header) {
        if (record == null || header == null || !record.isMapped(header)) {
            return null;
        }
        return trim(record.get(header));
    }

    private static String trim(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            String normalized = trim(value);
            if (normalized != null) {
                return normalized;
            }
        }
        return null;
    }

    @SafeVarargs
    private static <T> T firstNonNull(T... values) {
        if (values == null) {
            return null;
        }
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private static String fallbackLabel(String preferred, String fallback) {
        return preferred != null ? preferred : fallback;
    }

    private static BigDecimal defaultQuantity(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static BigDecimal parseDecimal(String raw) {
        String normalized = trim(raw);
        if (normalized == null) {
            return null;
        }
        normalized = normalized.replace(",", "");
        try {
            return new BigDecimal(normalized);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String safeReason(Exception ex) {
        Throwable current = ex;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        String message = trim(current.getMessage());
        return message != null ? message : current.getClass().getSimpleName();
    }

    private enum CsvImportFormat {
        NATIVE_TRADE_EXPORT,
        LEGACY_ACTIVITY,
        TRADOVATE_ORDERS
    }

    private enum LegacySide {
        BUY,
        SELL
    }

    private enum TradovateSide {
        BUY,
        SELL;

        Direction toDirection() {
            return this == BUY ? Direction.LONG : Direction.SHORT;
        }

        boolean isOpposite(Direction direction) {
            return toDirection() != direction;
        }
    }

    private interface SharesAndPrice {
        BigDecimal shares();

        BigDecimal price();
    }

    private record ParsedCsv(Set<String> headers, List<CSVRecord> records) {}

    private record LegacyActivityRow(String isin,
                                     String ticker,
                                     String transactionId,
                                     LegacySide side,
                                     OffsetDateTime time,
                                     BigDecimal shares,
                                     BigDecimal price,
                                     String currency) implements SharesAndPrice {
        String groupKey() {
            return isin;
        }
    }

    private record LegacyComputation(boolean skipped, String reason, ImportedTradeCandidate candidate) {
        static LegacyComputation skipped(String reason) {
            return new LegacyComputation(true, reason, null);
        }

        static LegacyComputation processed(ImportedTradeCandidate candidate) {
            return new LegacyComputation(false, null, candidate);
        }
    }

    private record TradovateOrderRow(String rowId,
                                     String accountId,
                                     TradovateSide side,
                                     String contract,
                                     String product,
                                     String productDescription,
                                     String status,
                                     String type,
                                     BigDecimal averagePrice,
                                     BigDecimal filledQuantity,
                                     OffsetDateTime eventTime,
                                     BigDecimal limitPrice,
                                     BigDecimal stopPrice,
                                     BigDecimal orderQuantity,
                                     BigDecimal notionalValue,
                                     String currency,
                                     String text,
                                     String orderId,
                                     String versionId) {
        boolean isExecution() {
            return "FILLED".equalsIgnoreCase(status)
                    && executionPrice() != null
                    && executionQuantity() != null
                    && executionQuantity().compareTo(ZERO_TOLERANCE) > 0;
        }

        boolean isAnchorCandidate() {
            return "CANCELED".equalsIgnoreCase(status)
                    && anchorPrice() != null
                    && type != null
                    && ("LIMIT".equalsIgnoreCase(type) || "STOP".equalsIgnoreCase(type));
        }

        BigDecimal executionPrice() {
            return averagePrice;
        }

        BigDecimal executionQuantity() {
            return firstNonNull(filledQuantity, orderQuantity);
        }

        BigDecimal anchorPrice() {
            if ("STOP".equalsIgnoreCase(type)) {
                return stopPrice;
            }
            if ("LIMIT".equalsIgnoreCase(type)) {
                return limitPrice;
            }
            return firstNonNull(limitPrice, stopPrice);
        }

        BigDecimal inferredContractMultiplier() {
            BigDecimal qty = executionQuantity();
            BigDecimal price = executionPrice();
            if (notionalValue == null || qty == null || price == null || qty.compareTo(ZERO_TOLERANCE) <= 0 || price.compareTo(ZERO_TOLERANCE) <= 0) {
                return null;
            }
            return notionalValue.divide(price.multiply(qty), 8, RoundingMode.HALF_UP);
        }

        String groupKey() {
            return accountId + "|" + contract;
        }

        String traceId() {
            return firstNonBlank(rowId, orderId, versionId);
        }
    }

    private record TradovateGroupReconstruction(List<TradovateTradeEnvelope> trades,
                                                List<TradeCsvImportGroupResult> skippedResults) {}

    private record TradovateTradeEnvelope(String key,
                                          ImportedTradeCandidate candidate,
                                          Set<String> rowIds) {}

    private static final class TradovateAccumulator {
        private final String accountId;
        private final String symbol;
        private final String product;
        private final String productDescription;
        private final Direction direction;
        private final String currency;
        private final Set<String> rowIds = new LinkedHashSet<>();
        private final Set<String> entryOrderIds = new LinkedHashSet<>();
        private final Set<String> exitOrderIds = new LinkedHashSet<>();
        private final Set<String> stopAnchorIds = new LinkedHashSet<>();
        private final Set<String> takeProfitAnchorIds = new LinkedHashSet<>();

        private OffsetDateTime openedAt;
        private OffsetDateTime closedAt;
        private BigDecimal lifecycleEntryQuantity = BigDecimal.ZERO;
        private BigDecimal lifecycleEntryNotional = BigDecimal.ZERO;
        private BigDecimal lifecycleExitQuantity = BigDecimal.ZERO;
        private BigDecimal lifecycleExitNotional = BigDecimal.ZERO;
        private BigDecimal openQuantity = BigDecimal.ZERO;
        private BigDecimal openCostNotional = BigDecimal.ZERO;
        private BigDecimal stopLossPrice;
        private BigDecimal takeProfitPrice;
        private BigDecimal contractMultiplier = BigDecimal.ONE;

        private TradovateAccumulator(TradovateOrderRow row, BigDecimal quantity) {
            this.accountId = row.accountId();
            this.symbol = row.contract();
            this.product = row.product();
            this.productDescription = row.productDescription();
            this.direction = row.side().toDirection();
            this.currency = row.currency();
            this.openedAt = row.eventTime();
            BigDecimal inferredMultiplier = row.inferredContractMultiplier();
            if (inferredMultiplier != null && inferredMultiplier.compareTo(ZERO_TOLERANCE) > 0) {
                this.contractMultiplier = inferredMultiplier;
            }
            addEntry(row, quantity);
        }

        static TradovateAccumulator start(TradovateOrderRow row, BigDecimal quantity) {
            return new TradovateAccumulator(row, quantity);
        }

        Direction direction() {
            return direction;
        }

        BigDecimal openQuantity() {
            return openQuantity;
        }

        boolean isFlat() {
            return openQuantity.compareTo(ZERO_TOLERANCE) <= 0;
        }

        void recordExecutionRow(TradovateOrderRow row) {
            addRowId(row.traceId());
            if (row.side().toDirection() == direction) {
                addTrace(entryOrderIds, row.traceId());
            } else {
                addTrace(exitOrderIds, row.traceId());
            }
        }

        void addEntry(TradovateOrderRow row, BigDecimal quantity) {
            BigDecimal price = row.executionPrice();
            lifecycleEntryQuantity = lifecycleEntryQuantity.add(quantity);
            lifecycleEntryNotional = lifecycleEntryNotional.add(price.multiply(quantity));
            openQuantity = openQuantity.add(quantity);
            openCostNotional = openCostNotional.add(price.multiply(quantity));
            BigDecimal inferredMultiplier = row.inferredContractMultiplier();
            if (inferredMultiplier != null && inferredMultiplier.compareTo(ZERO_TOLERANCE) > 0) {
                contractMultiplier = inferredMultiplier;
            }
        }

        void addExit(TradovateOrderRow row, BigDecimal quantity) {
            BigDecimal price = row.executionPrice();
            lifecycleExitQuantity = lifecycleExitQuantity.add(quantity);
            lifecycleExitNotional = lifecycleExitNotional.add(price.multiply(quantity));
            BigDecimal averageOpenPrice = openCostNotional.divide(openQuantity, 10, RoundingMode.HALF_UP);
            openCostNotional = openCostNotional.subtract(averageOpenPrice.multiply(quantity));
            openQuantity = openQuantity.subtract(quantity);
            if (openQuantity.compareTo(ZERO_TOLERANCE) <= 0) {
                openQuantity = BigDecimal.ZERO;
                openCostNotional = BigDecimal.ZERO;
                closedAt = row.eventTime();
            }
        }

        void recordAnchor(TradovateOrderRow row) {
            addRowId(row.traceId());
            if ("STOP".equalsIgnoreCase(row.type())) {
                stopLossPrice = row.anchorPrice();
                addTrace(stopAnchorIds, row.traceId());
                return;
            }
            if ("LIMIT".equalsIgnoreCase(row.type())) {
                takeProfitPrice = row.anchorPrice();
                addTrace(takeProfitAnchorIds, row.traceId());
            }
        }

        TradovateTradeEnvelope toEnvelope() {
            TradeStatus status = isFlat() ? TradeStatus.CLOSED : TradeStatus.OPEN;
            BigDecimal quantity = status == TradeStatus.CLOSED ? lifecycleEntryQuantity : openQuantity;
            BigDecimal entryPrice = status == TradeStatus.CLOSED
                    ? lifecycleEntryNotional.divide(lifecycleEntryQuantity, 10, RoundingMode.HALF_UP)
                    : openCostNotional.divide(openQuantity, 10, RoundingMode.HALF_UP);
            BigDecimal exitPrice = status == TradeStatus.CLOSED && lifecycleExitQuantity.compareTo(ZERO_TOLERANCE) > 0
                    ? lifecycleExitNotional.divide(lifecycleExitQuantity, 10, RoundingMode.HALF_UP)
                    : null;

            ImportedTradeCandidate candidate = ImportedTradeCandidate.builder()
                    .source(com.tradevault.domain.enums.TradeSource.TRADOVATE)
                    .symbol(symbol)
                    .market(Market.FUTURES)
                    .direction(direction)
                    .status(status)
                    .openedAt(openedAt)
                    .closedAt(status == TradeStatus.CLOSED ? closedAt : null)
                    .quantity(quantity)
                    .entryPrice(entryPrice)
                    .exitPrice(exitPrice)
                    .stopLossPrice(stopLossPrice)
                    .takeProfitPrice(takeProfitPrice)
                    .tradeCurrency(currency)
                    .profileCurrency(currency)
                    .accountId(accountId)
                    .contractMultiplier(contractMultiplier)
                    .initialNotes(buildImportNotes(status))
                    .build();

            return new TradovateTradeEnvelope(buildTradeKey(candidate), candidate, rowIds);
        }

        private String buildImportNotes(TradeStatus status) {
            StringBuilder builder = new StringBuilder("Imported from Tradovate Orders CSV");
            builder.append(" | account=").append(accountId);
            builder.append(" | contract=").append(symbol);
            if (product != null) {
                builder.append(" | product=").append(product);
            }
            if (productDescription != null) {
                builder.append(" | description=").append(productDescription);
            }
            builder.append(" | status=").append(status);
            if (!entryOrderIds.isEmpty()) {
                builder.append(" | entryOrders=").append(String.join(";", entryOrderIds));
            }
            if (!exitOrderIds.isEmpty()) {
                builder.append(" | exitOrders=").append(String.join(";", exitOrderIds));
            }
            if (!takeProfitAnchorIds.isEmpty()) {
                builder.append(" | tpCanceled=").append(String.join(";", takeProfitAnchorIds));
            }
            if (!stopAnchorIds.isEmpty()) {
                builder.append(" | slCanceled=").append(String.join(";", stopAnchorIds));
            }
            return builder.toString();
        }

        private void addTrace(Set<String> target, String traceId) {
            if (traceId != null) {
                target.add(traceId);
            }
        }

        private void addRowId(String traceId) {
            if (traceId != null) {
                rowIds.add(traceId);
            }
        }
    }

    private static String buildTradeKey(ImportedTradeCandidate candidate) {
        return "%s|%s|%s|%s".formatted(
                fallbackLabel(candidate.getAccountId(), "no-account"),
                candidate.getSymbol(),
                candidate.getDirection(),
                candidate.getOpenedAt()
        );
    }
}
