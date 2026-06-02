package com.tradevault.controller;

import com.tradevault.dto.maintenance.DatabaseResetRequest;
import com.tradevault.dto.maintenance.DatabaseResetResponse;
import com.tradevault.service.DatabaseResetService;
import io.swagger.v3.oas.annotations.Hidden;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Hidden
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/maintenance/database")
public class DatabaseResetController {
    private final DatabaseResetService databaseResetService;

    @PostMapping("/reset-data")
    @PreAuthorize("hasAuthority('PERMISSION_DATABASE_RESET') or hasRole('SUPER_ADMIN')")
    public DatabaseResetResponse resetData(
            @Valid @RequestBody DatabaseResetRequest request,
            Authentication authentication
    ) {
        return databaseResetService.resetData(request, authentication);
    }
}
