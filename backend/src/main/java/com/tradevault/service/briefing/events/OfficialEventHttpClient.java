package com.tradevault.service.briefing.events;

import org.springframework.stereotype.Component;
import java.net.*;
import java.nio.charset.StandardCharsets;

@Component
public class OfficialEventHttpClient {
    public String get(String url) {
        if(!(url.equals(OfficialEvent.Source.BLS.calendarUrl) || url.equals(OfficialEvent.Source.EUROSTAT.calendarUrl)
            || url.matches("https://api\\.bls\\.gov/publicAPI/v1/timeseries/data/[A-Z0-9]+")
            || url.startsWith("https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/une_rt_m?")))
            throw new IllegalArgumentException("Source endpoint is not allowlisted");
        HttpURLConnection connection=null;
        try {
            connection=(HttpURLConnection)URI.create(url).toURL().openConnection();
            connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(4000);connection.setReadTimeout(6000);
            connection.setRequestProperty("User-Agent","TradeJAudit-OfficialEvents/1.0");
            connection.setRequestProperty("Accept","text/calendar,application/json,text/plain");
            int status=connection.getResponseCode();
            if(status!=200)throw new IllegalStateException("Official source HTTP "+status+"; prior suggestions retained");
            try(var body=connection.getInputStream()) {
                byte[] bytes=body.readNBytes(2_000_001);
                if(bytes.length>2_000_000)throw new IllegalStateException("Official response exceeds size limit");
                return new String(bytes,StandardCharsets.UTF_8);
            }
        } catch(java.io.IOException e) {throw new IllegalStateException("Official source unavailable; prior suggestions retained");}
        finally {if(connection!=null)connection.disconnect();}
    }
}
