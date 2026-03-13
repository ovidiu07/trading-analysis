package com.tradevault.service.signalintel;

import com.fasterxml.jackson.databind.JsonNode;

public record SignalProfileDefinition(
        String profileId,
        String timeframe,
        String regime,
        JsonNode profileJson
) {
}
