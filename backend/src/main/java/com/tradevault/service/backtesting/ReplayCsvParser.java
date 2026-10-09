package com.tradevault.service.backtesting;

import com.tradevault.domain.entity.BacktestingTrade;
import com.tradevault.domain.enums.BacktestingTradeDirection;
import com.tradevault.domain.enums.BacktestingTradeResult;
import com.tradevault.domain.enums.BacktestingTradeScope;
import com.tradevault.domain.enums.BacktestingTradeSource;
import org.apache.commons.csv.CSVRecord;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;

/** TradingView replay exports repeat trade-level monetary values on both execution rows. */
public final class ReplayCsvParser {
    public static final String FORMAT = "TRADINGVIEW_REPLAY";
    private static final Pattern PNL_HEADER = Pattern.compile("(?i)Net P(?:nL|&L) ([A-Z]{3})");
    private static final Pattern FILE_SYMBOL = Pattern.compile("(?i)^Replay_Trading_(.+)_\\d{4}-\\d{2}-\\d{2}_to_.*\\.csv$");
    private ReplayCsvParser() {}

    public record Result(List<BacktestingTrade> trades, List<String> errors, int duplicates) {}
    private record Event(CSVRecord row, String number, LocalDateTime at, boolean entry,
                         BacktestingTradeDirection direction, BigDecimal price, BigDecimal quantity) {}

    public static boolean supports(List<String> headers) {
        return headers.contains("Type") && headers.contains("Date and time")
                && (headers.contains("Trade number") || headers.contains("Trade #"));
    }

    public static String symbolFromFilename(String name) {
        var matcher = FILE_SYMBOL.matcher(Objects.toString(name, ""));
        if (!matcher.matches()) return null;
        return matcher.group(1).replaceFirst("_", ":").toUpperCase(Locale.ROOT);
    }

    public static Result parse(List<CSVRecord> rows, List<String> headers, String instrument,
                               String timezone, String filename) {
        if (instrument == null || instrument.isBlank() || instrument.length() > 64)
            throw new IllegalArgumentException("Replay instrument is required (maximum 64 characters)");
        if (filename != null && filename.length() > 255) throw new IllegalArgumentException("CSV filename exceeds 255 characters");
        if (timezone != null && !timezone.isBlank()) ZoneId.of(timezone);
        String pnlHeader = headers.stream().filter(h -> PNL_HEADER.matcher(h).matches()).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Replay CSV requires a Net PnL currency column"));
        var currencyMatcher = PNL_HEADER.matcher(pnlHeader);
        currencyMatcher.matches();
        String currency = currencyMatcher.group(1).toUpperCase(Locale.ROOT);
        Currency.getInstance(currency);
        for (String required : List.of("Price " + currency, "Size (qty)", "Signal")) {
            if (!headers.contains(required)) throw new IllegalArgumentException("Missing replay column: " + required);
        }
        List<String> errors = new ArrayList<>();
        Map<String, List<Event>> groups = new LinkedHashMap<>();
        Set<Map<String, String>> seenRows = new HashSet<>();
        int duplicates = 0;
        for (CSVRecord row : rows) {
            try {
                if (!row.isConsistent()) throw new IllegalArgumentException("column count does not match header");
                String type = required(row, "Type").toLowerCase(Locale.ROOT);
                if (!List.of("entry long", "entry short", "exit long", "exit short").contains(type))
                    throw new IllegalArgumentException("unsupported execution type: " + type);
                if (!seenRows.add(row.toMap())) {
                    if (type.startsWith("entry")) duplicates++;
                    continue;
                }
                Event event = new Event(row, required(row, headers.contains("Trade number") ? "Trade number" : "Trade #"),
                        LocalDateTime.parse(required(row, "Date and time").replace(' ', 'T'), DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                        type.startsWith("entry"), type.endsWith("long") ? BacktestingTradeDirection.LONG : BacktestingTradeDirection.SHORT,
                        positive(row, "Price " + currency), positive(row, "Size (qty)"));
                groups.computeIfAbsent(event.number(), ignored -> new ArrayList<>()).add(event);
            } catch (RuntimeException ex) { errors.add(error(row, ex.getMessage())); }
        }
        List<BacktestingTrade> trades = new ArrayList<>();
        for (List<Event> events : groups.values()) {
            events.sort(Comparator.comparing(Event::at).thenComparing(e -> !e.entry()));
            List<Event> pending = new ArrayList<>();
            for (Event event : events) {
                if (event.entry()) { pending.add(event); continue; }
                if (pending.size() != 1) {
                    errors.add(error(event.row(), pending.isEmpty() ? "exit has no matching entry" : "ambiguous repeated trade number; overlapping entries"));
                    pending.clear();
                    continue;
                }
                Event entry = pending.remove(0);
                try { trades.add(pair(entry, event, currency, pnlHeader, instrument.trim().toUpperCase(Locale.ROOT), timezone, filename)); }
                catch (RuntimeException ex) { errors.add(error(event.row(), ex.getMessage())); }
            }
            for (Event entry : pending) errors.add(error(entry.row(), "entry has no matching exit; open trades are not imported"));
        }
        trades.sort(Comparator.comparing(BacktestingTrade::getDate).thenComparing(BacktestingTrade::getEntryTime));
        return new Result(trades, errors, duplicates);
    }

    private static BacktestingTrade pair(Event entry, Event exit, String currency, String pnlHeader,
                                         String instrument, String timezone, String filename) {
        if (entry.direction() != exit.direction() || entry.quantity().compareTo(exit.quantity()) != 0)
            throw new IllegalArgumentException("entry/exit direction or quantity differs; partial exits are unsupported");
        if (entry.number().length() > 64) throw new IllegalArgumentException("trade number exceeds 64 characters");
        for (Event event : List.of(entry, exit)) {
            String signal = optional(event.row(), "Signal");
            if (signal != null && signal.length() > 255) throw new IllegalArgumentException("signal exceeds 255 characters");
        }
        BigDecimal pnl = decimal(exit.row(), pnlHeader);
        if (pnl == null) throw new IllegalArgumentException("net PnL is required");
        // Both copies must agree. Do not add them or subtract commission from already-net PnL.
        for (String column : List.of(pnlHeader, "Commission " + currency, "Favorable excursion " + currency,
                "Adverse excursion " + currency, "Return %", "Favorable excursion %", "Adverse excursion %", "Duration (bars)")) {
            BigDecimal a = decimal(entry.row(), column), b = decimal(exit.row(), column);
            if (a != null && b != null && a.compareTo(b) != 0)
                throw new IllegalArgumentException("entry/exit values disagree for " + column);
        }
        BigDecimal bars = decimal(exit.row(), "Duration (bars)");
        if (bars != null && bars.signum() < 0) throw new IllegalArgumentException("duration cannot be negative");
        BigDecimal commission = decimal(exit.row(), "Commission " + currency);
        if (commission != null && commission.signum() < 0) throw new IllegalArgumentException("commission cannot be negative");
        String fingerprint = fingerprint(String.join("|", FORMAT, instrument, currency,
                entry.at().toString(), exit.at().toString(), entry.direction().name(),
                canonical(entry.price()), canonical(exit.price()), canonical(entry.quantity())));
        return BacktestingTrade.builder()
                .date(entry.at().toLocalDate()).entryTime(entry.at().toLocalTime())
                .weekday(entry.at().getDayOfWeek().name().substring(0, 1) + entry.at().getDayOfWeek().name().substring(1).toLowerCase(Locale.ROOT))
                .exitDate(exit.at().toLocalDate()).exitTime(exit.at().toLocalTime())
                .instrument(instrument).direction(entry.direction()).entryPrice(entry.price()).exitPrice(exit.price())
                .quantity(entry.quantity()).positionValue(decimal(entry.row(), "Size (value)"))
                .netPnl(pnl).currency(currency).returnPercent(decimal(exit.row(), "Return %"))
                .commission(commission).favorableExcursion(decimal(exit.row(), "Favorable excursion " + currency))
                .adverseExcursion(decimal(exit.row(), "Adverse excursion " + currency))
                .favorableExcursionPercent(decimal(exit.row(), "Favorable excursion %"))
                .adverseExcursionPercent(decimal(exit.row(), "Adverse excursion %"))
                .reportedCumulativePnl(decimal(exit.row(), "Cumulative PnL " + currency))
                .reportedCumulativePercent(decimal(exit.row(), "Cumulative PnL %"))
                .durationBars(bars == null ? null : bars.intValueExact())
                .entrySignal(optional(entry.row(), "Signal")).exitSignal(optional(exit.row(), "Signal"))
                .result(pnl.signum() > 0 ? BacktestingTradeResult.WIN : pnl.signum() < 0 ? BacktestingTradeResult.LOSS : BacktestingTradeResult.BREAKEVEN)
                .source(BacktestingTradeSource.IMPORT).tradeScope(BacktestingTradeScope.REPLAY)
                .importFormat(FORMAT).importFileName(filename).importTradeNumber(entry.number())
                .importFingerprint(fingerprint).sourceTimezone(timezone == null || timezone.isBlank() ? null : timezone)
                .tagsJson("[]").build();
    }

    private static String canonical(BigDecimal value) { return value.stripTrailingZeros().toPlainString(); }
    private static String fingerprint(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception ex) { throw new IllegalStateException(ex); }
    }
    private static String error(CSVRecord row, String message) { return "Row " + (row.getRecordNumber() + 1) + ": " + message; }
    private static String optional(CSVRecord row, String key) { return row.isMapped(key) && !row.get(key).isBlank() ? row.get(key).trim() : null; }
    private static String required(CSVRecord row, String key) {
        String value = optional(row, key);
        if (value == null) throw new IllegalArgumentException(key + " is required");
        return value;
    }
    private static BigDecimal decimal(CSVRecord row, String key) {
        String value = optional(row, key);
        if (value == null) return null;
        BigDecimal number = new BigDecimal(value.replace(",", "").replace("\u2212", "-"));
        if (number.precision() - number.scale() > 16 || number.scale() > 8)
            throw new IllegalArgumentException(key + " exceeds supported precision");
        return number;
    }
    private static BigDecimal positive(CSVRecord row, String key) {
        BigDecimal value = decimal(row, key);
        if (value == null || value.signum() <= 0) throw new IllegalArgumentException(key + " must be positive");
        return value;
    }
}
