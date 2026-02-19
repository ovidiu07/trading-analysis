package com.tradevault.controller;

import com.tradevault.dto.session.ChecklistTemplateRequest;
import com.tradevault.dto.session.ChecklistTemplateResponse;
import com.tradevault.dto.session.TodaySessionChecklistUpdateRequest;
import com.tradevault.dto.session.TodaySessionConfigRequest;
import com.tradevault.dto.session.TodaySessionPlannedTickersRequest;
import com.tradevault.dto.session.TodaySessionResponse;
import com.tradevault.service.today.TodaySessionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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

    @GetMapping("/checklistTemplates")
    public List<ChecklistTemplateResponse> listTemplates() {
        return todaySessionService.listChecklistTemplates();
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
