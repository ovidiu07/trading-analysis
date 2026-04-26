package com.tradevault.dto.asset;

import com.tradevault.domain.enums.AssetScope;
import com.tradevault.domain.enums.PlanScope;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class AssetUploadRequest {
    @NotNull
    private AssetScope scope;
    private UUID contentId;
    private UUID noteId;
    private UUID strategyId;
    private UUID tradeId;
    private UUID planId;
    private UUID todaySessionId;
    private PlanScope planScope;
    private Integer sortOrder;
    private String caption;
}
