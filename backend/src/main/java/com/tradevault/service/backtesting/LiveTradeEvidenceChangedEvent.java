package com.tradevault.service.backtesting;

import java.util.UUID;

public record LiveTradeEvidenceChangedEvent(UUID liveTradeId, UUID userId, boolean deleted) {
}
