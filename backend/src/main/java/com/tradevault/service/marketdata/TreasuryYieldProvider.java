package com.tradevault.service.marketdata;

import com.tradevault.dto.market.MarketWorkspaceResponse.AvailabilityReason;
import com.tradevault.dto.market.MarketWorkspaceResponse.Freshness;
import com.tradevault.dto.market.MarketWorkspaceResponse.MacroObservation;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamReader;
import java.io.StringReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TreasuryYieldProvider {
    public static final String SOURCE_URL = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve";
    private static final int MAX_RESPONSE_BYTES = 1_000_000;
    private final RestTemplate client;
    private final Map<Year, CacheEntry> cache = new ConcurrentHashMap<>();
    @Value("${marketdata.treasury-feed-base-url:https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml}")
    private String feedBaseUrl = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml";
    @Value("${marketdata.treasury-cache-ttl-hours:12}")
    private long cacheTtlHours = 12;

    public TreasuryYieldProvider() {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(5000);
        this.client = new RestTemplate(factory);
    }

    public synchronized List<MacroObservation> latest() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Year year = Year.from(now);
        CacheEntry entry = cache.get(year);
        if (entry == null || Duration.between(entry.retrievedAt(), now).compareTo(Duration.ofHours(Math.max(1, cacheTtlHours))) >= 0) {
            try {
                java.net.URI feed = java.net.URI.create(feedBaseUrl);
                if (!"https".equalsIgnoreCase(feed.getScheme()) || !"home.treasury.gov".equalsIgnoreCase(feed.getHost()))
                    throw new IllegalArgumentException("Treasury feed must use the official HTTPS host");
                String url = UriComponentsBuilder.fromUri(feed).queryParam("data", "daily_treasury_yield_curve")
                        .queryParam("field_tdr_date_value", year).build().toUriString();
                HttpHeaders headers = new HttpHeaders();
                headers.setAccept(List.of(MediaType.APPLICATION_XML, MediaType.TEXT_XML));
                String xml = client.getForObject(url, String.class);
                if (xml == null || xml.getBytes(StandardCharsets.UTF_8).length > MAX_RESPONSE_BYTES)
                    throw new IllegalStateException("Treasury response exceeded configured size limit");
                List<YieldRow> rows = parseRows(xml);
                entry = new CacheEntry(rows, now);
                cache.put(year, entry);
            } catch (Exception ex) {
                if (entry == null) return unavailable(now, AvailabilityReason.UPSTREAM_ERROR);
            }
        }
        if (entry.rows().isEmpty()) return unavailable(entry.retrievedAt(), AvailabilityReason.NO_COMPLETED_REFERENCE);
        YieldRow current = entry.rows().get(0);
        YieldRow previous = entry.rows().size() > 1 ? entry.rows().get(1) : null;
        Freshness freshness = Duration.between(current.date().atStartOfDay().toInstant(ZoneOffset.UTC), now.toInstant()).abs()
                .compareTo(Duration.ofDays(4)) <= 0 ? Freshness.CLOSE : Freshness.STALE;
        return List.of(observation("US2Y", "BC_2YEAR", current.twoYear(), previous == null ? null : previous.twoYear(), current.date(), entry.retrievedAt(), freshness),
                observation("US10Y", "BC_10YEAR", current.tenYear(), previous == null ? null : previous.tenYear(), current.date(), entry.retrievedAt(), freshness));
    }

    static List<YieldRow> parseRows(String xml) throws Exception {
        XMLInputFactory factory = XMLInputFactory.newFactory();
        factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        factory.setProperty("javax.xml.stream.isSupportingExternalEntities", false);
        XMLStreamReader reader = factory.createXMLStreamReader(new StringReader(xml));
        List<YieldRow> rows = new ArrayList<>();
        boolean inEntry = false;
        LocalDate date = null;
        BigDecimal two = null, ten = null;
        while (reader.hasNext()) {
            int event = reader.next();
            if (event == XMLStreamConstants.START_ELEMENT) {
                String name = reader.getLocalName();
                if ("entry".equals(name)) { inEntry = true; date = null; two = null; ten = null; }
                else if (inEntry && List.of("NEW_DATE", "BC_2YEAR", "BC_10YEAR").contains(name)) {
                    String value = reader.getElementText().trim();
                    switch (name) {
                        case "NEW_DATE" -> date = parseDate(value);
                        case "BC_2YEAR" -> two = decimal(value);
                        case "BC_10YEAR" -> ten = decimal(value);
                        default -> { }
                    }
                }
            } else if (event == XMLStreamConstants.END_ELEMENT && "entry".equals(reader.getLocalName())) {
                if (date != null && two != null && ten != null) rows.add(new YieldRow(date, two, ten));
                inEntry = false;
            }
        }
        reader.close();
        rows.sort(Comparator.comparing(YieldRow::date).reversed());
        return List.copyOf(rows);
    }

    private static LocalDate parseDate(String value) {
        try { return LocalDate.parse(value.substring(0, 10)); } catch (Exception ex) { return null; }
    }
    private static BigDecimal decimal(String value) {
        if (value.isBlank() || "N/A".equalsIgnoreCase(value)) return null;
        try { return new BigDecimal(value); } catch (Exception ex) { return null; }
    }
    private static MacroObservation observation(String canonical, String providerSymbol, BigDecimal value, BigDecimal previous,
                                                LocalDate date, OffsetDateTime retrievedAt, Freshness freshness) {
        BigDecimal bp = basisPoints(value, previous);
        return new MacroObservation(canonical, "US_TREASURY", providerSymbol, "GOVERNMENT_YIELD", "OFFICIAL_DAILY_CLOSE",
                value, previous, bp, "%", date, retrievedAt, freshness, "OFFICIAL_PUBLIC", SOURCE_URL,
                value == null ? AvailabilityReason.NO_COMPLETED_REFERENCE : null);
    }
    private static List<MacroObservation> unavailable(OffsetDateTime now, AvailabilityReason reason) {
        return List.of(new MacroObservation("US2Y", "US_TREASURY", "BC_2YEAR", "GOVERNMENT_YIELD", "OFFICIAL_DAILY_CLOSE", null, null, null, "%", null, now, Freshness.UNAVAILABLE, "OFFICIAL_PUBLIC", SOURCE_URL, reason),
                new MacroObservation("US10Y", "US_TREASURY", "BC_10YEAR", "GOVERNMENT_YIELD", "OFFICIAL_DAILY_CLOSE", null, null, null, "%", null, now, Freshness.UNAVAILABLE, "OFFICIAL_PUBLIC", SOURCE_URL, reason));
    }

    record YieldRow(LocalDate date, BigDecimal twoYear, BigDecimal tenYear) {}
    static BigDecimal basisPoints(BigDecimal currentPercent, BigDecimal previousPercent) {
        return currentPercent == null || previousPercent == null ? null
                : currentPercent.subtract(previousPercent).multiply(BigDecimal.valueOf(100));
    }
    private record CacheEntry(List<YieldRow> rows, OffsetDateTime retrievedAt) {}
}
