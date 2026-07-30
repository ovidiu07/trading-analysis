package com.tradevault.service.trading212;

import com.tradevault.domain.enums.Direction;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.*;

@Component
public class Trading212CsvParser {
    public static final String PARSER_VERSION = "trading212-csv-v2";
    public static final int HEADER_COUNT = 22;

    private static final String RECORD_TYPE = "record type";
    private static final String CLOSED_POSITION = "closed position";
    private static final Set<String> KNOWN_HEADERS = Set.of(
            RECORD_TYPE, "date (utc)", "account currency", "instrument", "symbol", "instrument currency",
            "direction", "units", "position id", "order id", "date opened (utc)", "date closed (utc)",
            "average price (instrument currency)", "close price (instrument currency)", "exchange rate",
            "spread (account currency)", "result (account currency)", "fx fee (account currency)",
            "result after fx fee (account currency)", "overnight interest (account currency)",
            "dividend adjustment (account currency)", "total result (account currency)");
    private static final Set<String> REQUIRED_CLOSED_HEADERS = Set.of(
            RECORD_TYPE, "account currency", "instrument", "symbol", "instrument currency", "direction",
            "units", "position id", "date opened (utc)", "date closed (utc)",
            "average price (instrument currency)", "close price (instrument currency)",
            "result (account currency)", "total result (account currency)");

    private final Trading212PnlReconciler pnlReconciler;

    public Trading212CsvParser(Trading212PnlReconciler pnlReconciler) {
        this.pnlReconciler = pnlReconciler;
    }

    public Trading212ParsedReport parse(byte[] bytes, int maximumRows) {
        if (bytes == null || bytes.length == 0) {
            throw invalid("The Trading 212 CSV is empty");
        }
        byte[] content = stripUtf8Bom(bytes);
        List<CSVRecord> records;
        try (Reader reader = new InputStreamReader(new ByteArrayInputStream(content), StandardCharsets.UTF_8);
             CSVParser parser = CSVFormat.DEFAULT.builder()
                     .setIgnoreEmptyLines(true)
                     .setIgnoreSurroundingSpaces(false)
                     .build()
                     .parse(reader)) {
            records = parser.getRecords();
        } catch (IOException | IllegalArgumentException ex) {
            throw invalid("The Trading 212 CSV is malformed: " + ex.getMessage());
        }
        if (records.isEmpty()) throw invalid("The Trading 212 CSV has no header row");

        CSVRecord headerRecord = records.get(0);
        List<String> originalHeaders = new ArrayList<>();
        Map<String, Integer> indexes = new LinkedHashMap<>();
        for (int i = 0; i < headerRecord.size(); i++) {
            String original = clean(headerRecord.get(i));
            String normalized = normalizeHeader(original);
            if (normalized.isBlank()) throw invalid("The Trading 212 CSV contains an empty header");
            if (indexes.putIfAbsent(normalized, i) != null) {
                throw invalid("The Trading 212 CSV contains a duplicate header: " + original);
            }
            originalHeaders.add(original);
        }
        if (!indexes.containsKey(RECORD_TYPE)) {
            throw invalid("Missing required Trading 212 header: Record Type");
        }

        int dataRows = records.size() - 1;
        if (dataRows > maximumRows) {
            throw invalid("The Trading 212 CSV exceeds the " + maximumRows + " row limit");
        }
        List<String> unknownHeaders = indexes.keySet().stream().filter(header -> !KNOWN_HEADERS.contains(header)).toList();
        List<Trading212ClosedPosition> positions = new ArrayList<>();
        List<Trading212ParsedReport.SourceRow> sourceRows = new ArrayList<>();
        List<String> reportWarnings = new ArrayList<>();
        Set<String> currencies = new LinkedHashSet<>();
        Set<String> orderIds = new HashSet<>();
        OffsetDateTime earliest = null;
        OffsetDateTime latest = null;

        boolean containsClosedPositions = records.stream().skip(1)
                .anyMatch(record -> CLOSED_POSITION.equalsIgnoreCase(value(record, indexes, RECORD_TYPE)));
        if (containsClosedPositions) {
            List<String> missing = REQUIRED_CLOSED_HEADERS.stream()
                    .filter(header -> !indexes.containsKey(header))
                    .sorted()
                    .toList();
            if (!missing.isEmpty()) {
                throw invalid("Missing required Trading 212 headers for closed positions: " + String.join(", ", missing));
            }
        }

        for (int recordIndex = 1; recordIndex < records.size(); recordIndex++) {
            CSVRecord csv = records.get(recordIndex);
            long rowNumber = recordIndex + 1L;
            Map<String, String> raw = rawRow(csv, originalHeaders);
            if (csv.size() > originalHeaders.size()) {
                String recordType = value(csv, indexes, RECORD_TYPE);
                String error = "Row " + rowNumber + " has more values than the header";
                sourceRows.add(new Trading212ParsedReport.SourceRow(
                        rowNumber, recordType, CLOSED_POSITION.equalsIgnoreCase(recordType), false,
                        value(csv, indexes, "position id"), value(csv, indexes, "order id"),
                        raw, List.of(), List.of(error)));
                reportWarnings.add(error);
                continue;
            }
            String recordType = value(csv, indexes, RECORD_TYPE);
            boolean supported = CLOSED_POSITION.equalsIgnoreCase(recordType);
            if (!supported) {
                List<String> warnings = List.of("Unsupported Trading 212 record type: "
                        + (recordType.isBlank() ? "(empty)" : recordType));
                sourceRows.add(new Trading212ParsedReport.SourceRow(rowNumber, recordType, false, false,
                        value(csv, indexes, "position id"), value(csv, indexes, "order id"),
                        raw, warnings, List.of()));
                reportWarnings.add("Row " + rowNumber + ": " + warnings.get(0));
                continue;
            }

            try {
                Trading212ClosedPosition position = parseClosedPosition(csv, indexes, raw, rowNumber, recordType);
                if (position.orderId() != null && !orderIds.add(position.orderId())) {
                    String error = "Duplicate Trading 212 Order ID inside the uploaded file: " + position.orderId();
                    sourceRows.add(new Trading212ParsedReport.SourceRow(rowNumber, recordType, true, false,
                            position.positionId(), position.orderId(), raw, position.warnings(), List.of(error)));
                    reportWarnings.add("Row " + rowNumber + ": " + error);
                    continue;
                }
                positions.add(position);
                currencies.add(position.accountCurrency());
                earliest = min(earliest, position.openedAt());
                latest = max(latest, position.closedAt());
                sourceRows.add(new Trading212ParsedReport.SourceRow(rowNumber, recordType, true, true,
                        position.positionId(), position.orderId(), raw, position.warnings(), List.of()));
            } catch (ResponseStatusException ex) {
                String error = ex.getReason() == null ? "Invalid Trading 212 row" : ex.getReason();
                sourceRows.add(new Trading212ParsedReport.SourceRow(rowNumber, recordType, true, false,
                        value(csv, indexes, "position id"), value(csv, indexes, "order id"),
                        raw, List.of(), List.of(error)));
                reportWarnings.add(error);
            }
        }
        if (currencies.size() > 1) {
            reportWarnings.add("The CSV contains multiple Trading 212 account currencies: " + String.join(", ", currencies));
        }
        if (!unknownHeaders.isEmpty()) {
            reportWarnings.add("Unknown Trading 212 columns were preserved: " + String.join(", ", unknownHeaders));
        }
        return new Trading212ParsedReport(List.copyOf(originalHeaders), List.copyOf(positions), List.copyOf(sourceRows),
                unknownHeaders, List.copyOf(reportWarnings),
                currencies.isEmpty() ? null : currencies.iterator().next(), earliest, latest);
    }

    private Trading212ClosedPosition parseClosedPosition(CSVRecord row, Map<String, Integer> indexes,
                                                          Map<String, String> raw, long rowNumber, String recordType) {
        String accountCurrency = required(row, indexes, "account currency", rowNumber).toUpperCase(Locale.ROOT);
        String instrument = required(row, indexes, "instrument", rowNumber);
        String symbol = required(row, indexes, "symbol", rowNumber);
        String instrumentCurrency = required(row, indexes, "instrument currency", rowNumber).toUpperCase(Locale.ROOT);
        Direction direction = parseDirection(required(row, indexes, "direction", rowNumber), rowNumber);
        BigDecimal units = positiveDecimal(row, indexes, "units", rowNumber);
        String positionId = required(row, indexes, "position id", rowNumber);
        String orderId = optional(row, indexes, "order id");
        OffsetDateTime openedAt = timestamp(row, indexes, "date opened (utc)", rowNumber, true);
        OffsetDateTime closedAt = timestamp(row, indexes, "date closed (utc)", rowNumber, true);
        if (closedAt.isBefore(openedAt)) throw invalid("Row " + rowNumber + ": Date closed is before Date opened");
        BigDecimal entry = decimal(row, indexes, "average price (instrument currency)", rowNumber, true);
        BigDecimal exit = decimal(row, indexes, "close price (instrument currency)", rowNumber, true);
        if (entry.signum() <= 0 || exit.signum() <= 0) throw invalid("Row " + rowNumber + ": prices must be greater than zero");
        BigDecimal result = decimal(row, indexes, "result (account currency)", rowNumber, true);
        BigDecimal total = decimal(row, indexes, "total result (account currency)", rowNumber, true);
        BigDecimal exchangeRate = decimal(row, indexes, "exchange rate", rowNumber, false);
        BigDecimal spread = decimal(row, indexes, "spread (account currency)", rowNumber, false);
        BigDecimal fxFee = decimal(row, indexes, "fx fee (account currency)", rowNumber, false);
        BigDecimal resultAfterFxFee = decimal(row, indexes, "result after fx fee (account currency)", rowNumber, false);
        if (resultAfterFxFee == null) resultAfterFxFee = result;
        BigDecimal overnight = decimal(row, indexes, "overnight interest (account currency)", rowNumber, false);
        BigDecimal dividend = decimal(row, indexes, "dividend adjustment (account currency)", rowNumber, false);
        OffsetDateTime recordDate = timestamp(row, indexes, "date (utc)", rowNumber, false);
        var reconciliation = pnlReconciler.reconcile(direction, units, entry, exit, exchangeRate, result,
                resultAfterFxFee, fxFee, overnight, dividend, total);
        List<String> warnings = new ArrayList<>(reconciliation.warnings());
        if (orderId == null) warnings.add("Trading 212 Order ID is missing");
        if (recordDate != null && !recordDate.toInstant().equals(closedAt.toInstant())) {
            warnings.add("Trading 212 record date differs from Date closed");
        }
        warnings.add("No stop-loss or take-profit was supplied; risk and R multiple remain unavailable");
        return new Trading212ClosedPosition(rowNumber, recordType, recordDate, accountCurrency, instrument, symbol,
                instrumentCurrency, direction, units, positionId, orderId, openedAt, closedAt, entry, exit,
                exchangeRate, spread, result, fxFee, resultAfterFxFee, overnight, dividend, total,
                reconciliation.priceDerivedPnl(), reconciliation.pricePnlDifference(),
                reconciliation.totalReconciliationDifference(), raw, List.copyOf(warnings));
    }

    private static Map<String, String> rawRow(CSVRecord row, List<String> headers) {
        Map<String, String> raw = new LinkedHashMap<>();
        for (int i = 0; i < headers.size(); i++) raw.put(headers.get(i), i < row.size() ? clean(row.get(i)) : "");
        return Collections.unmodifiableMap(raw);
    }

    private static String required(CSVRecord row, Map<String, Integer> indexes, String header, long rowNumber) {
        String value = value(row, indexes, header);
        if (value.isBlank()) throw invalid("Row " + rowNumber + ": " + header + " is required");
        return value;
    }

    private static String optional(CSVRecord row, Map<String, Integer> indexes, String header) {
        String value = value(row, indexes, header);
        return value.isBlank() ? null : value;
    }

    private static String value(CSVRecord row, Map<String, Integer> indexes, String header) {
        Integer index = indexes.get(header);
        return index == null || index >= row.size() ? "" : clean(row.get(index));
    }

    private static BigDecimal positiveDecimal(CSVRecord row, Map<String, Integer> indexes, String header, long rowNumber) {
        BigDecimal value = decimal(row, indexes, header, rowNumber, true);
        if (value.signum() <= 0) throw invalid("Row " + rowNumber + ": " + header + " must be greater than zero");
        return value;
    }

    private static BigDecimal decimal(CSVRecord row, Map<String, Integer> indexes, String header,
                                      long rowNumber, boolean required) {
        String value = value(row, indexes, header);
        if (value.isBlank()) {
            if (required) throw invalid("Row " + rowNumber + ": " + header + " is required");
            return null;
        }
        try {
            return new BigDecimal(value.replace("\u00A0", "").replace(" ", ""));
        } catch (NumberFormatException ex) {
            throw invalid("Row " + rowNumber + ": invalid decimal in " + header);
        }
    }

    private static OffsetDateTime timestamp(CSVRecord row, Map<String, Integer> indexes, String header,
                                            long rowNumber, boolean required) {
        String value = value(row, indexes, header);
        if (value.isBlank()) {
            if (required) throw invalid("Row " + rowNumber + ": " + header + " is required");
            return null;
        }
        try {
            return OffsetDateTime.parse(value.replace(' ', 'T'));
        } catch (DateTimeParseException ex) {
            throw invalid("Row " + rowNumber + ": invalid offset timestamp in " + header);
        }
    }

    private static Direction parseDirection(String value, long rowNumber) {
        if ("buy".equalsIgnoreCase(value)) return Direction.LONG;
        if ("sell".equalsIgnoreCase(value)) return Direction.SHORT;
        throw invalid("Row " + rowNumber + ": unsupported Trading 212 direction " + value);
    }

    private static byte[] stripUtf8Bom(byte[] bytes) {
        if (bytes.length >= 3 && bytes[0] == (byte) 0xEF && bytes[1] == (byte) 0xBB && bytes[2] == (byte) 0xBF) {
            return Arrays.copyOfRange(bytes, 3, bytes.length);
        }
        return bytes;
    }

    private static String normalizeHeader(String value) {
        return clean(value).toLowerCase(Locale.ROOT);
    }

    private static String clean(String value) {
        return value == null ? "" : value.replace('\u00A0', ' ').trim();
    }

    private static OffsetDateTime min(OffsetDateTime a, OffsetDateTime b) {
        return a == null || b.isBefore(a) ? b : a;
    }

    private static OffsetDateTime max(OffsetDateTime a, OffsetDateTime b) {
        return a == null || b.isAfter(a) ? b : a;
    }

    private static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
