package com.tradevault.service.mt5;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class Mt5HtmlParser {
    public static final String PARSER_VERSION = "mt5-html-v1";

    private static final Pattern ACCOUNT_PATTERN = Pattern.compile("(?i)account(?:\s*(?:no|number|id))?\s*[:#]?\s*(\\d{4,})");
    private static final Pattern CURRENCY_PATTERN = Pattern.compile("(?i)(?:currency|account currency)\s*:?\s*([A-Z]{3,6})");
    private static final Pattern GENERATED_PATTERN = Pattern.compile("(?i)(?:generated|report generated|date)\s*(?:at)?\s*:?\s*(\\d{4}[./-]\\d{2}[./-]\\d{2}\s+\\d{2}:\\d{2}(?::\\d{2})?)");

    public Mt5ParsedReport parse(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw badRequest("The MetaTrader report is empty");
        }
        Document document = Jsoup.parse(new String(bytes, StandardCharsets.UTF_8));
        document.select("script,iframe,object,embed").remove();
        String visibleText = clean(document.text());
        if (!containsIgnoreCase(visibleText, "Positions") || !containsIgnoreCase(visibleText, "Deals")) {
            throw badRequest("This file does not contain recognizable MetaTrader 5 Positions and Deals sections");
        }

        MetadataAccumulator metadata = parseMetadata(document, visibleText);
        List<Mt5ParsedReport.Position> positions = new ArrayList<>();
        List<Mt5ParsedReport.Order> orders = new ArrayList<>();
        List<Mt5ParsedReport.Deal> deals = new ArrayList<>();
        Map<String, String> snapshot = new LinkedHashMap<>();
        Map<String, String> performance = new LinkedHashMap<>();
        List<String> warnings = new ArrayList<>();

        Section section = Section.NONE;
        HeaderMap headers = null;
        for (Element row : document.select("tr")) {
            List<String> cells = row.select("th,td").stream().map(Element::text).map(Mt5HtmlParser::clean).toList();
            if (cells.isEmpty() || cells.stream().allMatch(String::isBlank)) continue;
            Section detected = detectSection(cells);
            if (detected != Section.NONE) {
                section = detected;
                headers = null;
                continue;
            }
            if (section == Section.NONE) continue;
            if (looksLikeHeader(row, cells, section)) {
                headers = HeaderMap.from(cells);
                continue;
            }
            if (headers == null) {
                if (section == Section.SNAPSHOT || section == Section.PERFORMANCE) addKeyValue(cells, section == Section.SNAPSHOT ? snapshot : performance);
                continue;
            }
            RowData data = headers.read(cells, section);
            if (data.isTotalsOrEmpty()) continue;
            try {
                switch (section) {
                    case POSITIONS -> positions.add(parsePosition(data));
                    case ORDERS -> orders.add(parseOrder(data));
                    case DEALS -> deals.add(parseDeal(data));
                    case SNAPSHOT -> addKeyValue(cells, snapshot);
                    case PERFORMANCE -> addKeyValue(cells, performance);
                    default -> { }
                }
            } catch (RuntimeException ex) {
                warnings.add("Unsupported " + section.name().toLowerCase(Locale.ROOT) + " row preserved but not reconstructed: " + ex.getMessage());
            }
        }

        if (metadata.externalAccountId == null) throw badRequest("MetaTrader account number could not be parsed");
        if (positions.isEmpty() && deals.stream().noneMatch(Mt5ParsedReport.Deal::isTradingExecution)) {
            throw badRequest("The report contains no recognizable positions or trading deals");
        }
        return new Mt5ParsedReport(metadata.toRecord(), positions, orders, deals, snapshot, performance, warnings);
    }

    private static MetadataAccumulator parseMetadata(Document document, String visibleText) {
        MetadataAccumulator result = new MetadataAccumulator();
        for (Element row : document.select("tr")) {
            List<String> cells = row.select("th,td").stream().map(Element::text).map(Mt5HtmlParser::clean).toList();
            if (cells.size() < 2) continue;
            String key = normalizeHeader(cells.get(0));
            String value = cells.stream().skip(1).filter(v -> !v.isBlank()).findFirst().orElse(null);
            if (value == null) continue;
            switch (key) {
                case "name", "account name" -> result.accountName = value;
                case "account", "account id", "account number", "login" -> result.externalAccountId = digitsOrText(value);
                case "currency", "account currency" -> result.currency = firstCurrency(value);
                case "server", "broker server" -> result.brokerServer = value;
                case "company", "broker" -> result.company = value;
                case "account type", "type" -> result.accountType = value;
                case "accounting mode", "mode" -> result.accountingMode = value;
                case "report generated at", "generated", "report date", "date" -> result.reportGeneratedAt = value;
                default -> { }
            }
        }
        if (result.externalAccountId == null) result.externalAccountId = match(ACCOUNT_PATTERN, visibleText);
        if (result.currency == null) result.currency = match(CURRENCY_PATTERN, visibleText);
        if (result.reportGeneratedAt == null) result.reportGeneratedAt = match(GENERATED_PATTERN, visibleText);
        String title = clean(document.title());
        if (result.accountName == null && !title.isBlank() && !containsIgnoreCase(title, "statement")) result.accountName = title;
        return result;
    }

    private static Mt5ParsedReport.Position parsePosition(RowData d) {
        return new Mt5ParsedReport.Position(
                d.first("open time", "time"), d.first("position", "position id", "ticket"), d.first("symbol"),
                d.first("type", "direction"), d.first("comment"), decimal(d.first("volume", "quantity")),
                decimal(d.nth("price", 0, "entry price")), decimal(d.first("s/l", "sl", "stop loss")),
                decimal(d.first("t/p", "tp", "take profit")), d.first("close time", "time#2"),
                decimal(d.nth("price", 1, "exit price")), decimal(d.first("commission")), decimal(d.first("swap")),
                decimal(d.first("profit", "p/l")), d.raw());
    }

    private static Mt5ParsedReport.Order parseOrder(RowData d) {
        BigDecimal[] volumes = splitPair(d.first("volume", "quantity"));
        return new Mt5ParsedReport.Order(
                d.first("open time", "time"), d.first("order", "order id", "ticket"), d.first("position", "position id"),
                d.first("symbol"), d.first("type"), firstNonNull(decimal(d.first("requested volume")), volumes[0]),
                firstNonNull(decimal(d.first("filled volume")), volumes[1]), decimal(d.first("price", "requested price")),
                decimal(d.first("s/l", "sl", "stop loss")), decimal(d.first("t/p", "tp", "take profit")),
                d.first("completion time", "update time", "time#2"), d.first("state", "status"), d.first("comment"), d.raw());
    }

    private static Mt5ParsedReport.Deal parseDeal(RowData d) {
        return new Mt5ParsedReport.Deal(
                d.first("time", "execution time"), d.first("deal", "deal id", "ticket"), d.first("order", "order id"),
                d.first("position", "position id"), d.first("symbol"), d.first("type"), d.first("direction", "entry"),
                decimal(d.first("volume", "quantity")), decimal(d.first("price")), decimal(d.first("cost")),
                decimal(d.first("commission")), decimal(d.first("fee")), decimal(d.first("swap")),
                decimal(d.first("profit", "p/l")), decimal(d.first("balance")), d.first("comment"), d.raw());
    }

    public static BigDecimal decimal(String raw) {
        if (raw == null) return null;
        String value = clean(raw).replace("−", "-").replace("'", "").replaceAll("(?i)[A-Z]{3,6}$", "").trim();
        if (value.isBlank() || value.equals("-") || value.equalsIgnoreCase("market")) return null;
        value = value.replace(" ", "");
        if (value.contains(",") && value.contains(".")) value = value.replace(",", "");
        else if (value.indexOf(',') >= 0) {
            int comma = value.lastIndexOf(',');
            value = value.length() - comma - 1 <= 3 ? value.replace(',', '.') : value.replace(",", "");
        }
        value = value.replaceAll("[^0-9+\\-.]", "");
        if (value.isBlank() || value.equals("-") || value.equals("+")) return null;
        return new BigDecimal(value);
    }

    private static BigDecimal[] splitPair(String raw) {
        if (raw == null) return new BigDecimal[]{null, null};
        String[] parts = raw.split("[/\\\\]");
        if (parts.length < 2) return new BigDecimal[]{decimal(raw), decimal(raw)};
        return new BigDecimal[]{decimal(parts[0]), decimal(parts[1])};
    }

    private static Section detectSection(List<String> cells) {
        String joined = clean(String.join(" ", cells)).toLowerCase(Locale.ROOT);
        if (joined.equals("positions") || joined.startsWith("positions ")) return Section.POSITIONS;
        if (joined.equals("orders") || joined.startsWith("orders ")) return Section.ORDERS;
        if (joined.equals("deals") || joined.startsWith("deals ")) return Section.DEALS;
        if (joined.contains("account snapshot")) return Section.SNAPSHOT;
        if (joined.contains("performance") || joined.equals("results")) return Section.PERFORMANCE;
        return Section.NONE;
    }

    private static boolean looksLikeHeader(Element row, List<String> cells, Section section) {
        if (!row.select("th").isEmpty()) return true;
        Set<String> normalized = new HashSet<>(cells.stream().map(Mt5HtmlParser::normalizeHeader).toList());
        return switch (section) {
            case POSITIONS -> normalized.contains("symbol") && (normalized.contains("position") || normalized.contains("ticket"));
            case ORDERS -> normalized.contains("symbol") && (normalized.contains("order") || normalized.contains("ticket"));
            case DEALS -> normalized.contains("deal") && normalized.contains("type");
            default -> false;
        };
    }

    private static void addKeyValue(List<String> cells, Map<String, String> target) {
        if (cells.size() >= 2 && !cells.get(0).isBlank()) target.put(cells.get(0), cells.get(1));
    }

    private static String clean(String value) {
        return value == null ? "" : value.replace('\u00a0', ' ').replaceAll("\\s+", " ").trim();
    }

    private static String normalizeHeader(String value) {
        return clean(value).toLowerCase(Locale.ROOT).replace(':', ' ').replaceAll("\\s+", " ").trim();
    }

    private static boolean containsIgnoreCase(String haystack, String needle) {
        return haystack != null && haystack.toLowerCase(Locale.ROOT).contains(needle.toLowerCase(Locale.ROOT));
    }

    private static String digitsOrText(String value) {
        Matcher matcher = Pattern.compile("\\d{4,}").matcher(value);
        return matcher.find() ? matcher.group() : clean(value);
    }

    private static String firstCurrency(String value) {
        Matcher matcher = Pattern.compile("\\b[A-Z]{3,6}\\b").matcher(value.toUpperCase(Locale.ROOT));
        return matcher.find() ? matcher.group() : clean(value);
    }

    private static String match(Pattern pattern, String value) {
        Matcher matcher = pattern.matcher(value);
        return matcher.find() ? matcher.group(1) : null;
    }

    private static <T> T firstNonNull(T a, T b) { return a != null ? a : b; }
    private static ResponseStatusException badRequest(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private enum Section { NONE, POSITIONS, ORDERS, DEALS, SNAPSHOT, PERFORMANCE }

    private static final class MetadataAccumulator {
        String accountName, externalAccountId, currency, brokerServer, company, accountType, accountingMode, reportGeneratedAt;
        Mt5ParsedReport.Metadata toRecord() {
            return new Mt5ParsedReport.Metadata(accountName, externalAccountId, currency, brokerServer, company, accountType, accountingMode, reportGeneratedAt);
        }
    }

    private record HeaderMap(List<String> keys) {
        static HeaderMap from(List<String> headers) {
            Map<String, Integer> seen = new HashMap<>();
            List<String> keys = new ArrayList<>();
            for (String header : headers) {
                String key = normalizeHeader(header);
                int count = seen.merge(key, 1, Integer::sum);
                keys.add(count == 1 ? key : key + "#" + count);
            }
            return new HeaderMap(keys);
        }

        RowData read(List<String> original, Section section) {
            List<String> cells = new ArrayList<>(original);
            Map<String, String> values = new LinkedHashMap<>();
            if (section == Section.POSITIONS && cells.size() == keys.size() + 1 && keys.stream().noneMatch("comment"::equals)) {
                int typeIndex = keys.indexOf("type");
                int candidate = typeIndex >= 0 ? typeIndex + 1 : -1;
                if (candidate >= 0 && candidate < cells.size()
                        && (clean(cells.get(candidate)).isBlank() || !looksNumeric(cells.get(candidate)))) {
                    values.put("comment", cells.remove(candidate));
                }
            }
            for (int i = 0; i < Math.min(keys.size(), cells.size()); i++) values.put(keys.get(i), cells.get(i));
            if (cells.size() > keys.size()) values.put("extra", String.join(" | ", cells.subList(keys.size(), cells.size())));
            return new RowData(values);
        }
    }

    private static boolean looksNumeric(String value) {
        String cleaned = clean(value);
        return cleaned.isBlank() || cleaned.equals("-") || cleaned.equalsIgnoreCase("market")
                || cleaned.matches("^[+\\-−]?[0-9][0-9\\s\\u00a0'.,]*(?:\\s*[A-Za-z]{3,6})?$");
    }

    private record RowData(Map<String, String> raw) {
        String first(String... keys) {
            for (String key : keys) {
                String value = raw.get(key);
                if (value != null && !value.isBlank()) return value;
            }
            return null;
        }
        String nth(String repeated, int index, String fallback) {
            String value = raw.get(index == 0 ? repeated : repeated + "#" + (index + 1));
            return value == null || value.isBlank() ? first(fallback) : value;
        }
        boolean isTotalsOrEmpty() {
            String first = raw.values().stream().filter(v -> v != null && !v.isBlank()).findFirst().orElse("");
            return first.isBlank() || first.equalsIgnoreCase("total") || first.toLowerCase(Locale.ROOT).startsWith("total ");
        }
    }
}
