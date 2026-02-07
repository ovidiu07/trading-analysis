package com.tradevault.controller;

import com.tradevault.exception.TradeSearchValidationException;
import com.tradevault.service.TradeCalendarService;
import com.tradevault.service.TradeCsvImportService;
import com.tradevault.service.TradeService;
import com.tradevault.exception.RestExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.PageImpl;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TradeControllerSearchDateFiltersTest {
    private MockMvc mockMvc;
    private TradeService tradeService;

    @BeforeEach
    void setUp() {
        tradeService = Mockito.mock(TradeService.class);
        when(tradeService.search(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

        TradeController controller = new TradeController(
                tradeService,
                Mockito.mock(TradeCalendarService.class),
                Mockito.mock(TradeCsvImportService.class)
        );

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new RestExceptionHandler())
                .build();
    }

    @Test
    void searchAcceptsDateOnlyOpenedRange() throws Exception {
        mockMvc.perform(get("/api/trades/search")
                        .param("page", "0")
                        .param("size", "50")
                        .param("openedAtFrom", "2026-01-09")
                        .param("openedAtTo", "2026-02-06"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));
    }

    @Test
    void searchAcceptsIsoDateTimeOpenedRange() throws Exception {
        mockMvc.perform(get("/api/trades/search")
                        .param("page", "0")
                        .param("size", "50")
                        .param("openedAtFrom", "2026-01-09T00:00:00+02:00")
                        .param("openedAtTo", "2026-02-06T23:59:59+02:00"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));
    }

    @Test
    void searchRejectsOpenedRangeWhenFromIsAfterTo() throws Exception {
        when(tradeService.search(
                eq(0),
                eq(20),
                eq("2026-02-07"),
                eq("2026-02-06"),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any()))
                .thenThrow(new TradeSearchValidationException(
                        "Invalid date range: 'openedAtFrom' must be before or equal to 'openedAtTo'.",
                        Map.of(
                                "fieldErrors", List.of(
                                        Map.of("field", "openedAtFrom", "message", "Must be before or equal to openedAtTo"),
                                        Map.of("field", "openedAtTo", "message", "Must be after or equal to openedAtFrom")
                                )
                        )
                ));

        mockMvc.perform(get("/api/trades/search")
                        .param("openedAtFrom", "2026-02-07")
                        .param("openedAtTo", "2026-02-06"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("Invalid date range: 'openedAtFrom' must be before or equal to 'openedAtTo'."))
                .andExpect(jsonPath("$.details.fieldErrors[0].field").value("openedAtFrom"))
                .andExpect(jsonPath("$.details.fieldErrors[1].field").value("openedAtTo"));

        verify(tradeService).search(
                eq(0),
                eq(20),
                eq("2026-02-07"),
                eq("2026-02-06"),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any()
        );
    }
}
