package com.tradevault.service;

import com.tradevault.domain.entity.TradeImportRow;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.trade.ImportedTradeCandidate;
import com.tradevault.dto.trade.TradeResponse;
import com.tradevault.repository.TradeImportRowRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.mock.web.MockMultipartFile;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TradeCsvImportServiceTest {

    private static final ZoneId USER_ZONE = ZoneId.of("Europe/Bucharest");

    private CurrentUserService currentUserService;
    private TradeImportRowRepository tradeImportRowRepository;
    private TradeService tradeService;
    private TimezoneService timezoneService;
    private TradeCsvImportService service;
    private User user;

    @BeforeEach
    void setUp() {
        currentUserService = Mockito.mock(CurrentUserService.class);
        tradeImportRowRepository = Mockito.mock(TradeImportRowRepository.class);
        tradeService = Mockito.mock(TradeService.class);
        timezoneService = Mockito.mock(TimezoneService.class);
        service = new TradeCsvImportService(currentUserService, tradeImportRowRepository, tradeService, timezoneService);

        user = User.builder()
                .id(UUID.randomUUID())
                .email("import@test.com")
                .timezone(USER_ZONE.getId())
                .baseCurrency("USD")
                .build();

        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(timezoneService.resolveZone(null, user)).thenReturn(USER_ZONE);
        when(tradeImportRowRepository.findAllByUserIdAndTransactionIdIn(eq(user.getId()), anyCollection()))
                .thenReturn(List.of());
        when(tradeService.upsertImportedTrade(any())).thenAnswer(invocation -> {
            ImportedTradeCandidate candidate = invocation.getArgument(0, ImportedTradeCandidate.class);
            TradeResponse response = TradeResponse.builder()
                    .id(UUID.randomUUID())
                    .symbol(candidate.getSymbol())
                    .accountId(candidate.getAccountId())
                    .build();
            return new TradeService.ImportUpsertResult(response, false);
        });
    }

    @Test
    void importTradovateClosedLongTradeReconstructsFilledEntryAndExit() throws Exception {
        var summary = service.importCsv(csvFile(ordersCsvLong()));

        ImportedTradeCandidate candidate = capturedCandidates().get(0);
        assertEquals("TRADOVATE_ORDERS", summary.getDetectedFormat());
        assertEquals(4, summary.getTotalRows());
        assertEquals(4, summary.getParsedRows());
        assertEquals(1, summary.getTradeGroups());
        assertEquals(1, summary.getTradesCreated());
        assertEquals(0, summary.getGroupsSkipped());

        assertEquals("APEX4855840000003", candidate.getAccountId());
        assertEquals("MNQM6", candidate.getSymbol());
        assertEquals(Market.FUTURES, candidate.getMarket());
        assertEquals(Direction.LONG, candidate.getDirection());
        assertEquals(TradeStatus.CLOSED, candidate.getStatus());
        assertEquals(OffsetDateTime.parse("2026-04-17T13:44:42Z"), candidate.getOpenedAt());
        assertEquals(OffsetDateTime.parse("2026-04-17T14:36:58Z"), candidate.getClosedAt());
        assertEquals(new BigDecimal("2"), candidate.getQuantity());
        assertEquals(new BigDecimal("26711.5000000000"), candidate.getEntryPrice());
        assertEquals(new BigDecimal("26788.0000000000"), candidate.getExitPrice());
        assertEquals(new BigDecimal("26712.25"), candidate.getStopLossPrice());
        assertEquals(new BigDecimal("26884.75"), candidate.getTakeProfitPrice());
        assertEquals(new BigDecimal("2.00000000"), candidate.getContractMultiplier());
        assertEquals("USD", candidate.getTradeCurrency());
        assertTrue(candidate.getInitialNotes().contains("Tradovate Orders CSV"));
    }

    @Test
    void importTradovateClosedShortTradeReconstructsShortDirection() throws Exception {
        var summary = service.importCsv(csvFile(ordersCsvShort()));

        ImportedTradeCandidate candidate = capturedCandidates().get(0);
        assertEquals("TRADOVATE_ORDERS", summary.getDetectedFormat());
        assertEquals(1, summary.getTradesCreated());
        assertEquals(Direction.SHORT, candidate.getDirection());
        assertEquals(TradeStatus.CLOSED, candidate.getStatus());
        assertEquals(new BigDecimal("1"), candidate.getQuantity());
        assertEquals(new BigDecimal("26788.0000000000"), candidate.getEntryPrice());
        assertEquals(new BigDecimal("26711.5000000000"), candidate.getExitPrice());
        assertEquals(new BigDecimal("26884.75"), candidate.getStopLossPrice());
        assertEquals(new BigDecimal("26712.25"), candidate.getTakeProfitPrice());
        assertEquals("APEX4855840000003", candidate.getAccountId());
    }

    @Test
    void importTradovateUsesCanceledProtectiveOrdersAsAnchorsOnly() throws Exception {
        var summary = service.importCsv(csvFile(ordersCsvLong()));

        ImportedTradeCandidate candidate = capturedCandidates().get(0);
        assertEquals(1, summary.getTradeGroups());
        assertEquals(1, capturedCandidates().size());
        assertEquals(TradeStatus.CLOSED, candidate.getStatus());
        assertEquals(new BigDecimal("2"), candidate.getQuantity());
        assertEquals(new BigDecimal("26712.25"), candidate.getStopLossPrice());
        assertEquals(new BigDecimal("26884.75"), candidate.getTakeProfitPrice());

        ArgumentCaptor<List<TradeImportRow>> rowsCaptor = ArgumentCaptor.forClass(List.class);
        verify(tradeImportRowRepository).saveAll(rowsCaptor.capture());
        assertEquals(4, rowsCaptor.getValue().size());
    }

    @Test
    void importTradovatePreservesBrokerAccountIdAcrossDifferentExports() throws Exception {
        service.importCsv(csvFile(ordersCsvSecondAccount()));

        ImportedTradeCandidate candidate = capturedCandidates().get(0);
        assertEquals("APEX4855840000004", candidate.getAccountId());
        assertEquals(new BigDecimal("4"), candidate.getQuantity());
        assertEquals(TradeStatus.CLOSED, candidate.getStatus());
        assertEquals(new BigDecimal("2.00000000"), candidate.getContractMultiplier());
    }

    @Test
    void importTradovateOpenTradeWithoutExitKeepsTradeOpen() throws Exception {
        var summary = service.importCsv(csvFile(ordersCsvOpen()));

        ImportedTradeCandidate candidate = capturedCandidates().get(0);
        assertEquals(TradeStatus.OPEN, candidate.getStatus());
        assertNull(candidate.getClosedAt());
        assertNull(candidate.getExitPrice());
        assertEquals(new BigDecimal("2"), candidate.getQuantity());
        assertEquals(new BigDecimal("26712.25"), candidate.getStopLossPrice());
        assertEquals(new BigDecimal("26884.75"), candidate.getTakeProfitPrice());
        assertEquals(1, summary.getTradeGroups());
        assertEquals(0, summary.getGroupsSkipped());
    }

    @Test
    void importNativeTradeExportStillSupported() throws Exception {
        String csv = String.join("\n",
                "symbol,market,direction,openedAt,closedAt,quantity,entryPrice,exitPrice,fees,commission,slippage,stopLossPrice,takeProfitPrice,setup,strategyTag,catalystTag,notes",
                "AAPL,STOCK,LONG,2026-04-17T10:00:00Z,2026-04-17T11:00:00Z,10,100,110,0,0,0,95,115,,,," 
        );

        var summary = service.importCsv(csvFile(csv));

        ImportedTradeCandidate candidate = capturedCandidates().get(0);
        assertEquals("NATIVE_TRADE_EXPORT", summary.getDetectedFormat());
        assertEquals("AAPL", candidate.getSymbol());
        assertEquals(Market.STOCK, candidate.getMarket());
        assertEquals(Direction.LONG, candidate.getDirection());
        assertEquals(TradeStatus.CLOSED, candidate.getStatus());
        assertEquals(new BigDecimal("10"), candidate.getQuantity());
    }

    private List<ImportedTradeCandidate> capturedCandidates() {
        ArgumentCaptor<ImportedTradeCandidate> captor = ArgumentCaptor.forClass(ImportedTradeCandidate.class);
        verify(tradeService, Mockito.atLeastOnce()).upsertImportedTrade(captor.capture());
        return captor.getAllValues();
    }

    private MockMultipartFile csvFile(String content) {
        return new MockMultipartFile(
                "file",
                "Orders.csv",
                "text/csv",
                content.getBytes(StandardCharsets.UTF_8)
        );
    }

    private String ordersCsvLong() {
        return String.join("\n",
                tradovateHeader(),
                "470913240262,APEX4855840000003,470913240262, Buy,MNQM6,MNQ,Micro E-mini NASDAQ-100,26711.5,2,04/17/2026 16:44:42,470913240262, Filled,-2,0,0.25,,470913240262,04/17/2026 16:44:42,4/17/26,2,Tradingview, Limit,26712.00,,26712.0,,2,26711.50,26711.5,,\"106,846.00\",USD",
                "470913240265,APEX4855840000003,470913240265, Sell,MNQM6,MNQ,Micro E-mini NASDAQ-100,,,,470913240289, Canceled,-2,0,0.25,,470913240289,04/17/2026 16:46:50,4/17/26,2,Tradingview, Limit,26884.75,,26884.75,,,,,,,USD",
                "470913240267,APEX4855840000003,470913240267, Sell,MNQM6,MNQ,Micro E-mini NASDAQ-100,,,,470913240293, Canceled,-2,0,0.25,,470913240293,04/17/2026 17:34:34,4/17/26,2,Tradingview, Stop,,26712.25,,26712.25,,,,,,USD",
                "470913240303,APEX4855840000003,470913240303, Sell,MNQM6,MNQ,Micro E-mini NASDAQ-100,26788.0,2,04/17/2026 17:36:58,470913240303, Filled,-2,0,0.25,,470913240303,04/17/2026 17:36:58,4/17/26,2,Exit, Market,,,,,2,26788.00,26788.0,,\"107,152.00\",USD"
        );
    }

    private String ordersCsvShort() {
        return String.join("\n",
                tradovateHeader(),
                "570913240262,APEX4855840000003,570913240262, Sell,MNQM6,MNQ,Micro E-mini NASDAQ-100,26788.0,1,04/18/2026 16:44:42,570913240262, Filled,-2,0,0.25,,570913240262,04/18/2026 16:44:42,4/18/26,1,Tradingview, Limit,26788.00,,26788.0,,1,26788.00,26788.0,,\"53,576.00\",USD",
                "570913240265,APEX4855840000003,570913240265, Buy,MNQM6,MNQ,Micro E-mini NASDAQ-100,,,,570913240289, Canceled,-2,0,0.25,,570913240289,04/18/2026 16:46:50,4/18/26,1,Tradingview, Limit,26712.25,,26712.25,,,,,,,USD",
                "570913240267,APEX4855840000003,570913240267, Buy,MNQM6,MNQ,Micro E-mini NASDAQ-100,,,,570913240293, Canceled,-2,0,0.25,,570913240293,04/18/2026 17:34:34,4/18/26,1,Tradingview, Stop,,26884.75,,26884.75,,,,,,USD",
                "570913240303,APEX4855840000003,570913240303, Buy,MNQM6,MNQ,Micro E-mini NASDAQ-100,26711.5,1,04/18/2026 17:36:58,570913240303, Filled,-2,0,0.25,,570913240303,04/18/2026 17:36:58,4/18/26,1,Exit, Market,,,,,1,26711.50,26711.5,,\"53,423.00\",USD"
        );
    }

    private String ordersCsvOpen() {
        return String.join("\n",
                tradovateHeader(),
                "670913240262,APEX4855840000003,670913240262, Buy,MNQM6,MNQ,Micro E-mini NASDAQ-100,26711.5,2,04/17/2026 16:44:42,670913240262, Filled,-2,0,0.25,,670913240262,04/17/2026 16:44:42,4/17/26,2,Tradingview, Limit,26712.00,,26712.0,,2,26711.50,26711.5,,\"106,846.00\",USD",
                "670913240265,APEX4855840000003,670913240265, Sell,MNQM6,MNQ,Micro E-mini NASDAQ-100,,,,670913240289, Canceled,-2,0,0.25,,670913240289,04/17/2026 16:46:50,4/17/26,2,Tradingview, Limit,26884.75,,26884.75,,,,,,,USD",
                "670913240267,APEX4855840000003,670913240267, Sell,MNQM6,MNQ,Micro E-mini NASDAQ-100,,,,670913240293, Canceled,-2,0,0.25,,670913240293,04/17/2026 17:34:34,4/17/26,2,Tradingview, Stop,,26712.25,,26712.25,,,,,,USD"
        );
    }

    private String ordersCsvSecondAccount() {
        return String.join("\n",
                tradovateHeader(),
                "470913240362,APEX4855840000004,470913240362, Buy,MNQM6,MNQ,Micro E-mini NASDAQ-100,26711.5,4,04/17/2026 16:44:42,470913240362, Filled,-2,0,0.25,,470913240362,04/17/2026 16:44:42,4/17/26,4,Tradingview, Limit,26712.00,,26712.0,,4,26711.50,26711.5,,\"213,692.00\",USD",
                "470913240365,APEX4855840000004,470913240365, Sell,MNQM6,MNQ,Micro E-mini NASDAQ-100,,,,470913240389, Canceled,-2,0,0.25,,470913240389,04/17/2026 16:46:50,4/17/26,4,Tradingview, Limit,26884.75,,26884.75,,,,,,,USD",
                "470913240367,APEX4855840000004,470913240367, Sell,MNQM6,MNQ,Micro E-mini NASDAQ-100,,,,470913240393, Canceled,-2,0,0.25,,470913240393,04/17/2026 17:34:34,4/17/26,4,Tradingview, Stop,,26712.25,,26712.25,,,,,,USD",
                "470913240403,APEX4855840000004,470913240403, Sell,MNQM6,MNQ,Micro E-mini NASDAQ-100,26788.0,4,04/17/2026 17:36:58,470913240403, Filled,-2,0,0.25,,470913240403,04/17/2026 17:36:58,4/17/26,4,Exit, Market,,,,,4,26788.00,26788.0,,\"214,304.00\",USD"
        );
    }

    private String tradovateHeader() {
        return "orderId,Account,Order ID,B/S,Contract,Product,Product Description,avgPrice,filledQty,Fill Time,lastCommandId,Status,_priceFormat,_priceFormatType,_tickSize,spreadDefinitionId,Version ID,Timestamp,Date,Quantity,Text,Type,Limit Price,Stop Price,decimalLimit,decimalStop,Filled Qty,Avg Fill Price,decimalFillAvg,Venue,Notional Value,Currency";
    }
}
