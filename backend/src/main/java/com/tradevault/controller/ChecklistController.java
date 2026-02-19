package com.tradevault.controller;

import com.tradevault.dto.checklist.ChecklistTemplateItemResponse;
import com.tradevault.dto.checklist.ChecklistTemplateUpdateRequest;
import com.tradevault.dto.checklist.TodayChecklistResponse;
import com.tradevault.dto.checklist.TodayChecklistUpdateRequest;
import com.tradevault.service.checklist.ChecklistService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/me/checklist")
@RequiredArgsConstructor
public class ChecklistController {
    private final ChecklistService checklistService;

    @GetMapping("/template")
    public ResponseEntity<List<ChecklistTemplateItemResponse>> getTemplate() {
        return ResponseEntity.ok(checklistService.getTemplate());
    }

    @PutMapping("/template")
    public ResponseEntity<List<ChecklistTemplateItemResponse>> updateTemplate(@Valid @RequestBody ChecklistTemplateUpdateRequest request) {
        return ResponseEntity.ok(checklistService.updateTemplate(request));
    }

    @GetMapping("/today")
    public ResponseEntity<TodayChecklistResponse> getToday(@RequestParam(name = "tz", required = false) String timezone) {
        return ResponseEntity.ok(checklistService.getTodayChecklist(timezone));
    }

    @PutMapping("/today")
    public ResponseEntity<TodayChecklistResponse> updateToday(@Valid @RequestBody TodayChecklistUpdateRequest request) {
        return ResponseEntity.ok(checklistService.updateTodayChecklist(request));
    }
}
