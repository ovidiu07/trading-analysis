package com.tradevault.controller;

import com.tradevault.dto.session.LiveQuoteResponse;
import com.tradevault.dto.session.QuoteAvailabilityReason;
import com.tradevault.security.CustomUserDetailsService;
import com.tradevault.security.JwtAuthenticationFilter;
import com.tradevault.security.JwtTokenProvider;
import com.tradevault.security.SecurityConfig;
import com.tradevault.service.QuoteService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = QuoteController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class QuoteControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private QuoteService quoteService;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private CustomUserDetailsService customUserDetailsService;

    @Test
    @WithMockUser(username = "trader@example.com", roles = {"USER"})
    void authenticatedQuoteRequestReturnsOk() throws Exception {
        when(quoteService.getLiveQuote("GBPUSD")).thenReturn(
                LiveQuoteResponse.builder()
                        .symbol("GBPUSD")
                        .source("OANDA")
                        .available(false)
                        .reason(QuoteAvailabilityReason.NO_PROVIDER)
                        .tsUtc(OffsetDateTime.now(ZoneOffset.UTC))
                        .build()
        );

        mockMvc.perform(get("/api/quotes").param("symbol", "GBPUSD"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.reason").value("NO_PROVIDER"));
    }

    @Test
    void unauthenticatedQuoteRequestReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/quotes").param("symbol", "GBPUSD"))
                .andExpect(status().isUnauthorized());
    }
}
