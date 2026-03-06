package com.tradevault.controller;

import com.tradevault.dto.session.SessionSetupReorderRequest;
import com.tradevault.dto.session.SessionSetupSelectionRequest;
import com.tradevault.dto.session.SessionSetupStatusRequest;
import com.tradevault.dto.session.SessionWorkspaceResponse;
import com.tradevault.dto.session.UpdateSessionWorkspaceRequest;
import com.tradevault.dto.session.UpsertSessionSetupRequest;
import com.tradevault.service.today.SessionWorkspaceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/today/session")
@RequiredArgsConstructor
public class SessionWorkspaceController {
    private final SessionWorkspaceService sessionWorkspaceService;

    @GetMapping("/workspace")
    public SessionWorkspaceResponse getWorkspace() {
        return sessionWorkspaceService.getWorkspace();
    }

    @PutMapping("/{sessionId}")
    public SessionWorkspaceResponse updateSession(@PathVariable UUID sessionId,
                                                  @RequestBody UpdateSessionWorkspaceRequest request) {
        return sessionWorkspaceService.updateSession(sessionId, request);
    }

    @PostMapping("/{sessionId}/setups")
    public SessionWorkspaceResponse createSetup(@PathVariable UUID sessionId,
                                                @RequestBody UpsertSessionSetupRequest request) {
        return sessionWorkspaceService.createSetup(sessionId, request);
    }

    @PutMapping("/{sessionId}/setups/{setupId}")
    public SessionWorkspaceResponse updateSetup(@PathVariable UUID sessionId,
                                                @PathVariable UUID setupId,
                                                @RequestBody UpsertSessionSetupRequest request) {
        return sessionWorkspaceService.updateSetup(sessionId, setupId, request);
    }

    @PostMapping("/{sessionId}/setups/{setupId}/duplicate")
    public SessionWorkspaceResponse duplicateSetup(@PathVariable UUID sessionId,
                                                   @PathVariable UUID setupId) {
        return sessionWorkspaceService.duplicateSetup(sessionId, setupId);
    }

    @PostMapping("/{sessionId}/setups/reorder")
    public SessionWorkspaceResponse reorderSetups(@PathVariable UUID sessionId,
                                                  @RequestBody SessionSetupReorderRequest request) {
        return sessionWorkspaceService.reorderSetups(sessionId, request);
    }

    @PostMapping("/{sessionId}/setups/{setupId}/status")
    public SessionWorkspaceResponse updateSetupStatus(@PathVariable UUID sessionId,
                                                      @PathVariable UUID setupId,
                                                      @RequestBody SessionSetupStatusRequest request) {
        return sessionWorkspaceService.updateSetupStatus(sessionId, setupId, request);
    }

    @PostMapping("/{sessionId}/active-setup")
    public SessionWorkspaceResponse selectActiveSetup(@PathVariable UUID sessionId,
                                                      @RequestBody SessionSetupSelectionRequest request) {
        return sessionWorkspaceService.selectActiveSetup(sessionId, request);
    }

    @PostMapping("/{sessionId}/setups/{setupId}/start-trade")
    public SessionWorkspaceResponse startTrade(@PathVariable UUID sessionId,
                                               @PathVariable UUID setupId) {
        return sessionWorkspaceService.startTrade(sessionId, setupId);
    }
}
