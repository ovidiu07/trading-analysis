package com.tradevault.service;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.service.strategy.StudioDefinitionValidator;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class StudioDefinitionValidatorTest {
    final ObjectMapper mapper = new ObjectMapper();
    final StudioDefinitionValidator validator = new StudioDefinitionValidator(mapper);

    ObjectNode parameter(ObjectNode doc) {
        ObjectNode p = doc.withArray("parameters").addObject();
        p.put("id", "fvg")
                .put("name", "Minimum FVG")
                .put("category", "FVG")
                .put("description", "")
                .put("type", "PERCENTAGE")
                .put("unit", "%")
                .put("value", 0.05)
                .put("defaultValue", 0.05)
                .put("min", 0.01)
                .put("max", 0.5)
                .put("step", 0.01)
                .put("enabled", true)
                .putArray("options");
        return p;
    }

    @Test
    void emptyAndPercentDefinitionAreValidWithoutPriceUnitConversion() {
        var doc = validator.empty();
        parameter(doc);
        var saved = validator.validate(doc);
        assertThat(saved.path("parameters").get(0).path("value").decimalValue())
                .isEqualByComparingTo("0.05");
        assertThat(validator.validate(validator.empty()).path("metadata").path("timezone").asText())
                .isEqualTo("Europe/Bucharest");
    }

    @ParameterizedTest
    @CsvSource({"0.005", "0.051", "0.51"})
    void rejectsBoundsAndStep(double v) {
        var doc = validator.empty();
        parameter(doc).put("value", v);
        assertThatThrownBy(() -> validator.validate(doc))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsPercentPointConfusionAndNonNumericBounds() {
        var doc = validator.empty();
        var p = parameter(doc);
        p.put("unit", "points");
        assertThatThrownBy(() -> validator.validate(doc)).hasMessageContaining("percent units");
        p.put("unit", "%").put("min", "0.01");
        assertThatThrownBy(() -> validator.validate(doc)).hasMessageContaining("bounds");
    }

    @Test
    void validatesEveryPresetAndProtectsReferencedParameters() {
        var doc = validator.empty();
        parameter(doc);
        var preset = doc.withArray("presets").addObject();
        preset.put("id", "preset").put("name", "Standard").putObject("values").put("fvg", 0.07);
        validator.validate(doc);
        doc.withArray("parameters").removeAll();
        assertThatThrownBy(() -> validator.validate(doc)).hasMessageContaining("missing parameter");
    }

    @Test
    void rejectsDuplicateIdsUnsupportedFieldsAndSchema() {
        var doc = validator.empty();
        parameter(doc);
        parameter(doc);
        assertThatThrownBy(() -> validator.validate(doc)).hasMessageContaining("unique");
        ObjectNode unknown = validator.empty();
        unknown.put("futureFeature", true);
        assertThatThrownBy(() -> validator.validate(unknown))
                .hasMessageContaining("Unsupported field");
        var future = validator.empty().put("schemaVersion", 2);
        assertThatThrownBy(() -> validator.validate(future)).hasMessageContaining("schema version");
    }

    @Test
    void removesUnsafeRichHtmlAndKeepsFormattingAndSafeLinks() {
        var doc = validator.empty();
        doc.with("summary")
                .put(
                        "hypothesis",
                        "<h2>Bias</h2><mark>Focus</mark><a"
                            + " href='https://example.com'>Source</a><script>alert(1)</script><a"
                            + " href='javascript:alert(1)'>Bad</a><img src=x onerror=alert(1)>");
        String html = validator.validate(doc).path("summary").path("hypothesis").asText();
        assertThat(html)
                .contains("<h2>", "<mark>", "https://example.com")
                .doesNotContain("<script", "javascript:", "onerror", "<img");
    }

    @Test
    void rejectsOversizedNotebooksAndInvalidZones() {
        var doc = validator.empty();
        for (int i = 0; i < 501; i++)
            doc.withArray("notebook").addObject().put("id", "b" + i).put("type", "TEXT");
        assertThatThrownBy(() -> validator.validate(doc)).hasMessageContaining("500");
        var zone = validator.empty();
        zone.with("metadata").put("timezone", "GMT+invalid");
        assertThatThrownBy(() -> validator.validate(zone)).hasMessageContaining("timezone");
    }

    @Test
    void acceptsNestedRulesAndRejectsNotWithMultipleChildren() throws Exception {
        var doc = validator.empty();
        parameter(doc);
        var rule = doc.withArray("rules").addObject();
        rule.put("id", "rule").put("name", "Bias and FVG").put("category", "Entry");
        rule.set(
                "condition",
                mapper.readTree(
                        """
                        {"kind":"group","operator":"AND","children":[
                         {"kind":"condition","parameterId":"fvg","operator":">=","value":0.05},
                         {"kind":"group","operator":"OR","children":[{"kind":"manual","text":"London"},{"kind":"manual","text":"New York"}]}]}
                        """));
        validator.validate(doc);
        ((ObjectNode) rule.path("condition")).put("operator", "NOT");
        assertThatThrownBy(() -> validator.validate(doc)).hasMessageContaining("one child");
    }

    @ParameterizedTest
    @CsvSource({"INTEGER,1.5", "DURATION,-1"})
    void validatesTypedNumbers(String type, double value) {
        var doc = validator.empty();
        var p = parameter(doc);
        p.put("type", type).put("value", value);
        p.remove("min");
        p.remove("max");
        p.remove("step");
        assertThatThrownBy(() -> validator.validate(doc))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsMissingRuleReferencesAndMalformedTables() throws Exception {
        var doc = validator.empty();
        var rule = doc.withArray("rules").addObject();
        rule.put("id", "rule").put("name", "Missing").put("category", "Entry");
        rule.set(
                "condition",
                mapper.readTree(
                        "{\"kind\":\"condition\",\"parameterId\":\"gone\",\"operator\":\"=\",\"value\":5}"));
        assertThatThrownBy(() -> validator.validate(doc)).hasMessageContaining("missing parameter");
        var table = validator.empty();
        table.withArray("notebook")
                .addObject()
                .put("id", "table")
                .put("type", "TABLE")
                .put("rows", "bad");
        assertThatThrownBy(() -> validator.validate(table)).hasMessageContaining("rows");
    }

    @Test
    void acceptsTimeframeAndValidatesBothCurrentAndDefaultValues() {
        var doc = validator.empty();
        var p = parameter(doc);
        p.put("type", "TIMEFRAME").put("unit", "").put("value", "5m").put("defaultValue", "1h");
        p.remove("min");
        p.remove("max");
        p.remove("step");
        validator.validate(doc);
        p.put("defaultValue", "soon");
        assertThatThrownBy(() -> validator.validate(doc)).hasMessageContaining("Timeframe");
    }

    @Test
    void inlineChecklistStateIsSanitizedAndPreserved() {
        var doc = validator.empty();
        doc.withArray("notebook")
                .addObject()
                .put("id", "text")
                .put("type", "TEXT")
                .put(
                        "html",
                        "<ul data-type='taskList'><li data-type='taskItem'><label><input"
                            + " type='checkbox' checked onclick='bad()'></label><span>Risk"
                            + " checked</span></li></ul>");
        var html = validator.validate(doc).path("notebook").get(0).path("html").asText();
        assertThat(html).contains("type=\"checkbox\"", "checked").doesNotContain("onclick");
    }
}
