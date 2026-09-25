package com.tradevault.service.briefing.events;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.*;

public class OfficialResultParser {
    public enum Measure {
        BLS_UNEMPLOYMENT(OfficialEvent.Source.BLS,"LNS14000000","US unemployment rate, seasonally adjusted","%"),
        BLS_CPI_INDEX(OfficialEvent.Source.BLS,"CUUR0000SA0","US CPI-U all items, not seasonally adjusted","index, 1982–84=100"),
        EUROSTAT_EU_UNEMPLOYMENT(OfficialEvent.Source.EUROSTAT,"une_rt_m","EU27 unemployment rate, total, seasonally adjusted","% of labour force");
        public final OfficialEvent.Source source;
        public final String series,label,unit;
        Measure(OfficialEvent.Source source,String series,String label,String unit){this.source=source;this.series=series;this.label=label;this.unit=unit;}
        public String url(YearMonth period) {
            return source==OfficialEvent.Source.BLS?"https://api.bls.gov/publicAPI/v1/timeseries/data/"+series
                :"https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/une_rt_m?lang=EN&freq=M&unit=PC_ACT&s_adj=SA&age=TOTAL&sex=T&geo=EU27_2020&time="+period;
        }
    }
    public record Value(String actual,String notes) {}
    public Value parse(Measure measure,YearMonth period,JsonNode json) {
        if(measure.source==OfficialEvent.Source.BLS) {
            if(!"REQUEST_SUCCEEDED".equals(json.path("status").asText()) || !json.path("message").isEmpty())throw new IllegalArgumentException("BLS API returned an error or warning");
            List<JsonNode> matches=new ArrayList<>();
            for(var series:json.path("Results").path("series"))if(measure.series.equals(series.path("seriesID").asText()))
                for(var item:series.path("data"))if(item.path("year").asText().equals(String.valueOf(period.getYear()))
                    && item.path("period").asText().equals("M%02d".formatted(period.getMonthValue())))matches.add(item);
            if(matches.size()!=1)throw new IllegalArgumentException("Requested BLS observation unavailable or ambiguous");
            var row=matches.getFirst();StringBuilder notes=new StringBuilder("Latest API vintage; not a historical first-release value. BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov.");
            for(var foot:row.path("footnotes"))if(!foot.path("text").asText().isBlank())notes.append(" ").append(foot.path("text").asText());
            if(notes.length()>1000)throw new IllegalArgumentException("BLS footnotes exceed supported size");
            return new Value(number(row.path("value")),notes.toString());
        }
        Map<String,String> expected=Map.of("freq","M","unit","PC_ACT","s_adj","SA","age","TOTAL","sex","T","geo","EU27_2020","time",period.toString());
        if(!"ESTAT".equals(json.path("source").asText()) || !"dataset".equals(json.path("class").asText())
            || !"UNE_RT_M".equalsIgnoreCase(json.path("extension").path("id").asText()) || json.path("id").size()!=expected.size())
            throw new IllegalArgumentException("Unexpected Eurostat dataset provenance");
        Set<String> dimensions=new HashSet<>();
        for(int i=0;i<json.path("id").size();i++) {
            String dim=json.path("id").get(i).asText(); var index=json.path("dimension").path(dim).path("category").path("index");
            if(!dimensions.add(dim) || !expected.containsKey(dim) || json.path("size").path(i).asInt()!=1
                || index.size()!=1 || !index.has(expected.get(dim)) || index.path(expected.get(dim)).asInt(-1)!=0)
                throw new IllegalArgumentException("Eurostat dimensions do not match the reviewed observation");
        }
        var value=json.path("value"); var cell=value.isArray()?value.path(0):value.path("0");
        String flag=json.path("status").isArray()?json.path("status").path(0).asText(""):json.path("status").path("0").asText("");
        return new Value(number(cell),"Source: Eurostat. Latest API vintage; not a historical first-release value."+(flag.isBlank()?"":" Official observation flag: "+flag));
    }
    private String number(JsonNode value) {
        if(value.isMissingNode() || value.isNull())throw new IllegalArgumentException("Official observation unavailable");
        try {var n=new BigDecimal(value.asText()); if(n.precision()>30)throw new NumberFormatException();return n.toPlainString();}
        catch(NumberFormatException e){throw new IllegalArgumentException("Official observation is not numeric");}
    }
}
