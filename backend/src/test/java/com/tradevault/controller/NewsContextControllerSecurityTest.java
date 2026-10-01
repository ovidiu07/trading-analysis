package com.tradevault.controller;

import com.tradevault.security.*;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.news.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import java.time.*;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers=NewsContextController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class NewsContextControllerSecurityTest {
    @Autowired MockMvc mvc;
    @MockBean NewsContextService context;
    @MockBean CurrentUserService users;
    @MockBean JwtTokenProvider jwtTokenProvider;
    @MockBean CustomUserDetailsService customUserDetailsService;
    @Test void allContextEndpointsRequireAuthentication() throws Exception {
        mvc.perform(get("/api/market-context").param("instrument","NAS100").param("date","2026-10-01")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/market-context/company-demand").param("instrument","NASDAQ:AAPL")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/market-context/refresh").param("instrument","NAS100")).andExpect(status().isUnauthorized());
        verifyNoInteractions(context);
    }
    @Test @WithMockUser void authenticatedReadPreservesCutoffAndDoesNotQueueDemand() throws Exception {
        var cutoff=Instant.parse("2026-10-01T12:00:00Z");var date=LocalDate.parse("2026-10-01");
        when(context.snapshot("NAS100",date,"Europe/Bucharest","SESSION",cutoff)).thenReturn(new NewsModels.Snapshot("NAS100","US_TECH",date,"Europe/Bucharest",cutoff,"SESSION",List.of(),List.of(),List.of(),List.of(),null,false,new NewsModels.CalendarAccess("TRADAYS","WIDGET_ONLY","HISTORICAL",null,null,List.of())));
        mvc.perform(get("/api/market-context").param("instrument","NAS100").param("date",date.toString()).param("timezone","Europe/Bucharest").param("asOf",cutoff.toString()))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
            .andExpect(jsonPath("$.calendar.coverage").value("HISTORICAL")).andExpect(jsonPath("$.calendar.events").isEmpty());
        verify(users).getCurrentUser();verify(context,never()).demandCompany(any());verify(context,never()).requestRefresh(any());
    }
    @Test @WithMockUser void authorizedDemandReturnsOnlyQueueState() throws Exception {
        when(context.demandCompany("NASDAQ:AAPL")).thenReturn("MAPPING_REQUIRED");
        mvc.perform(post("/api/market-context/company-demand").param("instrument","NASDAQ:AAPL"))
            .andExpect(status().isAccepted()).andExpect(jsonPath("$.state").value("MAPPING_REQUIRED"))
            .andExpect(jsonPath("$.apiToken").doesNotExist());
        verify(users).getCurrentUser();verify(context).demandCompany("NASDAQ:AAPL");
    }
}
