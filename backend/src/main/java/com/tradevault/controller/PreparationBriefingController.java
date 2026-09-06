package com.tradevault.controller;

import com.tradevault.service.CurrentUserService;
import com.tradevault.service.backtest.BacktestProviderService;
import com.tradevault.service.backtest.OandaCandleProvider;
import com.tradevault.service.today.BriefingMath;
import com.tradevault.domain.enums.BacktestTimeframe;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.*;
import java.util.*;

@RestController
@RequestMapping("/api/today/briefing")
@RequiredArgsConstructor
public class PreparationBriefingController {
    private final CurrentUserService users;
    private final BacktestProviderService providers;
    private final OandaCandleProvider oanda;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final com.tradevault.service.today.MarketCoachGenerator coach;
    private final com.tradevault.service.today.LicensedBriefingFeed feed;
    @GetMapping("/version/{id}")
    public JsonNode version(@PathVariable UUID id) {
        var rows=jdbc.queryForList("SELECT payload::text FROM preparation_briefings WHERE id=? AND user_id=?",String.class,id,users.getCurrentUser().getId());
        if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Briefing not found");
        try { return mapper.readTree(rows.get(0)); } catch(Exception ex) { throw new IllegalStateException(ex); }
    }
    @PostMapping("/{date}")
    public synchronized JsonNode load(@PathVariable LocalDate date, @RequestParam String session, @RequestParam(defaultValue="false") boolean refresh) {
        if (!Set.of("ASIA","LONDON").contains(session)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid briefing session");
        UUID user = users.getCurrentUser().getId();
        if (!refresh) {
            var previous=jdbc.queryForList("SELECT payload::text FROM preparation_briefings WHERE user_id=? AND reference_date=? AND session_key=? ORDER BY created_at DESC LIMIT 1",String.class,user,date,session);
            if (!previous.isEmpty()) { try { return mapper.readTree(previous.get(0)); } catch(Exception ex) { throw new IllegalStateException(ex); } }
        }
        Instant reference=BriefingMath.reference(date,Instant.now());
        var root=mapper.createObjectNode(); UUID id=UUID.randomUUID(); root.put("id",id.toString()); root.put("asOf",reference.toString()); root.put("session",session);
        root.put("window",session.equals("ASIA") ? "09:00–15:00 Asia/Tokyo" : "08:00–16:00 Europe/London (complete H1 bars)");
        root.put("newsStatus","unavailable"); root.put("calendarStatus","unavailable"); root.put("macroStatus","unavailable"); root.put("aiStatus","unavailable");
        var instruments=root.putArray("instruments");
        String token=null,source=null;
        try { token=providers.requireOandaToken(user); source=providers.resolveOandaSourceId(user); } catch(RuntimeException ignored) { /* Explicit unavailable response below. */ }
        for (String symbol:List.of("GER40","NAS100","ES")) {
            var item=instruments.addObject(); item.put("symbol",symbol); item.put("type",symbol.equals("ES") ? "FUTURES" : "CFD"); item.put("source",symbol.equals("ES") ? "unavailable" : "OANDA");
            item.put("providerSymbol",symbol.equals("GER40") ? "DE30_EUR" : symbol.equals("NAS100") ? "NAS100_USD" : "ES contract unavailable");
            if (token==null || symbol.equals("ES")) { item.put("status","unavailable"); item.put("reason",symbol.equals("ES") ? "NO_ES_FUTURES_PROVIDER" : "OANDA_NOT_CONNECTED"); continue; }
            try {
                var candles=oanda.getCandles(token,source,symbol,symbol,BacktestTimeframe.H1,reference.minus(Duration.ofDays(45)).atOffset(ZoneOffset.UTC),reference.atOffset(ZoneOffset.UTC));
                item.setAll((com.fasterxml.jackson.databind.node.ObjectNode) mapper.valueToTree(BriefingMath.summarize(candles,symbol,session,reference)));
            } catch(RuntimeException ex) { item.put("status","unavailable"); item.put("reason","OANDA_REQUEST_FAILED"); }
        }
        var external=feed.load(reference,session);
        if(external.has("esHourly")) {
            var future=external.path("esHourly");
            var bars=new ArrayList<com.tradevault.service.backtest.CanonicalCandle>();
            for(var bar:future.path("bars")) bars.add(new com.tradevault.service.backtest.CanonicalCandle(null,future.path("source").asText(),future.path("contract").asText(),future.path("contract").asText(),BacktestTimeframe.H1,OffsetDateTime.parse(bar.path("time").asText()),bar.path("open").decimalValue(),bar.path("high").decimalValue(),bar.path("low").decimalValue(),bar.path("close").decimalValue(),java.math.BigDecimal.ZERO));
            var item=(com.fasterxml.jackson.databind.node.ObjectNode)instruments.get(2);
            item.setAll((com.fasterxml.jackson.databind.node.ObjectNode)mapper.valueToTree(BriefingMath.summarize(bars,future.path("contract").asText(),session,reference)));
            item.put("source",future.path("source").asText());item.put("providerSymbol",future.path("contract").asText());item.put("contract",future.path("contract").asText());item.put("sourceUrl",future.path("url").asText());
            if(item.has("close")) item.remove("reason");
            ((com.fasterxml.jackson.databind.node.ObjectNode)external).remove("esHourly");
        }
        root.set("contextFeed",external);
        root.set("coach",coach.generate(root));
        jdbc.update("INSERT INTO preparation_briefings(id,user_id,reference_date,session_key,payload) VALUES (?,?,?,?,?::jsonb)",id,user,date,session,root.toString());
        return root;
    }
}
