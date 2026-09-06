package com.tradevault.controller;
import com.tradevault.service.*;
import com.tradevault.dto.strategy.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.util.*;

@RestController
@RequestMapping("/api/strategies/mentor")
@RequiredArgsConstructor
public class MentorStrategyAdoptionController {
    private final StrategyService strategies;
    private final CurrentUserService users;
    private final JdbcTemplate jdbc;
    @PostMapping("/seed")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public void seed() throws java.io.IOException {
        jdbc.queryForObject("SELECT id FROM users WHERE id=? FOR UPDATE",UUID.class,users.getCurrentUser().getId());
        var resource=new org.springframework.core.io.ClassPathResource("db/migration/V66__mentor_intraday_templates.sql");
        try(var stream=resource.getInputStream()) {
            String sql=new String(stream.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);
            jdbc.execute(sql.substring(0,sql.indexOf("CREATE TABLE mentor_strategy_adoptions")));
        }
    }
    @PostMapping("/{id}/adopt")
    @Transactional
    public StrategyResponse adopt(@PathVariable UUID id, @RequestParam(defaultValue="en") String lang,
                                   @RequestParam(defaultValue="false") boolean restore) {
        UUID user = users.getCurrentUser().getId();
        jdbc.queryForObject("SELECT id FROM users WHERE id=? FOR UPDATE",UUID.class,user);
        var list = strategies.listStrategies(true,lang);
        var existing=jdbc.queryForList("SELECT strategy_id FROM mentor_strategy_adoptions WHERE user_id=? AND content_id=?",UUID.class,user,id);
        if(!existing.isEmpty()) {
            var personal=list.getMyStrategies().stream().filter(s->s.getId().equals(existing.get(0))).findFirst().orElseThrow();
            if(restore && personal.isArchived()) {
                // Restore only visibility: never write a stale full copy over a concurrent personal edit.
                jdbc.update("UPDATE user_strategies SET archived=false,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",personal.getId(),user);
                return personal.toBuilder().archived(false).build();
            }
            return personal;
        }
        var source=list.getMentorStrategies().stream().filter(s->s.getId().equals(id)).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Published Mentor strategy not found"));
        var personal=strategies.createMyStrategy(copy(source));
        jdbc.update("INSERT INTO mentor_strategy_adoptions(user_id,content_id,strategy_id) VALUES (?,?,?)",user,id,personal.getId());
        return personal;
    }
    private StrategyRequest copy(StrategyResponse source) {
        var request=new StrategyRequest(); request.setName(source.getName()); request.setModel(source.getModel());
        request.setEntryConditionsRich(source.getEntryConditionsRich()); request.setEntryConditions(source.getEntryConditions());
        request.setInvalidationLogic(source.getInvalidationLogic()); request.setTpFramework(source.getTpFramework());
        request.setNoTradeRules(source.getNoTradeRules()); request.setSessionSuitability(source.getSessionSuitability()); request.setTags(source.getTags()); request.setArchived(false);
        return request;
    }
}
