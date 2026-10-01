package com.tradevault.service.news;

import com.fasterxml.jackson.databind.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import static com.tradevault.service.news.NewsModels.*;

@Component
public class NewsProviders {
    public record Feed(String id, String provider, Capability capability, String region, String url, Duration ttl, int budget) {}
    @Value("${news.official-daily-budget:80}") private int officialBudget = 80;
    @Value("${news.bls-daily-budget:20}") private int blsBudget = 20;
    @Value("${news.marketaux-daily-budget:80}") private int marketauxBudget = 80;
    @Value("${news.marketaux-authorized:false}") private boolean marketauxAuthorized;
    @Value("${news.marketaux-api-token:}") private String marketauxToken = "";
    private final ObjectMapper mapper;
    public NewsProviders(ObjectMapper mapper) { this.mapper = mapper; }
    public List<Feed> feeds() {
        List<Feed> feeds = new ArrayList<>(List.of(
            new Feed("ecb-news", "ECB", Capability.NEWS, "EU", "https://www.ecb.europa.eu/rss/press.html", Duration.ofMinutes(30), officialBudget),
            new Feed("eurostat-news", "Eurostat", Capability.NEWS, "EU", "https://ec.europa.eu/eurostat/en/search?p_p_id=estatsearchportlet_WAR_estatsearchportlet&p_p_lifecycle=2&p_p_state=maximized&p_p_mode=view&p_p_resource_id=atom&_estatsearchportlet_WAR_estatsearchportlet_theme=PER_ECOFIN&_estatsearchportlet_WAR_estatsearchportlet_collection=CAT_PREREL", Duration.ofMinutes(30), officialBudget),
            new Feed("fed-news", "Federal Reserve", Capability.NEWS, "US", "https://www.federalreserve.gov/feeds/press_monetary.xml", Duration.ofMinutes(30), officialBudget),
            new Feed("bls-calendar", "BLS calendar", Capability.CALENDAR, "US", "https://www.bls.gov/schedule/news_release/bls.ics", Duration.ofHours(6), officialBudget),
            new Feed("bea-calendar", "BEA", Capability.CALENDAR, "US", "https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics", Duration.ofHours(6), officialBudget),
            new Feed("eurostat-calendar", "Eurostat", Capability.CALENDAR, "EU", "https://ec.europa.eu/eurostat/o/calendars/eventsIcal?theme=0&category=2", Duration.ofHours(6), officialBudget),
            new Feed("bls-unemployment", "BLS API", Capability.OBSERVATIONS, "US", "https://api.bls.gov/publicAPI/v1/timeseries/data/LNS14000000", Duration.ofHours(6), Math.min(20, blsBudget)),
            new Feed("bls-cpi", "BLS API", Capability.OBSERVATIONS, "US", "https://api.bls.gov/publicAPI/v1/timeseries/data/CUUR0000SA0", Duration.ofHours(6), Math.min(20, blsBudget)),
            new Feed("eurostat-unemployment", "Eurostat", Capability.OBSERVATIONS, "EU", "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/une_rt_m?lang=EN&freq=M&unit=PC_ACT&s_adj=SA&age=TOTAL&sex=T&geo=EU27_2020&lastTimePeriod=2", Duration.ofHours(6), officialBudget)
        ));
        if (marketauxAuthorized && !marketauxToken.isBlank()) {
            // Two shared queries, 24/day each. No dynamic per-user/stock queries or pagination.
            feeds.add(new Feed("marketaux-germany", "Marketaux", Capability.NEWS, "EU", "https://api.marketaux.com/v1/news/all?language=en&limit=3&search=\"DAX index\"|\"German equities\"", Duration.ofHours(1), Math.min(80, marketauxBudget)));
            feeds.add(new Feed("marketaux-tech", "Marketaux", Capability.NEWS, "US", "https://api.marketaux.com/v1/news/all?language=en&limit=3&search=\"Nasdaq-100\"|\"technology sector\"", Duration.ofHours(1), Math.min(80, marketauxBudget)));
        }
        return List.copyOf(feeds);
    }
    public static class FetchFailure extends RuntimeException {
        final int status;
        final Duration backoff;
        FetchFailure(int status, Duration backoff) { super("Context fetch failed (HTTP " + status + ")"); this.status=status; this.backoff=backoff; }
        boolean retryable() { return status == 0 || status >= 500; }
    }
    /** No user URLs, redirects, keys in exceptions, response-body logging or unlimited reads. */
    public String fetch(Feed feed) {
        if (!feeds().contains(feed)) throw new IllegalArgumentException("Unknown context source");
        String url = feed.url();
        if (feed.id().startsWith("marketaux-")) {
            String search = url.substring(url.indexOf("&search=") + 8);
            url = url.substring(0, url.indexOf("&search=")) + "&search=" + URLEncoder.encode(search, StandardCharsets.UTF_8)
                + "&api_token=" + URLEncoder.encode(marketauxToken, StandardCharsets.UTF_8);
        }
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) URI.create(url).toURL().openConnection();
            c.setConnectTimeout(4000); c.setReadTimeout(6000); c.setInstanceFollowRedirects(false);
            c.setRequestProperty("User-Agent", "TradeJAudit-OfficialContext/1.0");
            c.setRequestProperty("Accept", "application/xml,application/json,text/calendar,*/*");
            int status = c.getResponseCode();
            if (status != 200) {
                throw new FetchFailure(status, retryDelay(c.getHeaderField("Retry-After"), Instant.now()));
            }
            try (var in = c.getInputStream()) {
                byte[] bytes = in.readNBytes(2_000_001);
                if (bytes.length > 2_000_000) throw new IllegalArgumentException("Context response exceeds size limit");
                return new String(bytes, StandardCharsets.UTF_8).replaceFirst("^\uFEFF", "");
            }
        } catch (java.io.IOException ex) { throw new FetchFailure(0, Duration.ofMinutes(30)); }
        finally { if (c != null) c.disconnect(); }
    }
    static Duration retryDelay(String header, Instant now) {
        long seconds=1800;
        if(header!=null) {
            try { seconds=Long.parseLong(header); }
            catch(NumberFormatException ex) {
                try { seconds=Duration.between(now,ZonedDateTime.parse(header,DateTimeFormatter.RFC_1123_DATE_TIME).toInstant()).getSeconds(); }
                catch(java.time.format.DateTimeParseException ignored) { /* Keep bounded fallback. */ }
            }
        }
        return Duration.ofSeconds(Math.max(1800,Math.min(86400,seconds)));
    }
    public Payload parse(Feed feed, String body, Instant fetched) {
        try {
            if (feed.id().startsWith("marketaux-")) return NewsParsers.marketaux(feed, mapper.readTree(body));
            return switch (feed.capability()) {
                case NEWS -> NewsParsers.rss(feed, body);
                case CALENDAR -> NewsParsers.calendar(feed, body);
                case OBSERVATIONS -> NewsParsers.observations(feed, mapper.readTree(body));
            };
        } catch (java.io.IOException ex) { throw new IllegalArgumentException("Invalid context JSON"); }
    }
}
