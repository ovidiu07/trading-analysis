package com.tradevault.service.marketdata;

import com.tradevault.dto.market.MarketWorkspaceResponse.*;
import com.tradevault.service.briefing.events.OfficialEventHttpClient;
import org.springframework.stereotype.Service;
import java.time.*;
import java.math.BigDecimal;
import java.util.*;
import javax.xml.stream.*;

/** Unmodified daily EUR references. Never a quote, candle, conversion or risk input. */
@Service
public class EcbReferenceProvider {
    private final OfficialEventHttpClient http;
    private Clock clock=Clock.systemUTC();
    private Instant nextAttempt=Instant.MIN;
    private Instant lastAttempt=Instant.MIN;
    private List<MacroObservation> retained=List.of();
    private boolean failed;
    public EcbReferenceProvider(OfficialEventHttpClient http) {this.http=http;}
    public synchronized List<MacroObservation> latest() {
        Instant now=clock.instant();
        if(!now.isBefore(nextAttempt)) {
            lastAttempt=now;nextAttempt=now.plusSeconds(900);
            try {retained=parse(http.get(OfficialReferenceHttp.ECB),now);failed=false;nextAttempt=now.plusSeconds(3600);}
            catch(Exception e) {failed=true;}
        }
        if(retained.isEmpty()) return List.of(observation("USD",null,null,lastAttempt,Freshness.UNAVAILABLE,AvailabilityReason.UPSTREAM_ERROR), observation("GBP",null,null,lastAttempt,Freshness.UNAVAILABLE,AvailabilityReason.UPSTREAM_ERROR));
        return retained.stream().map(r -> observation(r.providerSymbol(),r.value(),r.observationDate(),r.retrievedAt().toInstant(),
            failed || r.observationDate().isBefore(now.atZone(ZoneOffset.UTC).toLocalDate().minusDays(4)) ? Freshness.STALE : Freshness.CLOSE,
            failed ? AvailabilityReason.UPSTREAM_ERROR : null)).toList();
    }
    static List<MacroObservation> parse(String xml,Instant now) throws Exception {
        var f=XMLInputFactory.newFactory();f.setProperty(XMLInputFactory.SUPPORT_DTD,false);f.setProperty("javax.xml.stream.isSupportingExternalEntities",false);
        var reader=f.createXMLStreamReader(new java.io.StringReader(xml));
        LocalDate date=null;Map<String,BigDecimal> rates=new HashMap<>();
        try {
            while(reader.hasNext()) {
                int event=reader.next();
                if(event==XMLStreamConstants.DTD)throw new IllegalArgumentException("DTD forbidden");
                if(event!=XMLStreamConstants.START_ELEMENT || !"Cube".equals(reader.getLocalName()) || !"http://www.ecb.int/vocabulary/2002-08-01/eurofxref".equals(reader.getNamespaceURI()))continue;
                String time=reader.getAttributeValue(null,"time"),currency=reader.getAttributeValue(null,"currency");
                if(time!=null) {if(date!=null)throw new IllegalArgumentException("Multiple reference dates");date=LocalDate.parse(time);}
                if(Set.of("USD","GBP").contains(currency==null?"":currency)) {
                    BigDecimal rate=new BigDecimal(reader.getAttributeValue(null,"rate"));
                    if(date==null || rate.signum()<=0 || rate.precision()>16 || rates.put(currency,rate)!=null)throw new IllegalArgumentException("Invalid reference rate");
                }
            }
        } finally {reader.close();}
        if(date==null || date.isAfter(now.atZone(ZoneId.of("Europe/Berlin")).toLocalDate()) || rates.size()!=2)throw new IllegalArgumentException("Incomplete daily reference");
        LocalDate observed=date;
        return List.of("USD","GBP").stream().map(c -> observation(c,rates.get(c),observed,now,Freshness.CLOSE,null)).toList();
    }
    private static MacroObservation observation(String currency,BigDecimal value,LocalDate date,Instant retrieved,Freshness freshness,AvailabilityReason reason) {
        return new MacroObservation("ECB_EUR_"+currency,"ECB",currency,"FX_REFERENCE","OFFICIAL_DAILY_REFERENCE",value,null,null,
            currency+" per EUR",date,retrieved.atOffset(ZoneOffset.UTC),freshness,"OFFICIAL_PUBLIC",OfficialReferenceHttp.ECB,reason);
    }
}
