package com.tradevault.dto.content;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ContentPostRequestSerializationTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void deserializesChartAndSnapshotFields() throws Exception {
        UUID contentTypeId = UUID.randomUUID();
        UUID snapshotAssetId = UUID.randomUUID();
        String json = """
                {
                  "contentTypeId": "%s",
                  "translations": {
                    "en": {
                      "title": "Daily Plan",
                      "summary": "Summary",
                      "body": ""
                    }
                  },
                  "tradingViewSymbol": "TVC:DAX",
                  "tradingViewInterval": "15",
                  "tradingViewTheme": "SYSTEM",
                  "tradingViewHideControls": true,
                  "tradingViewAllowSymbolChange": false,
                  "snapshotAssetId": "%s",
                  "snapshotCaption": "v3 snapshot"
                }
                """.formatted(contentTypeId, snapshotAssetId);

        ContentPostRequest request = objectMapper.readValue(json, ContentPostRequest.class);

        assertEquals(contentTypeId, request.getContentTypeId());
        assertEquals("TVC:DAX", request.getTradingViewSymbol());
        assertEquals("15", request.getTradingViewInterval());
        assertEquals("SYSTEM", request.getTradingViewTheme());
        assertTrue(request.getTradingViewHideControls());
        assertEquals(Boolean.FALSE, request.getTradingViewAllowSymbolChange());
        assertEquals(snapshotAssetId, request.getSnapshotAssetId());
        assertEquals("v3 snapshot", request.getSnapshotCaption());
    }
}
