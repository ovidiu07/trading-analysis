package com.tradevault.service.today;

import com.tradevault.service.backtest.CanonicalCandle;
import java.time.*;
import java.util.*;

/** Product session windows. No exchange-calendar or calibrated-probability claim. */
public final class BriefingMath {
    private BriefingMath() {}
    public static String select(Instant now, String previous, String manual) {
        if (manual != null) return manual;
        LocalTime time = now.atZone(ZoneId.of("Europe/Bucharest")).toLocalTime();
        if (time.getHour()*60+time.getMinute() <= 16*60) return "ASIA";
        return time.isBefore(LocalTime.of(16,15)) ? previous : "LONDON";
    }
    public static Instant reference(LocalDate date, Instant now) {
        Instant end = date.plusDays(1).atStartOfDay(ZoneId.of("Europe/Bucharest")).toInstant().minusNanos(1);
        return end.isBefore(now) ? end : now;
    }
    public static ZonedDateTime start(LocalDate date, String session) {
        return date.atTime(session.equals("ASIA") ? LocalTime.of(9,0) : LocalTime.of(8,0))
            .atZone(ZoneId.of(session.equals("ASIA") ? "Asia/Tokyo" : "Europe/London"));
    }
    public static Map<String,Object> summarize(List<CanonicalCandle> raw, String symbol, String session, Instant reference) {
        // Provider timestamps denote candle opens. Exclude all candles that close after the reference.
        var bars = raw.stream().filter(c -> symbol.equals(c.symbolCanonical()) && c.tsUtc() != null
            && !c.tsUtc().toInstant().plusSeconds(3600).isAfter(reference)).sorted(Comparator.comparing(CanonicalCandle::tsUtc)).toList();
        Map<LocalDate,List<CanonicalCandle>> grouped = new TreeMap<>();
        for (var bar : bars) {
            LocalDate date = bar.tsUtc().atZoneSameInstant(start(LocalDate.of(2026,1,1),session).getZone()).toLocalDate();
            if (date.getDayOfWeek()==DayOfWeek.SATURDAY || date.getDayOfWeek()==DayOfWeek.SUNDAY) continue;
            Instant begin = start(date,session).toInstant();
            // H1 bars cannot represent London's final half hour: use 08:00–16:00 explicitly.
            Instant end = begin.plusSeconds((session.equals("ASIA") ? 6 : 8)*3600L);
            if (!bar.tsUtc().toInstant().isBefore(begin) && !bar.tsUtc().toInstant().plusSeconds(3600).isAfter(end))
                grouped.computeIfAbsent(date, ignored -> new ArrayList<>()).add(bar);
        }
        if (grouped.isEmpty()) return Map.of("status", "unavailable", "reason", "NO_COMPLETED_HOURLY_BARS");
        LocalDate latest = grouped.keySet().stream().max(Comparator.naturalOrder()).orElseThrow();
        var current = grouped.get(latest);
        double high = current.stream().mapToDouble(c -> c.high().doubleValue()).max().orElseThrow();
        double low = current.stream().mapToDouble(c -> c.low().doubleValue()).min().orElseThrow();
        double open = current.get(0).open().doubleValue();
        var observation = current.get(current.size()-1);
        Map<String,Object> result = new LinkedHashMap<>();
        var lastAvailable = bars.get(bars.size()-1);
        result.put("latestAvailablePrice", lastAvailable.close());
        result.put("latestAvailableAt", lastAvailable.tsUtc().plusHours(1).toString());
        result.put("dataDate", latest.toString()); result.put("observedUntil", observation.tsUtc().plusHours(1).toString());
        result.put("status", observation.tsUtc().toInstant().plusSeconds(4*86400).isBefore(reference) ? "stale" : observation.tsUtc().toInstant().plusSeconds(7200).isBefore(reference) ? "close" : "delayed");
        result.put("open",open); result.put("high",high); result.put("low",low); result.put("close",observation.close());
        result.put("changeFromWindowOpen",observation.close().doubleValue()-open);
        int expected = session.equals("ASIA") ? 6 : 8;
        var history = grouped.entrySet().stream().filter(e -> e.getKey().isBefore(latest) && e.getValue().size()==expected).toList();
        var sample = history.subList(Math.max(0,history.size()-20),history.size());
        result.put("observations",sample.size()); result.put("horizon","FULL_ANALYSIS_WINDOW");
        result.put("method","Mean high-low width of last 20 complete comparable windows; symmetric envelope around window open. Not calibrated.");
        if (sample.size() < 14) { result.put("rangeStatus","unavailable"); result.put("rangeReason","MINIMUM_14_COMPLETE_WINDOWS_REQUIRED"); }
        else {
            double width=sample.stream().mapToDouble(e -> e.getValue().stream().mapToDouble(c -> c.high().doubleValue()).max().orElseThrow()-e.getValue().stream().mapToDouble(c -> c.low().doubleValue()).min().orElseThrow()).average().orElseThrow();
            result.put("rangeStatus","available"); result.put("lower",open-width/2); result.put("upper",open+width/2); result.put("width",width); result.put("percent",width/open*100);
            result.put("sampleFrom",sample.get(0).getKey().toString()); result.put("sampleTo",sample.get(sample.size()-1).getKey().toString());
        }
        return result;
    }
}
