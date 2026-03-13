package com.tradevault.service.signalintel;

import com.tradevault.domain.enums.SignalRegime;

import java.util.Optional;

public interface ProfileSelectionService {
    SignalProfileDefinition defaultProfileFor(String timeframe, SignalRegime regime);

    Optional<SignalProfileDefinition> findById(String profileId);
}
