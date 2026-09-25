package com.tradevault.controller;

import com.tradevault.service.CurrentUserService;
import com.tradevault.service.marketdata.EcbReferenceProvider;
import com.tradevault.dto.market.MarketWorkspaceResponse.MacroObservation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequiredArgsConstructor @RequestMapping("/api/market-workspace")
public class OfficialReferenceController {
    private final CurrentUserService users;
    private final EcbReferenceProvider ecb;
    @GetMapping("/official-context")
    public ResponseEntity<List<MacroObservation>> references() {
        users.getCurrentUser();
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore()).body(ecb.latest());
    }
}
