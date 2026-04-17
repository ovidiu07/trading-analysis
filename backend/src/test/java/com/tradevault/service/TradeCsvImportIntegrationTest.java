package com.tradevault.service;

import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.PnlBasis;
import com.tradevault.domain.enums.Role;
import com.tradevault.dto.trade.TradeResponse;
import com.tradevault.repository.TradeRepository;
import com.tradevault.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Page;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@Testcontainers
@Disabled("Requires a working local Docker/Testcontainers environment")
class TradeCsvImportIntegrationTest {

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
    private MockMvc mockMvc;

    @Autowired
    private TradeService tradeService;

    @Autowired
    private TradeCalendarService tradeCalendarService;

    @Autowired
    private TradeRepository tradeRepository;

    @Autowired
    private UserRepository userRepository;

    @MockBean
    private CurrentUserService currentUserService;

    @AfterEach
    void cleanUp() {
        tradeRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void importEndpointCreatesTradovateTradeVisibleInTradeListAndCalendar() throws Exception {
        User user = userRepository.save(User.builder()
                .email("tradovate-import@example.com")
                .passwordHash("hashed")
                .role(Role.USER)
                .timezone("Europe/Bucharest")
                .baseCurrency("USD")
                .build());
        when(currentUserService.getCurrentUser()).thenReturn(user);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "Orders.csv",
                "text/csv",
                ordersCsvLong().getBytes(StandardCharsets.UTF_8)
        );

        mockMvc.perform(multipart("/api/import/csv").file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.detectedFormat").value("TRADOVATE_ORDERS"))
                .andExpect(jsonPath("$.imported").value(1))
                .andExpect(jsonPath("$.updated").value(0))
                .andExpect(jsonPath("$.failed").value(0));

        Page<TradeResponse> trades = tradeService.listAll(0, 20);
        assertThat(trades.getTotalElements()).isEqualTo(1);
        TradeResponse trade = trades.getContent().get(0);
        assertThat(trade.getSymbol()).isEqualTo("MNQM6");
        assertThat(trade.getAccountId()).isEqualTo("APEX4855840000003");
        assertThat(trade.getContractMultiplier()).isEqualByComparingTo("2");
        assertThat(trade.getPnlNet()).isEqualByComparingTo("306.0000");

        var closedTrades = tradeService.listClosedTradesByDate(LocalDate.of(2026, 4, 17), "Europe/Bucharest", null);
        assertThat(closedTrades).hasSize(1);
        assertThat(closedTrades.get(0).getId()).isEqualTo(trade.getId());

        var calendar = tradeCalendarService.fetchDailyPnl(
                LocalDate.of(2026, 4, 17),
                LocalDate.of(2026, 4, 17),
                "Europe/Bucharest",
                PnlBasis.CLOSE,
                null
        );
        assertThat(calendar).hasSize(1);
        assertThat(calendar.get(0).tradeCount()).isEqualTo(1);
        assertThat(calendar.get(0).netPnl()).isEqualByComparingTo("306.0000");
    }

    private String ordersCsvLong() {
        return String.join("\n",
                "orderId,Account,Order ID,B/S,Contract,Product,Product Description,avgPrice,filledQty,Fill Time,lastCommandId,Status,_priceFormat,_priceFormatType,_tickSize,spreadDefinitionId,Version ID,Timestamp,Date,Quantity,Text,Type,Limit Price,Stop Price,decimalLimit,decimalStop,Filled Qty,Avg Fill Price,decimalFillAvg,Venue,Notional Value,Currency",
                "470913240262,APEX4855840000003,470913240262, Buy,MNQM6,MNQ,Micro E-mini NASDAQ-100,26711.5,2,04/17/2026 16:44:42,470913240262, Filled,-2,0,0.25,,470913240262,04/17/2026 16:44:42,4/17/26,2,Tradingview, Limit,26712.00,,26712.0,,2,26711.50,26711.5,,\"106,846.00\",USD",
                "470913240265,APEX4855840000003,470913240265, Sell,MNQM6,MNQ,Micro E-mini NASDAQ-100,,,,470913240289, Canceled,-2,0,0.25,,470913240289,04/17/2026 16:46:50,4/17/26,2,Tradingview, Limit,26884.75,,26884.75,,,,,,,USD",
                "470913240267,APEX4855840000003,470913240267, Sell,MNQM6,MNQ,Micro E-mini NASDAQ-100,,,,470913240293, Canceled,-2,0,0.25,,470913240293,04/17/2026 17:34:34,4/17/26,2,Tradingview, Stop,,26712.25,,26712.25,,,,,,USD",
                "470913240303,APEX4855840000003,470913240303, Sell,MNQM6,MNQ,Micro E-mini NASDAQ-100,26788.0,2,04/17/2026 17:36:58,470913240303, Filled,-2,0,0.25,,470913240303,04/17/2026 17:36:58,4/17/26,2,Exit, Market,,,,,2,26788.00,26788.0,,\"107,152.00\",USD"
        );
    }
}
