package com.tradevault.service.news;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

/** Operator-verified provider identities only. No inferred ticker suffixes or global-coverage promise. */
public final class CompanyNewsMappings {
    public record Mapping(String identity, String symbol, String exchange, String country, String sector) {
        public String feedId() { return "marketaux-company-" + identity; }
        boolean matches(com.fasterxml.jackson.databind.JsonNode entity) {
            return "equity".equals(entity.path("type").asText()) && symbol.equals(entity.path("symbol").asText())
                && exchange.equals(entity.path("exchange").asText()) && country.equalsIgnoreCase(entity.path("country").asText());
        }
    }
    private CompanyNewsMappings() {}
    public static List<Mapping> parse(ObjectMapper mapper, String json) {
        try {
            var rows = mapper.readValue(json, Mapping[].class);
            if (rows.length > 64) throw new IllegalArgumentException();
            Set<String> identities = new HashSet<>(), entities = new HashSet<>();
            for (var row : rows) {
                var topic = InstrumentTopics.resolve(row.identity());
                if (topic.stockIdentity() == null || !topic.stockIdentity().equals(row.identity())
                    || row.symbol() == null || !row.symbol().matches("[A-Za-z0-9.^_-]{1,32}")
                    || row.exchange() == null || !row.exchange().matches("[A-Za-z0-9._-]{1,24}")
                    || row.country() == null || !row.country().matches("[a-z]{2}")
                    || row.sector() == null || row.sector().length() > 80
                    || !identities.add(row.identity()) || !entities.add(row.exchange()+":"+row.symbol())) throw new IllegalArgumentException();
                String expected = topic.regions().contains("UK") ? "gb" : topic.regions().contains("DE") ? "de" : topic.regions().contains("US") ? "us" : null;
                if (expected != null && !expected.equals(row.country())) throw new IllegalArgumentException();
            }
            return List.of(rows);
        } catch (Exception ex) { throw new IllegalArgumentException("Invalid verified company-news mappings"); }
    }
}
