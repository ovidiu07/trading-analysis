package com.tradevault.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.enums.TradeImportStatus;
import com.tradevault.dto.tradeimport.Mt5ImportCommitResponse;
import com.tradevault.dto.tradeimport.Mt5ImportPreviewResponse;
import com.tradevault.security.CustomUserDetailsService;
import com.tradevault.security.JwtAuthenticationFilter;
import com.tradevault.security.JwtTokenProvider;
import com.tradevault.security.SecurityConfig;
import com.tradevault.service.Mt5TradeImportService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = TradeImportController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class TradeImportControllerSecurityTest {
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @MockBean Mt5TradeImportService service;
    @MockBean JwtTokenProvider jwtTokenProvider;
    @MockBean CustomUserDetailsService customUserDetailsService;

    @Test
    void unauthenticatedImportEndpointsAreRejected() throws Exception {
        MockMultipartFile report = new MockMultipartFile("file", "report.html", "text/html", "<html></html>".getBytes());
        UUID batchId = UUID.randomUUID();

        mockMvc.perform(multipart("/api/trade-imports/metatrader5/preview").file(report)).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/trade-imports/{id}/commit", batchId).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/trade-imports/{id}", batchId)).andExpect(status().isUnauthorized());
        verify(service, never()).preview(any(), any(), any());
        verify(service, never()).commit(any(), any());
    }

    @Test
    @WithMockUser(username = "trader@example.com", roles = "USER")
    void authenticatedPreviewDelegatesAndReturnsParsedSummary() throws Exception {
        UUID batchId = UUID.randomUUID();
        MockMultipartFile report = new MockMultipartFile("file", "report.html", "text/html", "<html></html>".getBytes());
        when(service.preview(any(), any(), any())).thenReturn(preview(batchId));

        mockMvc.perform(multipart("/api/trade-imports/metatrader5/preview").file(report)
                        .param("sourceTimezone", "Europe/London"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.importBatchId").value(batchId.toString()))
                .andExpect(jsonPath("$.summary.positionsFound").value(4))
                .andExpect(jsonPath("$.summary.netPnl").value(-222.71));
    }

    @Test
    @WithMockUser(username = "trader@example.com", roles = "USER")
    void invalidMt5ReportReturnsBadRequestInsteadOfAuthenticationFailure() throws Exception {
        MockMultipartFile report = new MockMultipartFile("file", "report.html", "text/html", "<html></html>".getBytes());
        doThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported MetaTrader report encoding"))
                .when(service).preview(any(), any(), any());

        mockMvc.perform(multipart("/api/trade-imports/metatrader5/preview").file(report))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("Unsupported MetaTrader report encoding"));
    }

    @Test
    @WithMockUser(username = "trader@example.com", roles = "USER")
    void authenticatedCommitValidatesInputAndReturnsResult() throws Exception {
        UUID batchId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        when(service.commit(eq(batchId), any())).thenReturn(new Mt5ImportCommitResponse(batchId, TradeImportStatus.IMPORTED,
                4, 0, 0, 0, new BigDecimal("-145.46"), new BigDecimal("77.25"), new BigDecimal("-222.71"),
                List.of(UUID.randomUUID()), List.of(), List.of()));

        mockMvc.perform(post("/api/trade-imports/{id}/commit", batchId).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(java.util.Map.of(
                                "targetAccountId", accountId,
                                "sourceTimezone", "Europe/London",
                                "selectedPositionIds", List.of("645906"),
                                "symbolMappings", List.of(),
                                "linkToExistingTradeIds", java.util.Map.of(),
                                "saveBrokerTimezone", true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(4))
                .andExpect(jsonPath("$.netPnl").value(-222.71));

        mockMvc.perform(post("/api/trade-imports/{id}/commit", batchId).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "trader@example.com", roles = "USER")
    void authenticatedDetailsReturnsOwnedBatchPayload() throws Exception {
        UUID batchId = UUID.randomUUID();
        when(service.details(batchId)).thenReturn(preview(batchId));

        mockMvc.perform(get("/api/trade-imports/{id}", batchId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PREVIEW"));
    }

    private static Mt5ImportPreviewResponse preview(UUID batchId) {
        return new Mt5ImportPreviewResponse(batchId, TradeImportStatus.PREVIEW,
                new Mt5ImportPreviewResponse.AccountMetadata("7785088", "Ovidiu", "USD", "TRDX (Pty) Ltd",
                        "TRDX-Server", "real", "Netting", "2026.07.22 16:59"),
                new Mt5ImportPreviewResponse.Summary(4, 9, 9, 1, 4, 0, 0,
                        new BigDecimal("-145.46"), new BigDecimal("77.25"), new BigDecimal("-222.71")),
                "Europe/London", null, List.of(), List.of(), List.of(), List.of());
    }
}
