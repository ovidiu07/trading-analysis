package com.tradevault.dto.content;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
public class ContentPostRequest {
    @NotNull
    private UUID contentTypeId;

    private String slug;
    private List<String> tags;
    private List<String> symbols;
    private OffsetDateTime visibleFrom;
    private OffsetDateTime visibleUntil;
    private LocalDate weekStart;
    private LocalDate weekEnd;
    private Map<String, Object> templateFields;
    private String revisionNotes;
    private Boolean notifySubscribersAboutUpdate;
    @Pattern(regexp = "^[A-Za-z0-9:._-]{1,64}$", message = "tradingViewSymbol contains unsupported characters")
    private String tradingViewSymbol;
    @Pattern(regexp = "^(1|3|5|15|30|60|240|D|W)$", message = "tradingViewInterval is not supported")
    private String tradingViewInterval;
    private String tradingViewTheme;
    private Boolean tradingViewHideControls;
    private Boolean tradingViewAllowSymbolChange;
    private UUID snapshotAssetId;
    @Size(max = 400)
    private String snapshotCaption;

    @NotNull
    @Valid
    private Map<String, @Valid LocalizedContentRequest> translations;
}
