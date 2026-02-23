package com.tradevault.dto.session;

import lombok.Data;

import java.util.UUID;

@Data
public class SessionRoleSelectionRequest {
    private String symbol;
    private UUID sweepLevelId;
    private UUID sweepPoolId;
    private UUID entryLevelId;
    private UUID slLevelId;
    private UUID tpLevelId;
}
