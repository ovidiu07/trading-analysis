package com.tradevault.service.signalintel;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.domain.entity.SignalEvent;
import com.tradevault.domain.entity.SignalFeatureSnapshot;
import com.tradevault.dto.signalintel.TradingViewSignalOpenRequest;
import org.springframework.stereotype.Service;

@Service
public class DefaultFeatureExtractionService implements FeatureExtractionService {
    private final ObjectMapper objectMapper;

    public DefaultFeatureExtractionService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public SignalFeatureSnapshot createSnapshot(SignalEvent signalEvent, TradingViewSignalOpenRequest request) {
        TradingViewSignalOpenRequest.FeaturePayload features = request.getFeatures();
        ObjectNode featureJson = objectMapper.createObjectNode();
        featureJson.put("atr", decimalValue(features.getAtr()));
        featureJson.put("atrMean", decimalValue(features.getAtrMean()));
        featureJson.put("adx", decimalValue(features.getAdx()));
        featureJson.put("emaSlope", decimalValue(features.getEmaSlope()));
        featureJson.put("bodyPct", decimalValue(features.getBodyPct()));
        featureJson.put("sweepDepthAtr", decimalValue(features.getSweepDepthAtr()));
        featureJson.put("fvgSizeAtr", decimalValue(features.getFvgSizeAtr()));
        featureJson.put("obSizeAtr", decimalValue(features.getObSizeAtr()));
        if (features.getVolatilityState() != null) {
            featureJson.put("volatilityState", features.getVolatilityState());
        }
        if (features.getRangeState() != null) {
            featureJson.put("rangeState", features.getRangeState());
        }
        return SignalFeatureSnapshot.builder()
                .signalEvent(signalEvent)
                .atr(features.getAtr())
                .atrMean(features.getAtrMean())
                .adx(features.getAdx())
                .emaSlope(features.getEmaSlope())
                .bodyPct(features.getBodyPct())
                .sweepDepthAtr(features.getSweepDepthAtr())
                .fvgSizeAtr(features.getFvgSizeAtr())
                .obSizeAtr(features.getObSizeAtr())
                .volatilityState(features.getVolatilityState())
                .rangeState(features.getRangeState())
                .featureJson(featureJson)
                .build();
    }

    private double decimalValue(java.math.BigDecimal value) {
        return value == null ? 0.0d : value.doubleValue();
    }
}
