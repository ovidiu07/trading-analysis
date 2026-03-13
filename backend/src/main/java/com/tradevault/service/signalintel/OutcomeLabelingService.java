package com.tradevault.service.signalintel;

import com.tradevault.domain.entity.SignalEvent;
import com.tradevault.domain.entity.SignalOutcome;
import com.tradevault.dto.signalintel.TradingViewSignalCloseRequest;

public interface OutcomeLabelingService {
    SignalOutcome upsertOutcome(SignalEvent signalEvent, TradingViewSignalCloseRequest request);
}
