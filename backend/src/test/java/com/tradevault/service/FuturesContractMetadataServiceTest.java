package com.tradevault.service;

import com.tradevault.domain.enums.Market;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FuturesContractMetadataServiceTest {

    private final FuturesContractMetadataService service = new FuturesContractMetadataService();

    @Test
    void resolvesMnqExpirySymbolToContractAndTickMetadata() {
        var metadata = service.resolve("MNQM6");

        assertTrue(metadata.isPresent());
        assertEquals("MNQ", metadata.get().root());
        assertEquals(0, metadata.get().contractMultiplier().compareTo(new BigDecimal("2")));
        assertEquals(0, metadata.get().tickSize().compareTo(new BigDecimal("0.25")));
        assertEquals(0, metadata.get().tickValue().compareTo(new BigDecimal("0.50")));
    }

    @Test
    void resolvesManualFuturesMultiplierFromKnownRootWhenRequestOmitsIt() {
        BigDecimal multiplier = service.resolveContractMultiplier(Market.FUTURES, "MNQM6", null, null);

        assertEquals(0, multiplier.compareTo(new BigDecimal("2")));
    }
}
