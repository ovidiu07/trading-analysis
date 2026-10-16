package com.tradevault.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.tradevault.dto.strategy.StudioWriteRequest;
import com.tradevault.service.StrategyStudioService;
import com.tradevault.service.StrategyStudioService.*;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/strategies")
@RequiredArgsConstructor
public class StrategyStudioController {
    private final StrategyStudioService studio;

    @PostMapping("/studio")
    public StudioResponse create(@Valid @RequestBody StudioWriteRequest body) {
        return studio.create(body);
    }

    @GetMapping("/{id}/studio")
    public StudioResponse get(@PathVariable UUID id) {
        return studio.get(id);
    }

    @PutMapping("/{id}/studio")
    public StudioResponse save(@PathVariable UUID id, @Valid @RequestBody StudioWriteRequest body) {
        return studio.save(id, body);
    }

    @PostMapping("/{id}/duplicate")
    public StudioResponse duplicate(@PathVariable UUID id) {
        return studio.duplicate(id);
    }

    @GetMapping("/{id}/versions")
    public List<VersionSummary> history(@PathVariable UUID id) {
        return studio.history(id);
    }

    @GetMapping("/{id}/versions/{versionId}")
    public VersionDetail version(@PathVariable UUID id, @PathVariable UUID versionId) {
        return studio.version(id, versionId);
    }

    @PostMapping("/{id}/versions")
    public VersionDetail checkpoint(@PathVariable UUID id, @RequestBody CheckpointRequest body) {
        return studio.checkpoint(id, body);
    }

    @PostMapping("/{id}/versions/{versionId}/restore")
    public StudioResponse restore(
            @PathVariable UUID id, @PathVariable UUID versionId, @RequestBody RestoreRequest body) {
        return studio.restore(id, versionId, body);
    }

    @GetMapping("/{id}/export")
    public PortableDefinition export(@PathVariable UUID id) {
        return studio.export(id);
    }

    @PostMapping("/import")
    public StudioResponse importDefinition(@RequestBody JsonNode body) {
        return studio.importJson(body);
    }

    @GetMapping("/{id}/checklist-executions")
    public List<ExecutionResponse> executions(@PathVariable UUID id) {
        return studio.executions(id);
    }

    @PostMapping("/{id}/checklist-executions")
    public ExecutionResponse execute(@PathVariable UUID id, @RequestBody ExecutionRequest body) {
        return studio.execute(id, body);
    }

    @GetMapping("/{id}/studio/evidence")
    public EvidenceResponse evidence(@PathVariable UUID id) {
        return studio.evidence(id);
    }

    @PostMapping("/{id}/studio/trades")
    public void linkTrades(@PathVariable UUID id, @RequestBody TradeLinkRequest body) {
        studio.linkTrades(id, body);
    }
}
