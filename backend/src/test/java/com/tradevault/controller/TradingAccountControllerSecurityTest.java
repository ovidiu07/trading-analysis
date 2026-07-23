package com.tradevault.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.dto.account.CreateTradingAccountRequest;
import com.tradevault.dto.account.TradingAccountOptionResponse;
import com.tradevault.domain.enums.AccountStatus;
import com.tradevault.security.CustomUserDetailsService;
import com.tradevault.security.JwtAuthenticationFilter;
import com.tradevault.security.JwtTokenProvider;
import com.tradevault.security.SecurityConfig;
import com.tradevault.service.TradingAccountService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = TradingAccountController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class TradingAccountControllerSecurityTest {
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @MockBean TradingAccountService service;
    @MockBean JwtTokenProvider jwtTokenProvider;
    @MockBean CustomUserDetailsService customUserDetailsService;

    @Test
    void unauthenticatedAccountRequestsAreRejected() throws Exception {
        mockMvc.perform(get("/api/accounts")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        verify(service, never()).listEligibleAccounts();
        verify(service, never()).create(any());
    }

    @Test
    @WithMockUser(username = "trader@example.com", roles = "USER")
    void authenticatedUserCanListAndCreateInternalAccounts() throws Exception {
        UUID id = UUID.randomUUID();
        TradingAccountOptionResponse option = new TradingAccountOptionResponse(
                id, "Institutional Funding 50K", "TRDX", "USD", null, null, null,
                null, AccountStatus.ACTIVE, false, null, 0, null, null);
        when(service.listEligibleAccounts()).thenReturn(List.of(option));
        when(service.create(any())).thenReturn(option);

        mockMvc.perform(get("/api/accounts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(id.toString()))
                .andExpect(jsonPath("$[0].name").value("Institutional Funding 50K"))
                .andExpect(jsonPath("$[0].currency").value("USD"));

        mockMvc.perform(post("/api/accounts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(
                                new CreateTradingAccountRequest("Institutional Funding 50K", "TRDX", "USD"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(id.toString()));
    }
}
