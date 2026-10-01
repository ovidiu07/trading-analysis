package com.tradevault.service.news;

import com.fasterxml.jackson.databind.JsonNode;
import com.tradevault.service.briefing.events.*;
import org.w3c.dom.Element;
import java.io.StringReader;
import java.math.BigDecimal;
import java.net.URI;
import java.time.*;
import java.time.format.*;
import java.util.*;
import javax.xml.parsers.DocumentBuilderFactory;
import org.xml.sax.InputSource;
import static com.tradevault.service.news.NewsModels.*;

public final class NewsParsers {
    private NewsParsers() {}
    public static Payload rss(NewsProviders.Feed feed, String body) {
        try {
            var factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setXIncludeAware(false); factory.setExpandEntityReferences(false);
            var doc = factory.newDocumentBuilder().parse(new InputSource(new StringReader(body.replaceFirst("^\uFEFF", ""))));
            if (doc.getDocumentElement().getTagName().equals("feed") && feed.id().equals("eurostat-news")) return atom(feed, doc);
            if (!doc.getDocumentElement().getTagName().equals("rss") || doc.getElementsByTagName("channel").getLength() != 1)
                throw new IllegalArgumentException("Expected RSS channel");
            var items = doc.getElementsByTagName("item");
            if (items.getLength() > 1000) throw new IllegalArgumentException("Too many RSS items");
            List<Story> stories = new ArrayList<>();
            for (int i=0; i<items.getLength(); i++) {
                Element item = (Element) items.item(i);
                String title = required(text(item,"title")), url = officialUrl(text(item,"link"), feed);
                Instant time = ZonedDateTime.parse(text(item,"pubDate"), DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
                String id = text(item,"guid");
                // Headlines and links only: no republication of signed speeches or third-party excerpts.
                stories.add(new Story(id.isBlank() ? url : id, title, feed.provider(), url, time, null, null,
                    feed.region().equals("EU") ? "EURO_AREA_MACRO" : "US_MACRO", Set.of()));
            }
            return Payload.news(deduplicate(stories));
        } catch (Exception e) { throw new IllegalArgumentException("Invalid official RSS"); }
    }
    static Payload atom(NewsProviders.Feed feed, org.w3c.dom.Document doc) {
        var items=doc.getElementsByTagName("entry");
        if(items.getLength()>1000)throw new IllegalArgumentException("Too many Atom entries");
        List<Story> stories=new ArrayList<>(); List<Event> releases=new ArrayList<>();
        for(int i=0;i<items.getLength();i++) {
            var item=(Element)items.item(i); String url=null;
            var links=item.getElementsByTagName("link");
            for(int j=0;j<links.getLength();j++) {var link=(Element)links.item(j);if(link.getAttribute("rel").equals("alternate"))url=officialUrl(link.getAttribute("href"),feed);}
            if(url==null)throw new IllegalArgumentException("Missing official link");
            Instant published=Instant.parse(text(item,"published")), updated=Instant.parse(text(item,"updated"));
            String headline=required(text(item,"title")), id=required(text(item,"id"));
            String summary=org.jsoup.Jsoup.parse(text(item,"summary")).text();
            stories.add(new Story(id,headline,"Eurostat",url,published,updated,summary.isBlank()?null:summary,"EURO_AREA_MACRO",Set.of()));
            // Bounded official-release parser. No values are taken from the headline.
            var pattern=java.util.regex.Pattern.compile("^The euro area annual inflation rate was (-?\\d+(?:\\.\\d+)?)% in ([A-Z][a-z]+) (20\\d{2}), (?:up|down) from (-?\\d+(?:\\.\\d+)?)% in ([A-Z][a-z]+)\\.");
            var match=pattern.matcher(summary);
            if(match.find()) {
                var monthFormat=DateTimeFormatter.ofPattern("MMMM uuuu",Locale.ENGLISH);
                YearMonth period=YearMonth.parse(match.group(2)+" "+match.group(3),monthFormat);
                if(!period.minusMonths(1).getMonth().getDisplayName(java.time.format.TextStyle.FULL,Locale.ENGLISH).equals(match.group(5)))continue;
                String series="EUROSTAT:HICP:EA:ANNUAL_RATE";
                var actual=new Figure(new BigDecimal(match.group(1)),series,period.toString(),"% year-on-year","NSA");
                var previous=new Figure(new BigDecimal(match.group(4)),series,period.minusMonths(1).toString(),actual.unit(),actual.adjustment());
                releases.add(new Event(id, "Euro-area HICP annual inflation", "EU", null,published.atZone(ZoneId.of("Europe/Luxembourg")).toLocalDate(),"Europe/Luxembourg","Eurostat",url,"EURO_AREA_MACRO","RELEASED",period.toString(),actual,null,previous,null,published,updated));
            }
        }
        return new Payload(deduplicate(stories),List.copyOf(releases),List.of());
    }
    private static String text(Element e, String name) { var n=e.getElementsByTagName(name); return n.getLength()==0 ? "" : n.item(0).getTextContent().strip(); }
    static String required(String s) { if (s == null || s.isBlank() || s.length()>2000) throw new IllegalArgumentException("Invalid source text"); return s.strip(); }
    static String safeUrl(String url) {
        URI uri=URI.create(required(url));
        if (!"https".equals(uri.getScheme()) || uri.getHost()==null || uri.getUserInfo()!=null || (uri.getPort()!=-1 && uri.getPort()!=443)) throw new IllegalArgumentException("Unsafe source link");
        return uri.normalize().toString();
    }
    static String officialUrl(String url, NewsProviders.Feed feed) {
        String safe=safeUrl(url);
        if (!URI.create(safe).getHost().equals(URI.create(feed.url()).getHost())) throw new IllegalArgumentException("Non-official link");
        return safe;
    }
    public static List<Story> deduplicate(List<Story> rows) {
        var ids=new HashSet<String>(); var urls=new HashSet<String>(); var titles=new HashSet<String>(); var out=new ArrayList<Story>();
        for (var s: rows.stream().sorted(Comparator.comparing(Story::publishedAt).reversed()).toList()) {
            String canonical=s.url().replaceAll("([?&])(utm_[^=]+|fbclid|gclid)=[^&]*", "$1").replaceAll("[?&]+$", "").replaceAll("(?<!:)/{2,}","/");
            // Only exact normalized headlines from the same publisher and publication time coalesce.
            // Similar headlines at a different time may be substantive updates.
            String title=s.publisher()+"|"+s.publishedAt()+"|"+s.headline().toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]", "");
            String version="|"+s.publishedAt()+"|"+Objects.toString(s.sourceUpdatedAt(), "")+"|"+s.headline();
            if (ids.add(s.publisher()+"|"+s.id()+version) && urls.add(canonical+version) && titles.add(title)) out.add(s);
        }
        return List.copyOf(out);
    }
    public static Payload calendar(NewsProviders.Feed feed, String body) {
        String text=body;
        if (text.startsWith("BEGIN:VCALENDAR\\r\\n")) text=text.replace("\\r\\n", "\n");
        if (feed.id().equals("bea-calendar")) return BeaCalendarParser.parse(feed, text);
        var source=feed.region().equals("EU") ? OfficialEvent.Source.EUROSTAT : OfficialEvent.Source.BLS;
        var parsed=new OfficialCalendarParser().parse(source,text,Instant.EPOCH);
        return Payload.events(parsed.stream().map(e -> new Event(feed.id()+":"+e.eventId(),e.name(),feed.region(),e.scheduledAt(),e.scheduledDate(),e.sourceTimezone(),feed.provider(),
            e.sourceUrl(),
            feed.region().equals("EU") ? "EURO_AREA_MACRO" : "US_MACRO", e.status().name(), null,null,null,null,null,null,e.sourceModifiedAt())).toList());
    }
    public static Payload observations(NewsProviders.Feed feed, JsonNode root) {
        return feed.id().startsWith("bls-") ? bls(feed,root) : eurostat(feed,root);
    }
    static Payload bls(NewsProviders.Feed feed, JsonNode root) {
        var measure=feed.id().equals("bls-cpi") ? OfficialResultParser.Measure.BLS_CPI_INDEX : OfficialResultParser.Measure.BLS_UNEMPLOYMENT;
        TreeSet<YearMonth> periods=new TreeSet<>();
        for(var series:root.path("Results").path("series")) if(measure.series.equals(series.path("seriesID").asText()))
            for(var item:series.path("data")) if(item.path("period").asText().matches("M(0[1-9]|1[0-2])"))
                periods.add(YearMonth.of(Integer.parseInt(item.path("year").asText()),Integer.parseInt(item.path("period").asText().substring(1))));
        if(periods.isEmpty()) throw new IllegalArgumentException("No verified BLS observation");
        YearMonth period=periods.last(); var parser=new OfficialResultParser();
        var value=parser.parse(measure,period,root);
        String adjustment=measure==OfficialResultParser.Measure.BLS_CPI_INDEX ? "NSA" : "SA";
        Figure actual=new Figure(new BigDecimal(value.actual()),measure.series,period.toString(),measure.unit,adjustment);
        Figure previous=periods.contains(period.minusMonths(1)) ? new Figure(new BigDecimal(parser.parse(measure,period.minusMonths(1),root).actual()),measure.series,period.minusMonths(1).toString(),measure.unit,adjustment) : null;
        return Payload.observations(List.of(new Observation(feed.id(),measure.label,"US","BLS",feed.url(),actual,previous,null,value.notes())));
    }
    static Payload eurostat(NewsProviders.Feed feed, JsonNode root) {
        Map<String,String> expected=Map.of("freq","M","unit","PC_ACT","s_adj","SA","age","TOTAL","sex","T","geo","EU27_2020");
        if(!"ESTAT".equals(root.path("source").asText()) || !"dataset".equals(root.path("class").asText()) || !"UNE_RT_M".equals(root.path("extension").path("id").asText()) || root.path("id").size()!=7)
            throw new IllegalArgumentException("Unexpected Eurostat series");
        var dimensions=new HashSet<String>();
        for(int i=0;i<7;i++) {
            String dim=root.path("id").get(i).asText(); if(!dimensions.add(dim)) throw new IllegalArgumentException("Duplicate dimension");
            if(dim.equals("time")) continue;
            var index=root.path("dimension").path(dim).path("category").path("index");
            if(!expected.containsKey(dim) || root.path("size").get(i).asInt()!=1 || index.size()!=1 || index.path(expected.get(dim)).asInt(-1)!=0)
                throw new IllegalArgumentException("Eurostat dimensions mismatch");
        }
        var timeIndex=root.path("dimension").path("time").path("category").path("index");
        TreeMap<YearMonth,Integer> periods=new TreeMap<>();
        timeIndex.fields().forEachRemaining(e->periods.put(YearMonth.parse(e.getKey()),e.getValue().asInt()));
        if(periods.isEmpty() || periods.size()>2) throw new IllegalArgumentException("Unexpected periods");
        var period=periods.lastKey(); String series="une_rt_m:EU27_2020:T:TOTAL:PC_ACT:SA";
        Figure actual=new Figure(number(root.path("value"),periods.get(period)),series,period.toString(),"% of labour force","SA");
        if(actual.value()==null) throw new IllegalArgumentException("No verified Eurostat observation");
        Figure previous=null;
        if(periods.containsKey(period.minusMonths(1))) previous=new Figure(number(root.path("value"),periods.get(period.minusMonths(1))),series,period.minusMonths(1).toString(),actual.unit(),"SA");
        Instant updated=OffsetDateTime.parse(root.path("updated").asText(),DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ssXX")).toInstant();
        String flag=cell(root.path("status"),periods.get(period)).asText("");
        return Payload.observations(List.of(new Observation(feed.id(),"EU27 unemployment rate, total, seasonally adjusted","EU","Eurostat","https://ec.europa.eu/eurostat/databrowser/view/une_rt_m/default/table",actual,previous,updated,flag)));
    }
    static JsonNode cell(JsonNode values,int index) { return values.isArray()?values.path(index):values.path(String.valueOf(index)); }
    static BigDecimal number(JsonNode values,int index) { var value=cell(values,index); if(value.isNull()||value.isMissingNode())return null; var n=new BigDecimal(value.asText());if(n.precision()>30)throw new IllegalArgumentException("Invalid number");return n; }
    public static Payload marketaux(NewsProviders.Feed feed, JsonNode root) {
        if(!root.path("data").isArray() || root.has("error"))throw new IllegalArgumentException("Invalid news result");
        List<Story> rows=new ArrayList<>();
        for(var item:root.path("data")) {
            String headline=required(item.path("title").asText()); var entities=new HashSet<String>();
            for(var entity:item.path("entities"))if("equity".equals(entity.path("type").asText())) entities.add(entity.path("symbol").asText());
            String lower=headline.toLowerCase(Locale.ROOT);
            String category=feed.id().equals("marketaux-germany") && (lower.contains("dax index")||lower.contains("german equities")) ? "GERMAN_EQUITIES"
                : (lower.contains("nasdaq-100")||lower.contains("technology sector")) ? "TECHNOLOGY_SECTOR" : "DIRECT_INSTRUMENT";
            rows.add(new Story(required(item.path("uuid").asText()),headline,required(item.path("source").asText()),safeUrl(item.path("url").asText()),Instant.parse(item.path("published_at").asText()),null,null,category,Set.copyOf(entities)));
        }
        return Payload.news(deduplicate(rows));
    }
}
