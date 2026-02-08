package com.tradevault.service;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.TradeImportRow;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.trade.TradeCsvImportGroupResult;
import com.tradevault.dto.trade.TradeCsvImportSummary;
import com.tradevault.repository.TradeImportRowRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.security.AuthenticatedUserResolver;
import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
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
import java.util.LinkedHashMap;
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
    private static final Logger log = LoggerFactory.getLogger(TradeCsvImportService.class);
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss", Locale.ENGLISH);
    private static final ZoneId SOURCE_ZONE = ZoneId.of("Europe/Bucharest");
    private static final List<String> REQUIRED_HEADERS = List.of(
            "Action",
            "Time",
            "ISIN",
            "Ticker",
            "Name",
            "ID",
            "No. of shares",
            "Price / share",
            "Currency (Price / share)",
            "Exchange rate",
            "Result",
            "Currency (Result)",
            "Total",
            "Currency (Total)"
    );
    private static final BigDecimal SHARE_TOLERANCE = new BigDecimal("0.0001");

    private final TradeRepository tradeRepository;
    private final TradeImportRowRepository tradeImportRowRepository;
    private final AuthenticatedUserResolver authenticatedUserResolver;

    public TradeCsvImportSummary importCsv(MultipartFile file) throws IOException {
        User user = authenticatedUserResolver.getCurrentUser();
        List<ParsedRow> parsedRows = new ArrayList<>();
        int totalRows = 0;
        Set<String> seenTransactionIds = new java.util.HashSet<>();

        CSVFormat csvFormat = CSVFormat.DEFAULT.builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreEmptyLines(true)
                .build();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));
             CSVParser parser = new CSVParser(reader, csvFormat)) {
            validateHeaders(parser);
            for (CSVRecord record : parser) {
                totalRows++;
                ParsedRow row = parseRecord(record);
                if (row == null) {
                    continue;
                }
                if (row.transactionId() != null) {
                    if (!seenTransactionIds.add(row.transactionId())) {
                        continue;
                    }
                }
                parsedRows.add(row);
            }
        }

        parsedRows.sort((a, b) -> a.time().compareTo(b.time()));
        Set<String> existingTransactionIds = loadExistingTransactionIds(user, parsedRows);
        Map<String, List<ParsedRow>> grouped = groupByIsin(parsedRows);

        int tradesCreated = 0;
        int tradesUpdated = 0;
        int groupsSkipped = 0;
        List<TradeCsvImportGroupResult> groupResults = new ArrayList<>();

        for (Map.Entry<String, List<ParsedRow>> entry : grouped.entrySet()) {
            String isin = entry.getKey();
            List<ParsedRow> rows = entry.getValue();
            GroupComputation computation = computeGroup(rows);
            if (computation.skipped()) {
                groupsSkipped++;
                groupResults.add(TradeCsvImportGroupResult.builder()
                        .isin(isin)
                        .status("SKIPPED")
                        .reason(computation.reason())
                        .build());
                continue;
            }
            GroupMetrics metrics = computation.metrics();
            UpsertResult upsert = upsertTrade(user, metrics);
            tradeRepository.save(upsert.trade());
            saveImportRows(user, rows, existingTransactionIds);
            if (upsert.updated()) {
                tradesUpdated++;
                groupResults.add(TradeCsvImportGroupResult.builder()
                        .isin(isin)
                        .status("UPDATED")
                        .build());
            } else {
                tradesCreated++;
                groupResults.add(TradeCsvImportGroupResult.builder()
                        .isin(isin)
                        .status("CREATED")
                        .build());
            }
        }

        return TradeCsvImportSummary.builder()
                .totalRows(totalRows)
                .isinGroups(grouped.size())
                .tradesCreated(tradesCreated)
                .tradesUpdated(tradesUpdated)
                .groupsSkipped(groupsSkipped)
                .groupResults(groupResults)
                .build();
    }

    static GroupComputation computeGroup(List<ParsedRow> rows) {
        List<ParsedRow> buys = rows.stream().filter(ParsedRow::isBuy).toList();
        List<ParsedRow> sells = rows.stream().filter(ParsedRow::isSell).toList();

        BigDecimal totalBuyShares = sumShares(buys);
        BigDecimal totalSellShares = sumShares(sells);
        Set<String> actionValues = rows.stream()
                .map(ParsedRow::actionNorm)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        log.info("CSV import ISIN={} buyRows={} sellRows={} buyShares={} sellShares={} actions={}",
                rows.get(0).isin(),
                buys.size(),
                sells.size(),
                totalBuyShares,
                totalSellShares,
                actionValues);

        if (buys.isEmpty() && totalSellShares.compareTo(SHARE_TOLERANCE) > 0) {
            return GroupComputation.skipped("Sell without buy");
        }
        if (totalBuyShares.compareTo(SHARE_TOLERANCE) <= 0) {
            return GroupComputation.skipped("Buy shares missing");
        }
        if (totalSellShares.subtract(totalBuyShares).compareTo(SHARE_TOLERANCE) > 0) {
            return GroupComputation.skipped("Sell shares exceed buy shares");
        }

        OffsetDateTime openedAt = buys.get(0).time();
        String symbol = rows.stream()
                .map(ParsedRow::ticker)
                .filter(value -> value != null && !value.isBlank())
                .findFirst()
                .orElse(null);
        BigDecimal entryPrice = weightedAverage(buys);

        OffsetDateTime closedAt = null;
        BigDecimal exitPrice = null;
        BigDecimal pnlGross = null;
        BigDecimal pnlNet = null;
        TradeStatus status = TradeStatus.OPEN;

        if (totalSellShares.compareTo(SHARE_TOLERANCE) > 0) {
            exitPrice = weightedAverage(sells);
            BigDecimal priceDiff = exitPrice.subtract(entryPrice);
            pnlGross = priceDiff.multiply(totalBuyShares);
            pnlNet = pnlGross;
        }

        if (totalSellShares.compareTo(SHARE_TOLERANCE) <= 0) {
            status = TradeStatus.OPEN;
        } else if (withinTolerance(totalSellShares, totalBuyShares)) {
            closedAt = sells.get(sells.size() - 1).time();
            status = TradeStatus.CLOSED;
        } else {
            status = TradeStatus.OPEN;
        }
        OffsetDateTime updatedAt = status == TradeStatus.CLOSED && closedAt != null
                ? closedAt
                : rows.get(rows.size() - 1).time();

        GroupMetrics metrics = new GroupMetrics(
                symbol,
                openedAt,
                closedAt,
                totalBuyShares,
                entryPrice,
                exitPrice,
                pnlGross,
                pnlNet,
                status,
                updatedAt
        );
        return GroupComputation.processed(metrics);
    }

    static BigDecimal weightedAverage(List<ParsedRow> rows) {
        BigDecimal totalShares = sumShares(rows);
        if (totalShares.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal total = BigDecimal.ZERO;
        for (ParsedRow row : rows) {
            total = total.add(row.price().multiply(row.shares()));
        }
        return total.divide(totalShares, 10, RoundingMode.HALF_UP);
    }

    private UpsertResult upsertTrade(User user, GroupMetrics metrics) {
        UUID userId = user.getId();
        Optional<Trade> existing = Optional.empty();
        if (metrics.symbol() != null) {
            existing = tradeRepository.findByUserIdAndSymbolAndOpenedAt(userId, metrics.symbol(), metrics.openedAt());
        }
        Trade trade = existing.orElseGet(Trade::new);
        trade.setUser(user);
        trade.setSymbol(metrics.symbol());
        trade.setMarket(Market.STOCK);
        trade.setDirection(Direction.LONG);
        trade.setStatus(metrics.status());
        trade.setOpenedAt(metrics.openedAt());
        trade.setClosedAt(metrics.closedAt());
        trade.setQuantity(metrics.quantity());
        trade.setEntryPrice(metrics.entryPrice());
        trade.setExitPrice(metrics.exitPrice());
        trade.setPnlGross(metrics.pnlGross());
        trade.setPnlNet(metrics.pnlNet());
        trade.setCreatedAt(metrics.openedAt());
        trade.setUpdatedAt(metrics.updatedAt());
        return new UpsertResult(trade, existing.isPresent());
    }

    private void saveImportRows(User user, List<ParsedRow> rows, Set<String> existingTransactionIds) {
        List<TradeImportRow> importRows = rows.stream()
                .map(ParsedRow::transactionId)
                .filter(Objects::nonNull)
                .distinct()
                .filter(txId -> !existingTransactionIds.contains(txId))
                .map(txId -> TradeImportRow.builder()
                        .user(user)
                        .transactionId(txId)
                        .importedAt(OffsetDateTime.now(ZoneOffset.UTC))
                        .build())
                .toList();
        if (!importRows.isEmpty()) {
            tradeImportRowRepository.saveAll(importRows);
            importRows.stream()
                    .map(TradeImportRow::getTransactionId)
                    .forEach(existingTransactionIds::add);
        }
    }

    private Set<String> loadExistingTransactionIds(User user, List<ParsedRow> rows) {
        Set<String> transactionIds = rows.stream()
                .map(ParsedRow::transactionId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (transactionIds.isEmpty()) {
            return new java.util.HashSet<>();
        }
        return tradeImportRowRepository.findAllByUserIdAndTransactionIdIn(user.getId(), transactionIds).stream()
                .map(TradeImportRow::getTransactionId)
                .collect(Collectors.toCollection(java.util.HashSet::new));
    }

    private Map<String, List<ParsedRow>> groupByIsin(List<ParsedRow> rows) {
        Map<String, List<ParsedRow>> grouped = new LinkedHashMap<>();
        for (ParsedRow row : rows) {
            grouped.computeIfAbsent(row.isin(), key -> new ArrayList<>()).add(row);
        }
        return grouped;
    }

    private void validateHeaders(CSVParser parser) {
        Map<String, Integer> headers = parser.getHeaderMap();
        if (headers == null || headers.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV headers are missing");
        }
        if (!headers.keySet().containsAll(REQUIRED_HEADERS)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV headers do not match the expected format");
        }
    }

    private ParsedRow parseRecord(CSVRecord record) {
        String action = trim(record.get("Action"));
        String time = trim(record.get("Time"));
        String isin = trim(record.get("ISIN"));
        String ticker = trim(record.get("Ticker"));
        String transactionId = trim(record.get("ID"));
        String sharesRaw = trim(record.get("No. of shares"));
        String priceRaw = trim(record.get("Price / share"));
        String resultRaw = trim(record.get("Result"));

        if (action == null || time == null || isin == null || ticker == null || sharesRaw == null || priceRaw == null) {
            return null;
        }
        ActionClassification classification = classifyAction(action);
        if (!classification.isBuy() && !classification.isSell()) {
            return null;
        }
        OffsetDateTime parsedTime;
        try {
            LocalDateTime localTime = LocalDateTime.parse(time, TIME_FORMATTER);
            parsedTime = localTime.atZone(SOURCE_ZONE).withZoneSameInstant(ZoneOffset.UTC).toOffsetDateTime();
        } catch (DateTimeParseException ex) {
            return null;
        }
        BigDecimal shares = parseDecimal(sharesRaw);
        BigDecimal price = parseDecimal(priceRaw);
        if (shares == null || price == null) {
            return null;
        }
        BigDecimal result = resultRaw == null ? null : parseDecimal(resultRaw);

        return new ParsedRow(action, classification.actionNorm(), classification.isBuy(), classification.isSell(), parsedTime, isin, ticker, transactionId, shares, price, result);
    }

    private static BigDecimal sumShares(List<ParsedRow> rows) {
        BigDecimal total = BigDecimal.ZERO;
        for (ParsedRow row : rows) {
            total = total.add(row.shares());
        }
        return total;
    }

    private static BigDecimal sumResults(List<ParsedRow> rows) {
        BigDecimal total = BigDecimal.ZERO;
        for (ParsedRow row : rows) {
            if (row.result() != null) {
                total = total.add(row.result());
            }
        }
        return total;
    }

    private static BigDecimal parseDecimal(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return new BigDecimal(value.trim());
    }

    private static String trim(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private static boolean withinTolerance(BigDecimal left, BigDecimal right) {
        return left.subtract(right).abs().compareTo(SHARE_TOLERANCE) <= 0;
    }

    static ActionClassification classifyAction(String action) {
        if (action == null || action.isBlank()) {
            return new ActionClassification(null, false, false);
        }
        String actionNorm = action.trim().toLowerCase(Locale.ENGLISH);
        boolean isBuy = actionNorm.endsWith("buy");
        boolean isSell = actionNorm.endsWith("sell");
        return new ActionClassification(actionNorm, isBuy, isSell);
    }

    record ActionClassification(String actionNorm, boolean isBuy, boolean isSell) {}

    record ParsedRow(
            String action,
            String actionNorm,
            boolean isBuy,
            boolean isSell,
            OffsetDateTime time,
            String isin,
            String ticker,
            String transactionId,
            BigDecimal shares,
            BigDecimal price,
            BigDecimal result
    ) {}

    record GroupMetrics(
            String symbol,
            OffsetDateTime openedAt,
            OffsetDateTime closedAt,
            BigDecimal quantity,
            BigDecimal entryPrice,
            BigDecimal exitPrice,
            BigDecimal pnlGross,
            BigDecimal pnlNet,
            TradeStatus status,
            OffsetDateTime updatedAt
    ) {}

    record GroupComputation(boolean skipped, String reason, GroupMetrics metrics) {
        static GroupComputation skipped(String reason) {
            return new GroupComputation(true, reason, null);
        }

        static GroupComputation processed(GroupMetrics metrics) {
            return new GroupComputation(false, null, metrics);
        }
    }

    record UpsertResult(Trade trade, boolean updated) {}
}
