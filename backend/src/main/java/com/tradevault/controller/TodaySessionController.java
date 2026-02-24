package com.tradevault.controller;

import com.tradevault.dto.session.ChecklistTemplateRequest;
import com.tradevault.dto.session.ChecklistTemplateResponse;
import com.tradevault.dto.session.SessionAutoTradeEventDto;
import com.tradevault.dto.session.SessionAutoJournalArmRequest;
import com.tradevault.dto.session.SessionAutoJournalStatusDto;
import com.tradevault.dto.session.SessionAutoTradeEventRequest;
import com.tradevault.dto.session.SessionLevelDto;
import com.tradevault.dto.session.SessionLevelRequest;
import com.tradevault.dto.session.SessionLevelSuggestionDto;
import com.tradevault.dto.session.SessionNarrativeDto;
import com.tradevault.dto.session.SessionNarrativeRequest;
import com.tradevault.dto.session.SessionPoolDto;
import com.tradevault.dto.session.SessionPoolRequest;
import com.tradevault.dto.session.SessionRoleSelectionRequest;
import com.tradevault.dto.session.TodaySessionActiveSweepLevelRequest;
import com.tradevault.dto.session.TodaySessionChecklistUpdateRequest;
import com.tradevault.dto.session.TodaySessionConfigRequest;
import com.tradevault.dto.session.TodaySessionLockInRequest;
import com.tradevault.dto.session.TodaySessionPlannedTickersRequest;
import com.tradevault.dto.session.TodaySessionResponse;
import com.tradevault.domain.enums.ChecklistTemplateType;
import com.tradevault.service.today.TodaySessionService;
import com.tradevault.service.today.SessionAutoJournalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TodaySessionController {
    private final TodaySessionService todaySessionService;
    private final SessionAutoJournalService sessionAutoJournalService;

    @GetMapping("/sessions/today")
    public TodaySessionResponse getTodaySession() {
        return todaySessionService.getTodaySession();
    }

    @PostMapping("/sessions/today")
    public TodaySessionResponse saveTodaySession(@Valid @RequestBody TodaySessionConfigRequest request) {
        return todaySessionService.saveTodaySessionConfig(request);
    }

    @PatchMapping("/sessions/today/plannedTickers")
    public TodaySessionResponse updatePlannedTickers(@RequestBody TodaySessionPlannedTickersRequest request) {
        return todaySessionService.updatePlannedTickers(request);
    }

    @PatchMapping("/sessions/today/checklist")
    public TodaySessionResponse updateChecklist(@RequestBody TodaySessionChecklistUpdateRequest request) {
        return todaySessionService.updateChecklist(request);
    }

    @PatchMapping("/sessions/today/lockIn")
    public TodaySessionResponse updateLockIn(@RequestBody TodaySessionLockInRequest request) {
        return todaySessionService.updateLockIn(request);
    }

    @GetMapping("/sessions/today/levels")
    public List<SessionLevelDto> listSessionLevels() {
        return todaySessionService.listSessionLevels();
    }

    @PostMapping("/sessions/today/levels")
    public TodaySessionResponse createSessionLevel(@RequestBody SessionLevelRequest request) {
        return todaySessionService.createSessionLevel(request);
    }

    @PutMapping("/sessions/today/levels/{id}")
    public TodaySessionResponse updateSessionLevel(@PathVariable UUID id, @RequestBody SessionLevelRequest request) {
        return todaySessionService.updateSessionLevel(id, request);
    }

    @DeleteMapping("/sessions/today/levels/{id}")
    public ResponseEntity<Void> deleteSessionLevel(@PathVariable UUID id) {
        todaySessionService.deleteSessionLevel(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/session/{sessionId}/levels")
    public List<SessionLevelDto> listSessionLevelsBySession(@PathVariable UUID sessionId,
                                                            @RequestParam(name = "symbol", required = false) String symbol) {
        return todaySessionService.listSessionLevels(sessionId, symbol);
    }

    @PostMapping("/session/{sessionId}/levels")
    public TodaySessionResponse createSessionLevelBySession(@PathVariable UUID sessionId,
                                                            @RequestBody SessionLevelRequest request) {
        return todaySessionService.createSessionLevel(sessionId, request);
    }

    @PutMapping("/session/{sessionId}/levels/{levelId}")
    public TodaySessionResponse updateSessionLevelBySession(@PathVariable UUID sessionId,
                                                            @PathVariable UUID levelId,
                                                            @RequestBody SessionLevelRequest request) {
        return todaySessionService.updateSessionLevel(sessionId, levelId, request);
    }

    @DeleteMapping("/session/{sessionId}/levels/{levelId}")
    public ResponseEntity<Void> deleteSessionLevelBySession(@PathVariable UUID sessionId,
                                                            @PathVariable UUID levelId) {
        todaySessionService.deleteSessionLevel(sessionId, levelId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/session/{sessionId}/levels/suggest")
    public List<SessionLevelSuggestionDto> suggestSessionLevels(@PathVariable UUID sessionId,
                                                                @RequestParam(name = "symbol", required = false) String symbol) {
        return todaySessionService.suggestSessionLevels(sessionId, symbol);
    }

    @GetMapping("/session/{sessionId}/pools")
    public List<SessionPoolDto> listSessionPools(@PathVariable UUID sessionId,
                                                 @RequestParam(name = "symbol", required = false) String symbol) {
        return todaySessionService.listSessionPools(sessionId, symbol);
    }

    @PostMapping("/session/{sessionId}/pools")
    public SessionPoolDto createSessionPool(@PathVariable UUID sessionId,
                                            @RequestBody SessionPoolRequest request) {
        return todaySessionService.createSessionPool(sessionId, request);
    }

    @PutMapping("/session/{sessionId}/pools/{poolId}")
    public SessionPoolDto updateSessionPool(@PathVariable UUID sessionId,
                                            @PathVariable UUID poolId,
                                            @RequestBody SessionPoolRequest request) {
        return todaySessionService.updateSessionPool(sessionId, poolId, request);
    }

    @DeleteMapping("/session/{sessionId}/pools/{poolId}")
    public ResponseEntity<Void> deleteSessionPool(@PathVariable UUID sessionId,
                                                  @PathVariable UUID poolId) {
        todaySessionService.deleteSessionPool(sessionId, poolId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/session/{sessionId}/narrative")
    public SessionNarrativeDto getSessionNarrative(@PathVariable UUID sessionId) {
        return todaySessionService.getSessionNarrative(sessionId);
    }

    @PutMapping("/session/{sessionId}/narrative")
    public SessionNarrativeDto updateSessionNarrative(@PathVariable UUID sessionId,
                                                      @RequestBody SessionNarrativeRequest request) {
        return todaySessionService.upsertSessionNarrative(sessionId, request);
    }

    @GetMapping("/session/{sessionId}/auto-trade/events")
    public List<SessionAutoTradeEventDto> listAutoTradeEvents(@PathVariable UUID sessionId) {
        return todaySessionService.listAutoTradeEvents(sessionId);
    }

    @PostMapping("/session/{sessionId}/auto-trade/events")
    public SessionAutoTradeEventDto logAutoTradeEvent(@PathVariable UUID sessionId,
                                                      @RequestBody SessionAutoTradeEventRequest request) {
        return todaySessionService.logAutoTradeEvent(sessionId, request);
    }

    @PostMapping("/session/{sessionId}/auto-journal/arm")
    public SessionAutoJournalStatusDto armAutoJournal(@PathVariable UUID sessionId,
                                                      @RequestBody SessionAutoJournalArmRequest request) {
        return sessionAutoJournalService.arm(sessionId, request);
    }

    @PostMapping("/session/{sessionId}/auto-journal/disarm")
    public SessionAutoJournalStatusDto disarmAutoJournal(@PathVariable UUID sessionId) {
        return sessionAutoJournalService.disarm(sessionId);
    }

    @GetMapping("/session/{sessionId}/auto-journal/status")
    public SessionAutoJournalStatusDto getAutoJournalStatus(@PathVariable UUID sessionId) {
        return sessionAutoJournalService.getStatus(sessionId);
    }

    @PutMapping("/session/{sessionId}/roles")
    public TodaySessionResponse setSessionRoles(@PathVariable UUID sessionId,
                                                @RequestBody SessionRoleSelectionRequest request) {
        return todaySessionService.setSessionRoles(sessionId, request);
    }

    @PatchMapping("/sessions/today/activeSweepLevel")
    public TodaySessionResponse setActiveSweepLevel(@RequestBody TodaySessionActiveSweepLevelRequest request) {
        return todaySessionService.setActiveSweepLevel(request);
    }

    @GetMapping("/checklistTemplates")
    public List<ChecklistTemplateResponse> listTemplates(@RequestParam(name = "type", required = false) ChecklistTemplateType type) {
        return todaySessionService.listChecklistTemplates(type);
    }

    @PostMapping("/checklistTemplates")
    public ChecklistTemplateResponse createTemplate(@Valid @RequestBody ChecklistTemplateRequest request) {
        return todaySessionService.createChecklistTemplate(request);
    }

    @PutMapping("/checklistTemplates/{id}")
    public ChecklistTemplateResponse updateTemplate(@PathVariable UUID id,
                                                    @Valid @RequestBody ChecklistTemplateRequest request) {
        return todaySessionService.updateChecklistTemplate(id, request);
    }

    @DeleteMapping("/checklistTemplates/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable UUID id) {
        todaySessionService.deleteChecklistTemplate(id);
        return ResponseEntity.noContent().build();
    }
}
