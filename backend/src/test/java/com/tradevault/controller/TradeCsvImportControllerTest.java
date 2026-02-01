package com.tradevault.controller;

import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Role;
import com.tradevault.repository.TradeImportRowRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.repository.UserRepository;
import com.tradevault.security.CustomUserDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.mock.web.MockMultipartFile;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class TradeCsvImportControllerTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("tradevault")
            .withUsername("tradevault")
            .withPassword("tradevault");

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    MockMvc mockMvc;

    @Autowired
    UserRepository userRepository;

    @Autowired
    TradeRepository tradeRepository;

    @Autowired
    TradeImportRowRepository tradeImportRowRepository;

    @AfterEach
    void cleanUp() {
        tradeImportRowRepository.deleteAll();
        tradeRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void importCsvCreatesTradeForAuthenticatedUser() throws Exception {
        User user = userRepository.save(User.builder()
                .email("importer@example.com")
                .passwordHash("hashed")
                .role(Role.USER)
                .build());

        CustomUserDetails userDetails = new CustomUserDetails(user);
        var auth = new UsernamePasswordAuthenticationToken(
                userDetails,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );

        String csv = String.join("\n",
                "Action,Time,ISIN,Ticker,Name,ID,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result,Currency (Result),Total,Currency (Total)",
                "Limit buy,2024-01-01 10:00:00,US123,ACME,Acme Corp,tx1,10,100,USD,1,,USD,1000,USD",
                "Limit sell,2024-01-02 10:00:00,US123,ACME,Acme Corp,tx2,10,110,USD,1,100,USD,1100,USD"
        );

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "trades.csv",
                "text/csv",
                csv.getBytes(StandardCharsets.UTF_8)
        );

        MockMultipartHttpServletRequestBuilder request = multipart("/api/trades/import/csv")
                .file(file)
                .with(SecurityMockMvcRequestPostProcessors.authentication(auth))
                .contentType(MediaType.MULTIPART_FORM_DATA);

        mockMvc.perform(request)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalRows").value(2))
                .andExpect(jsonPath("$.tradesCreated").value(1));

        var trades = tradeRepository.findByUserId(user.getId());
        assertThat(trades).hasSize(1);
        assertThat(trades.get(0).getUser().getId()).isEqualTo(user.getId());
        assertThat(trades.get(0).getSymbol()).isEqualTo("ACME");
        assertThat(trades.get(0).getStatus().name()).isEqualTo("CLOSED");
    }
}
