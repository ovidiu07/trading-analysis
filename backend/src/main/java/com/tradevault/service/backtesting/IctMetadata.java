package com.tradevault.service.backtesting;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.BacktestingTrade;
import org.springframework.beans.BeanWrapper;
import org.springframework.beans.BeanWrapperImpl;

import java.math.BigDecimal;
import java.util.*;

/** Canonical capture schema shared with the generated frontend registry. Never consults current market data. */
public final class IctMetadata {
    public record Option(String value, Map<String, String> label, List<String> aliases) {}
    public record Field(String key, Map<String, String> label, String group, List<Option> options,
                        boolean quick, String kind, int scale, int integerDigits) {}
    public static final List<Field> FIELDS;
    static {
        try (var stream = IctMetadata.class.getResourceAsStream("/backtesting/ict-fields.json")) {
            FIELDS = List.copyOf(new ObjectMapper().readValue(Objects.requireNonNull(stream), new TypeReference<List<Field>>() {}));
        } catch (Exception ex) { throw new ExceptionInInitializerError(ex); }
    }
    private IctMetadata() {}
    public static boolean isField(String key) { return FIELDS.stream().anyMatch(f -> f.key().equals(key)); }
    public static Map<String, Object> values(Object bean) {
        BeanWrapper wrapper = new BeanWrapperImpl(bean);
        Map<String, Object> values = new LinkedHashMap<>();
        FIELDS.forEach(f -> values.put(f.key(), wrapper.getPropertyValue(f.key())));
        return values;
    }
    /** Restore already persisted snapshots verbatim, including legacy categories from before option changes. */
    public static void restore(Object bean, Map<String, ?> snapshot) {
        BeanWrapper wrapper = new BeanWrapperImpl(bean);
        snapshot.forEach((key, value) -> { if (isField(key)) wrapper.setPropertyValue(key, value); });
    }
    /** Validate the entire patch before mutating, preserving unchanged legacy strings verbatim. */
    public static void apply(Object bean, Map<String, ?> patch) {
        BeanWrapper wrapper = new BeanWrapperImpl(bean);
        Map<String, Object> validated = new LinkedHashMap<>();
        patch.forEach((key, raw) -> {
            Field field = FIELDS.stream().filter(f -> f.key().equals(key)).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Unsupported ICT field: " + key));
            Object old = wrapper.getPropertyValue(key);
            if (field.kind().equals("select") && (Objects.equals(raw, old) || raw != null && old instanceof Enum<?> && raw.equals(old.toString()))) {
                validated.put(key, old); return;
            }
            Object value = raw;
            if (value instanceof String s && s.isBlank()) value = null;
            if (value != null && field.kind().equals("select")) {
                String text = value.toString();
                value = field.options().stream().filter(o -> o.value().equalsIgnoreCase(text)
                                || o.label().get("en").equalsIgnoreCase(text) || o.aliases().stream().anyMatch(a -> a.equalsIgnoreCase(text))).map(Option::value).findFirst()
                        .orElseThrow(() -> new IllegalArgumentException("Invalid " + key + ": " + text));
            } else if (value != null) {
                if (!(value instanceof Number)) throw new IllegalArgumentException(key + " must be a number");
                BigDecimal number;
                try { number = new BigDecimal(value.toString()); }
                catch (NumberFormatException ex) { throw new IllegalArgumentException(key + " must be finite"); }
                if (number.signum() < 0 || number.stripTrailingZeros().scale() > field.scale()
                        || number.precision() - number.scale() > field.integerDigits())
                    throw new IllegalArgumentException(key + " must be non-negative with at most " + field.scale() + " decimal places");
                if (field.kind().equals("integer")) {
                    try { value = number.intValueExact(); }
                    catch (ArithmeticException ex) { throw new IllegalArgumentException(key + " must be a non-negative 32-bit integer"); }
                } else value = number;
            }
            validated.put(key, value);
        });
        validated.forEach(wrapper::setPropertyValue);
    }
    /** Only explicit columns, with the same canonical keys or human-readable labels as the forms. */
    public static Map<String, Object> csv(Map<String, String> columns) {
        Map<String, Object> patch = new LinkedHashMap<>();
        for (Field field : FIELDS) {
            for (var cell : columns.entrySet()) {
                String header = cell.getKey().replaceAll("[^A-Za-z0-9]", "").toLowerCase(Locale.ROOT);
                if (!header.equals(field.key().toLowerCase(Locale.ROOT))
                        && !header.equals(field.label().get("en").replaceAll("[^A-Za-z0-9]", "").toLowerCase(Locale.ROOT))) continue;
                String raw = cell.getValue();
                if (raw != null && !raw.isBlank()) patch.put(field.key(), field.kind().equals("select") ? raw : new BigDecimal(raw));
            }
        }
        BacktestingTrade validated = new BacktestingTrade();
        apply(validated, patch);
        Map<String, Object> canonical = values(validated);
        patch.replaceAll((key, value) -> canonical.get(key));
        return patch;
    }
    public static boolean hasFvg(BacktestingTrade trade) {
        Map<String, Object> values = values(trade);
        return FIELDS.stream().filter(f -> f.group().equals("fvg")).anyMatch(f -> values.get(f.key()) != null);
    }
}
