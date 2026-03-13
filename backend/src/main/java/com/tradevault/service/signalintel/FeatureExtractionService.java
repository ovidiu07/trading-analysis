package com.tradevault.service.signalintel;

import com.tradevault.domain.entity.SignalEvent;
import com.tradevault.domain.entity.SignalFeatureSnapshot;
import com.tradevault.dto.signalintel.TradingViewSignalOpenRequest;

public interface FeatureExtractionService {
    SignalFeatureSnapshot createSnapshot(SignalEvent signalEvent, TradingViewSignalOpenRequest request);
}
