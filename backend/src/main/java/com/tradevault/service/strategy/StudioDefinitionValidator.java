package com.tradevault.service.strategy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.*;

/** Bounded, versioned strategy documentation. This schema does not execute trading rules. */
@Component
public class StudioDefinitionValidator {
    public static final int MAX_BYTES = 2 * 1024 * 1024;
    private static final Set<String> TYPES =
            Set.of(
                    "NUMBER",
                    "DECIMAL",
                    "PERCENTAGE",
                    "BOOLEAN",
                    "TEXT",
                    "DROPDOWN",
                    "MULTISELECT",
                    "TIME",
                    "DURATION",
                    "TIMEFRAME",
                    "PRICE_DISTANCE",
                    "INTEGER");
    private static final Set<String> NUMERIC =
            Set.of("NUMBER", "DECIMAL", "PERCENTAGE", "DURATION", "PRICE_DISTANCE", "INTEGER");
    private static final Safelist HTML =
            Safelist.none()
                    .addTags(
                            "p",
                            "br",
                            "b",
                            "strong",
                            "i",
                            "em",
                            "u",
                            "mark",
                            "ul",
                            "ol",
                            "li",
                            "h1",
                            "h2",
                            "h3",
                            "h4",
                            "blockquote",
                            "pre",
                            "code",
                            "a",
                            "label",
                            "input",
                            "span")
                    .addAttributes("input", "type", "checked")
                    .addAttributes("ul", "data-type")
                    .addAttributes("li", "data-type")
                    .addAttributes("label", "data-type")
                    .addAttributes("a", "href", "title")
                    .addProtocols("a", "href", "http", "https", "mailto");
    private final ObjectMapper mapper;

    public StudioDefinitionValidator(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public ObjectNode empty() {
        ObjectNode doc = mapper.createObjectNode();
        doc.put("schemaVersion", 1);
        ObjectNode meta = doc.putObject("metadata");
        meta.put("status", "Draft");
        meta.put("favorite", false);
        meta.put("timezone", "Europe/Bucharest");
        doc.putObject("summary");
        for (String key :
                List.of("notebook", "parameters", "presets", "rules", "checklists", "evidence"))
            doc.putArray(key);
        return doc;
    }

    public ObjectNode validate(JsonNode raw) {
        require(raw != null && raw.isObject(), "Strategy definition must be an object");
        require(
                raw.toString().getBytes(StandardCharsets.UTF_8).length <= MAX_BYTES,
                "Strategy definition exceeds 2 MB");
        ObjectNode doc = raw.deepCopy();
        keys(
                doc,
                "schemaVersion",
                "metadata",
                "summary",
                "notebook",
                "parameters",
                "presets",
                "rules",
                "checklists",
                "evidence");
        require(
                doc.path("schemaVersion").isIntegralNumber()
                        && doc.path("schemaVersion").asInt() == 1,
                "Unsupported strategy schema version");
        JsonNode meta = doc.path("metadata");
        keys(
                meta,
                "description",
                "instrument",
                "market",
                "executionTimeframe",
                "contextTimeframe",
                "timezone",
                "direction",
                "status",
                "favorite");
        for (String key :
                List.of(
                        "description",
                        "instrument",
                        "market",
                        "executionTimeframe",
                        "contextTimeframe",
                        "direction")) text(meta, key, 4000, false);
        require(
                Set.of("Draft", "Development", "Backtesting", "Validated", "Live", "Archived")
                        .contains(meta.path("status").asText()),
                "Invalid strategy status");
        bool(meta, "favorite");
        String zone = text(meta, "timezone", 80, true);
        try {
            ZoneId.of(zone);
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException("Invalid IANA timezone");
        }
        JsonNode summary = doc.path("summary");
        keys(summary, "hypothesis", "context", "bias", "risk", "conditions");
        summary.fieldNames().forEachRemaining(key -> rich((ObjectNode) summary, key));
        for (JsonNode block : array(doc, "notebook", 500)) {
            keys(
                    block,
                    "id",
                    "type",
                    "html",
                    "title",
                    "caption",
                    "assetId",
                    "rows",
                    "checked",
                    "collapsed");
            require(
                    Set.of(
                                    "TEXT",
                                    "HEADING",
                                    "BULLET",
                                    "NUMBERED",
                                    "CHECKLIST",
                                    "TABLE",
                                    "QUOTE",
                                    "CALLOUT",
                                    "DIVIDER",
                                    "IMAGE",
                                    "CODE")
                            .contains(block.path("type").asText()),
                    "Unsupported notebook block");
            rich((ObjectNode) block, "html");
            text(block, "title", 4000, false);
            text(block, "caption", 4000, false);
            if (block.hasNonNull("assetId")) uuid(block.path("assetId").asText(), "assetId");
            bool(block, "checked");
            bool(block, "collapsed");
            if (block.has("rows")) {
                require(
                        block.path("rows").isArray() && block.path("rows").size() <= 100,
                        "Table exceeds 100 rows");
                for (JsonNode row : block.path("rows")) {
                    require(row.isArray() && row.size() <= 20, "Table exceeds 20 columns");
                    for (JsonNode cell : row)
                        require(
                                cell.isTextual() && cell.asText().length() <= 4000,
                                "Invalid table cell");
                }
            }
        }
        unique(doc.path("notebook"));
        JsonNode params = array(doc, "parameters", 200);
        unique(params);
        Map<String, JsonNode> byId = new HashMap<>();
        for (JsonNode p : params) {
            keys(
                    p,
                    "id",
                    "name",
                    "description",
                    "category",
                    "type",
                    "value",
                    "defaultValue",
                    "unit",
                    "min",
                    "max",
                    "step",
                    "options",
                    "enabled");
            text(p, "name", 180, true);
            text(p, "description", 4000, false);
            text(p, "category", 120, true);
            text(p, "unit", 40, false);
            bool(p, "enabled");
            require(TYPES.contains(p.path("type").asText()), "Invalid parameter type");
            if (p.has("options")) {
                require(
                        p.path("options").isArray() && p.path("options").size() <= 100,
                        "Invalid parameter options");
                Set<String> options = new HashSet<>();
                for (JsonNode option : p.path("options"))
                    require(
                            option.isTextual()
                                    && !option.asText().isBlank()
                                    && option.asText().length() <= 180
                                    && options.add(option.asText()),
                            "Options must be unique non-empty text");
            }
            for (String k : List.of("min", "max", "step"))
                if (p.hasNonNull(k))
                    require(p.path(k).isNumber(), "Parameter bounds must be numbers");
            if (p.hasNonNull("min") && p.hasNonNull("max"))
                require(
                        p.path("min").decimalValue().compareTo(p.path("max").decimalValue()) <= 0,
                        "Minimum exceeds maximum");
            if (p.hasNonNull("step"))
                require(p.path("step").decimalValue().signum() > 0, "Step must be positive");
            if (Set.of("DURATION", "PRICE_DISTANCE").contains(p.path("type").asText()))
                require(
                        !p.path("unit").asText().isBlank(),
                        "Duration and price distance require a unit");
            if (p.path("type").asText().equals("PERCENTAGE"))
                require(
                        p.path("unit").asText().equals("%"),
                        "Percentage parameters use percent units (0.05 means 0.05%)");
            value(p, p.path("value"));
            value(p, p.path("defaultValue"));
            byId.put(p.path("id").asText(), p);
        }
        for (JsonNode preset : array(doc, "presets", 100)) {
            keys(preset, "id", "name", "values");
            text(preset, "name", 120, true);
            require(preset.path("values").isObject(), "Invalid preset values");
            preset.path("values")
                    .fields()
                    .forEachRemaining(
                            entry -> {
                                require(
                                        byId.containsKey(entry.getKey()),
                                        "Preset references a missing parameter");
                                value(byId.get(entry.getKey()), entry.getValue());
                            });
        }
        unique(doc.path("presets"));
        for (JsonNode rule : array(doc, "rules", 200)) {
            keys(
                    rule,
                    "id",
                    "name",
                    "description",
                    "category",
                    "required",
                    "enabled",
                    "notes",
                    "condition");
            text(rule, "name", 180, true);
            text(rule, "category", 120, true);
            text(rule, "description", 10000, false);
            text(rule, "notes", 10000, false);
            bool(rule, "required");
            bool(rule, "enabled");
            condition(rule.path("condition"), byId, 0);
        }
        unique(doc.path("rules"));
        for (JsonNode checklist : array(doc, "checklists", 100)) {
            keys(checklist, "id", "name", "type", "items");
            text(checklist, "name", 180, true);
            text(checklist, "type", 120, true);
            for (JsonNode item : array(checklist, "items", 200)) {
                keys(item, "id", "text", "mandatory", "group");
                text(item, "text", 2000, true);
                text(item, "group", 120, false);
                bool(item, "mandatory");
            }
            unique(checklist.path("items"));
        }
        unique(doc.path("checklists"));
        for (JsonNode evidence : array(doc, "evidence", 200)) {
            keys(evidence, "id", "title", "kind", "html", "workspaceId", "assetId");
            text(evidence, "title", 180, true);
            text(evidence, "kind", 80, true);
            rich((ObjectNode) evidence, "html");
            for (String key : List.of("workspaceId", "assetId"))
                if (evidence.hasNonNull(key)) uuid(evidence.path(key).asText(), key);
        }
        unique(doc.path("evidence"));
        return doc;
    }

    public static void value(JsonNode p, JsonNode v) {
        require(
                v != null && !v.isMissingNode() && !v.isNull(),
                p.path("name").asText() + ": value is required");
        String type = p.path("type").asText();
        if (NUMERIC.contains(type)) {
            require(v.isNumber(), "Numeric parameter requires a number");
            BigDecimal n = v.decimalValue();
            if (type.equals("INTEGER"))
                require(n.stripTrailingZeros().scale() <= 0, "Integer required");
            if (type.equals("DURATION")) require(n.signum() >= 0, "Duration cannot be negative");
            if (p.hasNonNull("min"))
                require(n.compareTo(p.path("min").decimalValue()) >= 0, "Value is below minimum");
            if (p.hasNonNull("max"))
                require(n.compareTo(p.path("max").decimalValue()) <= 0, "Value exceeds maximum");
            if (p.hasNonNull("step")) {
                BigDecimal base =
                        p.hasNonNull("min") ? p.path("min").decimalValue() : BigDecimal.ZERO;
                BigDecimal units =
                        n.subtract(base)
                                .divide(
                                        p.path("step").decimalValue(),
                                        12,
                                        java.math.RoundingMode.HALF_UP);
                require(
                        units.subtract(units.setScale(0, java.math.RoundingMode.HALF_UP))
                                        .abs()
                                        .compareTo(new BigDecimal("0.0000001"))
                                <= 0,
                        "Value does not match step");
            }
        } else if (type.equals("BOOLEAN"))
            require(v.isBoolean(), "Boolean parameter requires true/false");
        else if (type.equals("MULTISELECT")) {
            require(v.isArray() && v.size() <= 100, "Multi-select requires an array");
            Set<String> seen = new HashSet<>();
            for (JsonNode item : v)
                require(
                        item.isTextual()
                                && contains(p.path("options"), item)
                                && seen.add(item.asText()),
                        "Invalid multi-select option");
        } else {
            require(v.isTextual() && v.asText().length() <= 10000, "Text parameter requires text");
            if (type.equals("DROPDOWN"))
                require(contains(p.path("options"), v), "Invalid dropdown option");
            if (type.equals("TIME")) {
                try {
                    LocalTime.parse(v.asText());
                } catch (RuntimeException ex) {
                    throw new IllegalArgumentException("Time must be HH:mm or HH:mm:ss");
                }
            }
            if (type.equals("TIMEFRAME"))
                require(
                        v.asText().matches("[1-9][0-9]{0,4}(s|m|h|d|w|M)"),
                        "Timeframe requires an amount and unit, e.g. 5m or 1h");
        }
    }

    private void condition(JsonNode c, Map<String, JsonNode> params, int depth) {
        require(depth <= 8, "Conditions exceed 8 nesting levels");
        String kind = c.path("kind").asText();
        if (kind.equals("group")) {
            keys(c, "kind", "operator", "children");
            require(
                    Set.of("AND", "OR", "NOT").contains(c.path("operator").asText()),
                    "Invalid logical operator");
            JsonNode children = array(c, "children", 30);
            require(!children.isEmpty(), "Condition group cannot be empty");
            if (c.path("operator").asText().equals("NOT"))
                require(children.size() == 1, "NOT requires one child");
            for (JsonNode child : children) condition(child, params, depth + 1);
        } else if (kind.equals("manual")) {
            keys(c, "kind", "text");
            text(c, "text", 4000, true);
        } else {
            require(kind.equals("condition"), "Unsupported condition kind");
            keys(c, "kind", "parameterId", "field", "operator", "value");
            boolean ref = c.hasNonNull("parameterId") && !c.path("parameterId").asText().isBlank();
            if (ref)
                require(
                        params.containsKey(c.path("parameterId").asText()),
                        "Rule references a missing parameter");
            else text(c, "field", 180, true);
            String op = c.path("operator").asText();
            require(
                    Set.of("=", "!=", ">", ">=", "<", "<=", "BETWEEN", "IN").contains(op),
                    "Invalid comparison operator");
            JsonNode v = c.path("value");
            require(!v.isMissingNode() && !v.isNull(), "Condition value is required");
            if (Set.of("BETWEEN", "IN").contains(op)) {
                require(
                        v.isArray() && !v.isEmpty() && v.size() <= 100,
                        "IN / BETWEEN require values");
                if (op.equals("BETWEEN")) require(v.size() == 2, "BETWEEN requires two values");
                for (JsonNode item : v) literal(item);
                if (ref)
                    for (JsonNode item : v) value(params.get(c.path("parameterId").asText()), item);
            } else {
                literal(v);
                if (ref) value(params.get(c.path("parameterId").asText()), v);
            }
        }
    }

    private static void literal(JsonNode v) {
        require(
                v.isValueNode() && !v.isNull() && v.asText().length() <= 4000,
                "Invalid condition literal");
    }

    private static boolean contains(JsonNode array, JsonNode v) {
        for (JsonNode item : array) if (item.equals(v)) return true;
        return false;
    }

    private static void unique(JsonNode rows) {
        Set<String> ids = new HashSet<>();
        for (JsonNode row : rows) {
            String id = text(row, "id", 80, true);
            require(
                    id.matches("[A-Za-z0-9_-]+") && ids.add(id),
                    "Identifiers must be unique and contain letters, numbers, hyphens or"
                            + " underscores");
        }
    }

    private static JsonNode array(JsonNode node, String key, int max) {
        JsonNode a = node.path(key);
        require(
                a.isArray() && a.size() <= max,
                key + " must be an array of at most " + max + " items");
        return a;
    }

    private static void keys(JsonNode node, String... allowed) {
        require(node.isObject(), "Expected object");
        Set<String> known = Set.of(allowed);
        node.fieldNames()
                .forEachRemaining(k -> require(known.contains(k), "Unsupported field: " + k));
    }

    private static String text(JsonNode node, String key, int max, boolean required) {
        JsonNode v = node.path(key);
        if (!required && (v.isMissingNode() || v.isNull())) return "";
        require(
                v.isTextual() && v.asText().length() <= max && (!required || !v.asText().isBlank()),
                "Invalid " + key);
        return v.asText();
    }

    private static void bool(JsonNode node, String key) {
        if (node.has(key)) require(node.path(key).isBoolean(), key + " must be boolean");
    }

    private static void rich(ObjectNode node, String key) {
        if (!node.has(key)) return;
        String html = text(node, key, 200000, false);
        node.put(key, cleanHtml(html));
    }

    public static String cleanHtml(String html) {
        var doc = Jsoup.parseBodyFragment(Jsoup.clean(html, HTML));
        doc.select("input").forEach(input -> input.attr("type", "checkbox"));
        doc.outputSettings().prettyPrint(false);
        return doc.body().html();
    }

    public static UUID uuid(String v, String key) {
        try {
            return UUID.fromString(v);
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException("Invalid " + key);
        }
    }

    public static void require(boolean valid, String message) {
        if (!valid) throw new IllegalArgumentException(message);
    }
}
