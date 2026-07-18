package com.tradevault.service.backtesting;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Slf4j
@Component
@RequiredArgsConstructor
public class LiveTradeEvidenceEventListener {
    private final LiveTradeEvidenceSyncService syncService;

    @Async("backtestingEvidenceExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onTradeChanged(LiveTradeEvidenceChangedEvent event) {
        try {
            if (event.deleted()) {
                syncService.markDeleted(event.liveTradeId(), event.userId());
            } else {
                syncService.synchronize(event.liveTradeId(), event.userId());
            }
        } catch (RuntimeException ex) {
            log.error("Could not synchronize live trade {} into Backtesting evidence", event.liveTradeId(), ex);
            syncService.markError(event.liveTradeId(), event.userId(), ex.getMessage());
        }
    }
}
