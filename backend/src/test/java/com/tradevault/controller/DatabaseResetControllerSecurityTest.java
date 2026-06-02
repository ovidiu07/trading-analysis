package com.tradevault.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.dto.maintenance.DatabaseResetResponse;
import com.tradevault.security.CustomUserDetailsService;
import com.tradevault.security.JwtAuthenticationFilter;
import com.tradevault.security.JwtTokenProvider;
import com.tradevault.security.SecurityConfig;
import com.tradevault.service.DatabaseResetService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = DatabaseResetController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class DatabaseResetControllerSecurityTest {
    private static final String URL = "/api/admin/maintenance/database/reset-data";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private DatabaseResetService databaseResetService;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private CustomUserDetailsService customUserDetailsService;

    @Test
    void unauthenticatedRequestIsRejected() throws Exception {
        mockMvc.perform(post(URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validPayload()))
                .andExpect(status().isUnauthorized());

        verify(databaseResetService, never()).resetData(any(), any());
    }

    @Test
    @WithMockUser(username = "user@example.com", roles = {"USER"})
    void normalUserIsRejected() throws Exception {
        mockMvc.perform(post(URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validPayload()))
                .andExpect(status().isForbidden());

        verify(databaseResetService, never()).resetData(any(), any());
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void normalAdminIsRejected() throws Exception {
        mockMvc.perform(post(URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validPayload()))
                .andExpect(status().isForbidden());

        verify(databaseResetService, never()).resetData(any(), any());
    }

    @Test
    @WithMockUser(username = "super-admin@example.com", roles = {"SUPER_ADMIN"})
    void superAdminIsAllowed() throws Exception {
        when(databaseResetService.resetData(any(), any())).thenReturn(DatabaseResetResponse.builder()
                .status("SUCCESS")
                .deletedRows(Map.of("trades", 2))
                .preserved(List.of("users"))
                .build());

        mockMvc.perform(post(URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validPayload()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.deletedRows.trades").value(2));
    }

    @Test
    @WithMockUser(username = "ops@example.com", authorities = {"PERMISSION_DATABASE_RESET"})
    void permissionedUserIsAllowed() throws Exception {
        when(databaseResetService.resetData(any(), any())).thenReturn(DatabaseResetResponse.builder()
                .status("SUCCESS")
                .deletedRows(Map.of())
                .preserved(List.of("users"))
                .build());

        mockMvc.perform(post(URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validPayload()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"));
    }

    private String validPayload() throws Exception {
        return objectMapper.writeValueAsString(Map.of(
                "confirmation", "RESET_TRADEJAUDIT_DATABASE_DATA",
                "preserveUsers", true,
                "password", "Password1!"
        ));
    }
}
