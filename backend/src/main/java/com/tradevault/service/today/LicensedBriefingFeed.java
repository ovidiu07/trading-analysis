package com.tradevault.service.today;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import java.time.*;
import java.util.*;

/** Adapter contract for an operator's authorized news/calendar/macro feed; disabled by default. */
@Service
@RequiredArgsConstructor
public class LicensedBriefingFeed {
 private final ObjectMapper mapper;
 @Value("${TODAY_MARKET_FEED_URL:}") private String url;
 @Value("${TODAY_MARKET_FEED_TOKEN:}") private String token;
 @Value("${TODAY_MARKET_FEED_DISPLAY_AUTHORIZED:false}") private boolean authorized;
 public JsonNode load(Instant asOf,String session) {
  var result=mapper.createObjectNode().put("status","unavailable");
  if(url.isBlank() || !authorized) return result.put("reason","AUTHORIZED_MARKET_FEED_NOT_CONFIGURED");
  try {
   if(!url.startsWith("https://")) throw new IllegalArgumentException("HTTPS required");
   var factory=new org.springframework.http.client.SimpleClientHttpRequestFactory();factory.setConnectTimeout(3000);factory.setReadTimeout(7000);
   var headers=new HttpHeaders();if(!token.isBlank()) headers.setBearerAuth(token);
   String endpoint=UriComponentsBuilder.fromHttpUrl(url).queryParam("asOf",asOf.toString()).queryParam("session",session).toUriString();
   var response=new RestTemplate(factory).exchange(endpoint,HttpMethod.GET,new HttpEntity<>(headers),String.class).getBody();
   if(response==null || response.length()>500000) throw new IllegalArgumentException("Invalid response size");
   return normalize(mapper.readTree(response),asOf);
  }catch(Exception ignored){return result.put("reason","MARKET_FEED_TIMEOUT_OR_INVALID_RESPONSE");}
 }
 public JsonNode normalize(JsonNode input,Instant asOf) {
  var output=mapper.createObjectNode().put("status","available");
  for(String category:List.of("news","events","macro")) {
   var result=output.putArray(category);
   var candidates=new ArrayList<JsonNode>();
   for(var item:input.path(category)) {
    try {
     if(!item.path("source").isTextual() || item.path("source").asText().isBlank() || !item.path("url").asText().startsWith("https://")) continue;
     if(Instant.parse(item.path("availableAt").asText()).isAfter(asOf)) continue;
     if(category.equals("news") && (Instant.parse(item.path("time").asText()).isAfter(asOf) || Instant.parse(item.path("time").asText()).isBefore(asOf.minus(Duration.ofDays(3))))) continue;
     if(category.equals("macro") && Instant.parse(item.path("time").asText()).isAfter(asOf)) continue;
     if(category.equals("events") && (!Instant.parse(item.path("time").asText()).atZone(ZoneId.of("Europe/Bucharest")).toLocalDate().equals(asOf.atZone(ZoneId.of("Europe/Bucharest")).toLocalDate()))) continue;
     candidates.add(item);
    }catch(RuntimeException ignored){ /* An invalid timestamp cannot be evidence. */ }
   }
   candidates.sort(Comparator.comparing(x->x.path("time").asText()));
   if(category.equals("news")) Collections.reverse(candidates);
   Set<String> seen=new HashSet<>();
   for(var item:candidates) {
    if(result.size()>=(category.equals("news") ? 5 : 30)) break;
    var row=mapper.createObjectNode();
    for(String field:List.of("source","url","time","availableAt","title","relevance","name","benchmark","unit"))
     if(item.path(field).isTextual() && item.path(field).asText().length()<=2000) row.put(field,item.path(field).asText());
    if(category.equals("events")) {
     boolean future=Instant.parse(item.path("time").asText()).isAfter(asOf); row.put("phase",future ? "upcoming":"published");
     for(String field:List.of("forecast","previous","actual")) if((!future || !field.equals("actual")) && item.path(field).isNumber()) row.set(field,item.get(field));
    }else if(category.equals("macro")) {
     String name=item.path("name").asText();
     if(!Set.of("Brent","WTI","DXY","US 2Y","US 10Y","DE 2Y","DE 10Y").contains(name) || !seen.add(name) || !item.path("value").isNumber()) continue;
     boolean yield=name.matches("(US|DE) (2Y|10Y)");
     if(yield && !item.path("unit").asText().equals("%")) continue;
     row.set("value",item.get("value"));
     if(item.path("referenceValue").isNumber() && item.path("referenceTime").isTextual() && !Instant.parse(item.path("referenceTime").asText()).isAfter(Instant.parse(item.path("time").asText()))) {
      row.set("referenceValue",item.get("referenceValue"));row.set("referenceTime",item.get("referenceTime"));
      row.put("change",(item.path("value").asDouble()-item.path("referenceValue").asDouble())*(yield ? 100:1));row.put("changeUnit",yield ? "bps":item.path("unit").asText());
     }
     String status=item.path("status").asText(); if(!Set.of("live","delayed","close","stale").contains(status)) status="unavailable";
     long age=Duration.between(Instant.parse(item.path("time").asText()),asOf).toMinutes();
     if((status.equals("live") && age>5) || (status.equals("delayed") && age>30) || age>4*1440) status="stale";
     row.put("status",status);
    }
    result.add(row);
   }
  }
  var futures=input.path("esHourly");
  if (futures.path("contract").asText().matches("ES[HMUZ][0-9]{2,4}") && futures.path("source").isTextual() && futures.path("url").asText().startsWith("https://")) {
   var series=output.putObject("esHourly"); series.put("contract",futures.path("contract").asText()); series.put("source",futures.path("source").asText()); series.put("url",futures.path("url").asText());
   var bars=series.putArray("bars"); Set<String> timestamps=new HashSet<>();
   for(var bar:futures.path("bars")) {
    if(bars.size()>=2000) break;
    try {
     Instant time=Instant.parse(bar.path("time").asText());
     if(time.plusSeconds(3600).isAfter(asOf) || Instant.parse(bar.path("availableAt").asText()).isAfter(asOf) || !futures.path("contract").asText().equals(bar.path("contract").asText())) continue;
     if(!bar.path("open").isNumber() || !bar.path("high").isNumber() || !bar.path("low").isNumber() || !bar.path("close").isNumber()) continue;
     double high=bar.path("high").asDouble(),low=bar.path("low").asDouble(),open=bar.path("open").asDouble(),close=bar.path("close").asDouble();
     if(low<=0 || high<low || open<low || open>high || close<low || close>high || !timestamps.add(time.toString())) continue;
     var row=bars.addObject();row.put("time",time.toString());for(String field:List.of("open","high","low","close")) row.set(field,bar.get(field));
    }catch(RuntimeException ignored){ /* Invalid/future bars cannot support a numerical estimate. */ }
   }
  }
  return output;
 }
}
