package com.tradevault.service.briefing.events;

import com.tradevault.service.briefing.BriefingDocument;
import java.time.*;
import java.util.UUID;

/** A source observation, never a publication. Unknown times and values stay null. */
public record OfficialEvent(Source sourceId, String eventId, String sourceEventId, String identityBasis, String region, String name,
        Instant scheduledAt, LocalDate scheduledDate, String sourceTimezone, String sourceUrl,
        Instant retrievedAt, BriefingDocument.EventStatus status, Integer sourceSequence,
        Instant sourceModifiedAt, Instant previousScheduledAt, LocalDate previousScheduledDate,
        String actual, String unit, Instant publishedAt, String publicationSourceUrl,
        String resultSourceUrl, String seriesId, String referencePeriod, String measure, String notes, Instant resultRetrievedAt) {
    public enum Source {
        BLS("US", "America/New_York", "https://www.bls.gov/schedule/news_release/bls.ics"),
        EUROSTAT("EU", "Europe/Luxembourg", "https://ec.europa.eu/eurostat/o/calendars/eventsIcal?theme=0&category=2"),
        EIA("US", "America/New_York", "https://ir.eia.gov/wpsr/psw00.json");
        public final String region, timezone, calendarUrl;
        Source(String region, String timezone, String url) { this.region=region; this.timezone=timezone; this.calendarUrl=url; }
        public boolean owns(String url) {
            try {
                var uri=java.net.URI.create(url);
                return "https".equals(uri.getScheme()) && uri.getUserInfo()==null && uri.getPort()==-1
                    && (this==BLS ? java.util.Set.of("www.bls.gov","api.bls.gov").contains(uri.getHost())
                    : this==EIA ? java.util.Set.of("www.eia.gov","ir.eia.gov").contains(uri.getHost())
                    : "ec.europa.eu".equals(uri.getHost()) && uri.getPath().startsWith("/eurostat/"));
            } catch(Exception e) { return false; }
        }
    }
    public BriefingDocument.Event briefing(UUID revisionId) {
        return new BriefingDocument.Event("official-"+UUID.nameUUIDFromBytes((sourceId+"|"+eventId).getBytes(java.nio.charset.StandardCharsets.UTF_8)),
            scheduledAt, sourceTimezone, region, name, sourceId.name(), sourceUrl, actual, null, null, unit,
            notes, status, null, scheduledDate, publishedAt,
            new BriefingDocument.EventEvidence(sourceId.name(),eventId,sourceEventId,identityBasis,revisionId,retrievedAt,sourceSequence,
                sourceModifiedAt,previousScheduledAt,previousScheduledDate,publicationSourceUrl,resultSourceUrl,seriesId,referencePeriod,measure,resultRetrievedAt), null, null);
    }
    public OfficialEvent result(String value, String resultUnit, Instant publication, String publicationUrl,
                                String resultUrl, String series, String period, String resultMeasure, String resultNotes, Instant retrieved) {
        return new OfficialEvent(sourceId,eventId,sourceEventId,identityBasis,region,name,scheduledAt,scheduledDate,sourceTimezone,sourceUrl,retrieved,
            BriefingDocument.EventStatus.RELEASED,sourceSequence,sourceModifiedAt,previousScheduledAt,previousScheduledDate,
            value,resultUnit,publication,publicationUrl,resultUrl,series,period,resultMeasure,resultNotes,retrieved);
    }
    public OfficialEvent identity(String canonicalId) {
        return new OfficialEvent(sourceId,canonicalId,sourceEventId,identityBasis,region,name,scheduledAt,scheduledDate,sourceTimezone,sourceUrl,retrievedAt,
            status,sourceSequence,sourceModifiedAt,previousScheduledAt,previousScheduledDate,actual,unit,publishedAt,publicationSourceUrl,resultSourceUrl,seriesId,referencePeriod,measure,notes,resultRetrievedAt);
    }
}
