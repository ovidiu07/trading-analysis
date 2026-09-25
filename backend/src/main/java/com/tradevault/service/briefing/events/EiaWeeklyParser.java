package com.tradevault.service.briefing.events;

import com.fasterxml.jackson.databind.JsonNode;
import com.tradevault.service.briefing.BriefingDocument.EventStatus;
import com.tradevault.service.marketdata.OfficialReferenceHttp;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** Only the published US commercial crude stock level, excluding SPR. No price or consensus. */
public final class EiaWeeklyParser {
    public OfficialEvent parse(JsonNode root, Instant retrieved) {
        JsonNode meta=root.path("metadata"),series=root.path("data").path("U.S.");
        require("U.S. Energy Information Administration".equals(meta.path("source").asText())
            && "Weekly Petroleum Status Report".equals(meta.path("release_name").asText())
            && "Commercial Crude Oil Stocks (Excluding SPR)".equals(meta.path("data_description").asText())
            && "Weekly".equals(meta.path("periodicity").asText())
            && "WCESTUS1".equals(series.path("sourcekey").asText())
            && "thousand barrels".equals(series.path("units").asText()),"Unexpected EIA series or units");
        LocalDate release=LocalDate.parse(meta.path("release_date").asText());
        LocalTime time=LocalTime.parse(meta.path("release_time").asText().toUpperCase(Locale.ROOT),DateTimeFormatter.ofPattern("h:mm a",Locale.US));
        var local=release.atTime(time);var zone=ZoneId.of("America/New_York");
        require(zone.getRules().getValidOffsets(local).size()==1,"Ambiguous EIA publication time");
        Instant published=local.atZone(zone).toInstant();
        require(!published.isAfter(retrieved),"EIA publication is in the future; actual withheld");
        LocalDate period=LocalDate.parse(meta.path("time_period").path("end_date").asText());
        require(!period.isAfter(release),"Future EIA observation");
        JsonNode selected=null;
        require(series.path("time_series").isArray() && series.path("time_series").size()<=10000,"Invalid EIA observations");
        for(JsonNode row:series.path("time_series")) if(period.toString().equals(row.path("date").asText())) {
            require(selected==null,"Duplicate EIA observation");selected=row;
        }
        require(selected!=null && selected.has("suppression_flag") && selected.path("suppression_flag").isNull()
            && selected.path("value").isNumber(),"Missing or suppressed EIA observation");
        var value=selected.path("value").decimalValue();
        require(value.signum()>=0 && value.precision()<=16,"Invalid EIA stock level");
        String identity="WCESTUS1|"+period;
        return new OfficialEvent(OfficialEvent.Source.EIA,identity,identity,"EXACT_SERIES_PERIOD","US",
            "US commercial crude oil stocks excluding SPR",null,release,"America/New_York",OfficialReferenceHttp.EIA,retrieved,
            EventStatus.RELEASED,null,null,null,null,value.stripTrailingZeros().toPlainString(),"thousand barrels",published,
            OfficialReferenceHttp.EIA,OfficialReferenceHttp.EIA,"WCESTUS1",period.toString(),"US commercial crude oil stocks excluding SPR",
            "EIA weekly stock level, latest published vintage. Not a weekly change, forecast, oil price or futures quote.",retrieved);
    }
    private static void require(boolean condition,String message) {if(!condition)throw new IllegalArgumentException(message);}
}
