package com.tradevault.exception;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RestExceptionHandlerProviderNotConnectedTest {
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new ProviderNotConnectedController())
                .setControllerAdvice(new RestExceptionHandler())
                .build();
    }

    @Test
    void mapsProviderNotConnectedToForbiddenWithStructuredBody() throws Exception {
        mockMvc.perform(get("/test/provider-not-connected"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value(BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED))
                .andExpect(jsonPath("$.message").value("OANDA provider is not connected"))
                .andExpect(jsonPath("$.details.provider").value("OANDA"))
                .andExpect(jsonPath("$.details.reason").value("NO_CREDENTIALS"))
                .andExpect(jsonPath("$.details.code").value(BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED))
                .andExpect(jsonPath("$.trace").doesNotExist());
    }

    @RestController
    static class ProviderNotConnectedController {
        @GetMapping("/test/provider-not-connected")
        public String throwProviderNotConnected() {
            throw ProviderNotConnectedException.oandaNoCredentials();
        }
    }
}
