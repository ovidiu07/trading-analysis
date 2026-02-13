package com.tradevault.dto.asset;

import com.tradevault.domain.enums.AssetScope;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class AssetUploadRequest {
    @NotNull
    private AssetScope scope;
    private UUID contentId;
    private UUID noteId;
    private Integer sortOrder;
}
