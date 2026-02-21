package com.tradevault.dto.trade;

import lombok.Data;

import java.util.Set;
import java.util.UUID;

@Data
public class TradeEntryJournalRequest {
    private String entryJournalText;
    private String entryInvalidation;
    private String feeling;
    private Set<UUID> entryScreenshotAssetIds;
}
