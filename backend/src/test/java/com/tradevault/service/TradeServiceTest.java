package com.tradevault.service;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.trade.TradeRequest;
import com.tradevault.repository.AccountRepository;
import com.tradevault.repository.TagRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.service.TimezoneService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class TradeServiceTest {
    private TradeRepository tradeRepository;
    private AccountRepository accountRepository;
    private TagRepository tagRepository;
    private CurrentUserService currentUserService;
    private TimezoneService timezoneService;
    private TradeService tradeService;
    private User user;

    @BeforeEach
    void setup() {
        tradeRepository = Mockito.mock(TradeRepository.class);
        accountRepository = Mockito.mock(AccountRepository.class);
        tagRepository = Mockito.mock(TagRepository.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        timezoneService = Mockito.mock(TimezoneService.class);
        tradeService = new TradeService(tradeRepository, accountRepository, tagRepository, currentUserService, timezoneService);
        user = User.builder().id(UUID.randomUUID()).email("user@test.com").build();
        when(currentUserService.getCurrentUser()).thenReturn(user);
    }

    @Test
    void calculatesPnlForLongTrade() {
        TradeRequest request = baseRequest();
        request.setDirection(Direction.LONG);
        request.setExitPrice(new BigDecimal("120"));

        when(tradeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0, Trade.class));

        var response = tradeService.create(request);
        assertEquals(new BigDecimal("2000"), response.getPnlGross());
        assertEquals(new BigDecimal("1995"), response.getPnlNet());
    }

    @Test
    void updatesExistingTradeForCurrentUser() {
        Trade existing = Trade.builder()
                .id(UUID.randomUUID())
                .user(user)
                .symbol("AAPL")
                .market(Market.STOCK)
                .direction(Direction.LONG)
                .status(TradeStatus.OPEN)
                .openedAt(OffsetDateTime.now().minusDays(2))
                .quantity(new BigDecimal("50"))
                .entryPrice(new BigDecimal("10"))
                .fees(BigDecimal.ZERO)
                .commission(BigDecimal.ZERO)
                .slippage(BigDecimal.ZERO)
                .build();

        TradeRequest updateRequest = baseRequest();
        updateRequest.setDirection(Direction.SHORT);
        updateRequest.setSymbol("MSFT");
        updateRequest.setEntryPrice(new BigDecimal("20"));
        updateRequest.setExitPrice(new BigDecimal("10"));
        updateRequest.setQuantity(new BigDecimal("10"));

        when(tradeRepository.findByIdAndUserId(existing.getId(), user.getId())).thenReturn(java.util.Optional.of(existing));
        when(tradeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0, Trade.class));

        var response = tradeService.update(existing.getId(), updateRequest);

        assertEquals("MSFT", response.getSymbol());
        assertEquals(Direction.SHORT, response.getDirection());
        assertEquals(new BigDecimal("100"), response.getPnlGross());
    }

    @Test
    void updateNonPnlFieldsDoesNotChangePnl() {
        OffsetDateTime opened = OffsetDateTime.now().minusDays(2);
        OffsetDateTime closed = OffsetDateTime.now().minusDays(1);
        Trade existing = Trade.builder()
                .id(UUID.randomUUID())
                .user(user)
                .symbol("AAPL")
                .market(Market.STOCK)
                .direction(Direction.LONG)
                .status(TradeStatus.CLOSED)
                .openedAt(opened)
                .closedAt(closed)
                .quantity(new BigDecimal("100"))
                .entryPrice(new BigDecimal("100"))
                .exitPrice(new BigDecimal("120"))
                .fees(new BigDecimal("2"))
                .commission(new BigDecimal("3"))
                .slippage(BigDecimal.ZERO)
                .pnlGross(new BigDecimal("2000"))
                .pnlNet(new BigDecimal("1995"))
                .pnlPercent(new BigDecimal("0"))
                .build();

        TradeRequest updateRequest = new TradeRequest();
        updateRequest.setSymbol("AAPL");
        updateRequest.setMarket(Market.STOCK);
        updateRequest.setDirection(Direction.LONG);
        updateRequest.setStatus(TradeStatus.CLOSED);
        updateRequest.setOpenedAt(opened);
        updateRequest.setClosedAt(closed);
        updateRequest.setQuantity(new BigDecimal("100"));
        updateRequest.setEntryPrice(new BigDecimal("100"));
        updateRequest.setExitPrice(new BigDecimal("120"));
        updateRequest.setFees(new BigDecimal("2"));
        updateRequest.setCommission(new BigDecimal("3"));
        updateRequest.setSlippage(BigDecimal.ZERO);
        updateRequest.setNotes("updated notes");
        // client tries to modify pnl but it should be ignored since inputs didn't change

        when(tradeRepository.findByIdAndUserId(existing.getId(), user.getId())).thenReturn(java.util.Optional.of(existing));
        when(tradeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0, Trade.class));

        var response = tradeService.update(existing.getId(), updateRequest);

        assertEquals(new BigDecimal("2000"), response.getPnlGross());
        assertEquals(new BigDecimal("1995"), response.getPnlNet());
        assertEquals("updated notes", response.getNotes());

        ArgumentCaptor<Trade> captor = ArgumentCaptor.forClass(Trade.class);
        verify(tradeRepository).save(captor.capture());
        Trade saved = captor.getValue();
        assertEquals(new BigDecimal("2000"), saved.getPnlGross());
        assertEquals(new BigDecimal("1995"), saved.getPnlNet());
    }

    @Test
    void updateDrivingFieldRecalculatesAndOverridesClientPnl() {
        OffsetDateTime opened = OffsetDateTime.now().minusDays(2);
        OffsetDateTime closed = OffsetDateTime.now().minusDays(1);
        Trade existing = Trade.builder()
                .id(UUID.randomUUID())
                .user(user)
                .symbol("AAPL")
                .market(Market.STOCK)
                .direction(Direction.LONG)
                .status(TradeStatus.CLOSED)
                .openedAt(opened)
                .closedAt(closed)
                .quantity(new BigDecimal("100"))
                .entryPrice(new BigDecimal("100"))
                .exitPrice(new BigDecimal("120"))
                .fees(new BigDecimal("2"))
                .commission(new BigDecimal("3"))
                .slippage(BigDecimal.ZERO)
                .pnlGross(new BigDecimal("2000"))
                .pnlNet(new BigDecimal("1995"))
                .build();

        TradeRequest updateRequest = new TradeRequest();
        updateRequest.setSymbol("AAPL");
        updateRequest.setMarket(Market.STOCK);
        updateRequest.setDirection(Direction.LONG);
        updateRequest.setStatus(TradeStatus.CLOSED);
        updateRequest.setOpenedAt(opened);
        updateRequest.setClosedAt(closed);
        updateRequest.setQuantity(new BigDecimal("100"));
        updateRequest.setEntryPrice(new BigDecimal("100"));
        // change exit price to trigger recalculation
        updateRequest.setExitPrice(new BigDecimal("130"));
        updateRequest.setFees(new BigDecimal("2"));
        updateRequest.setCommission(new BigDecimal("3"));
        updateRequest.setSlippage(BigDecimal.ZERO);


        when(tradeRepository.findByIdAndUserId(existing.getId(), user.getId())).thenReturn(java.util.Optional.of(existing));
        when(tradeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0, Trade.class));

        var response = tradeService.update(existing.getId(), updateRequest);

        assertEquals(new BigDecimal("3000"), response.getPnlGross());
        assertEquals(new BigDecimal("2995"), response.getPnlNet());

        ArgumentCaptor<Trade> captor = ArgumentCaptor.forClass(Trade.class);
        verify(tradeRepository).save(captor.capture());
        Trade saved = captor.getValue();
        assertEquals(new BigDecimal("3000"), saved.getPnlGross());
        assertEquals(new BigDecimal("2995"), saved.getPnlNet());
    }

    @Test
    void updatingToOpenTradeNullsPnl() {
        OffsetDateTime opened = OffsetDateTime.now().minusDays(2);
        Trade existing = Trade.builder()
                .id(UUID.randomUUID())
                .user(user)
                .symbol("AAPL")
                .market(Market.STOCK)
                .direction(Direction.LONG)
                .status(TradeStatus.CLOSED)
                .openedAt(opened)
                .closedAt(OffsetDateTime.now().minusDays(1))
                .quantity(new BigDecimal("100"))
                .entryPrice(new BigDecimal("100"))
                .exitPrice(new BigDecimal("120"))
                .fees(new BigDecimal("2"))
                .commission(new BigDecimal("3"))
                .slippage(BigDecimal.ZERO)
                .pnlGross(new BigDecimal("2000"))
                .pnlNet(new BigDecimal("1995"))
                .build();

        TradeRequest updateRequest = new TradeRequest();
        updateRequest.setSymbol("AAPL");
        updateRequest.setMarket(Market.STOCK);
        updateRequest.setDirection(Direction.LONG);
        updateRequest.setStatus(TradeStatus.OPEN);
        updateRequest.setOpenedAt(opened);
        updateRequest.setClosedAt(null);
        updateRequest.setQuantity(new BigDecimal("100"));
        updateRequest.setEntryPrice(new BigDecimal("100"));
        // remove exit price -> open trade
        updateRequest.setExitPrice(null);
        updateRequest.setFees(new BigDecimal("2"));
        updateRequest.setCommission(new BigDecimal("3"));
        updateRequest.setSlippage(BigDecimal.ZERO);

        when(tradeRepository.findByIdAndUserId(existing.getId(), user.getId())).thenReturn(java.util.Optional.of(existing));
        when(tradeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0, Trade.class));

        var response = tradeService.update(existing.getId(), updateRequest);

        assertNull(response.getPnlGross());
        assertNull(response.getPnlNet());
        assertNull(response.getPnlPercent());
    }

    @Test
    void createIgnoresClientProvidedPnl() {
        TradeRequest request = baseRequest();
        request.setExitPrice(new BigDecimal("120"));


        when(tradeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0, Trade.class));

        var response = tradeService.create(request);
        // server computes authoritatively
        assertEquals(new BigDecimal("2000"), response.getPnlGross());
        assertEquals(new BigDecimal("1995"), response.getPnlNet());
    }

    @Test
    void deletesTradeForUser() {
        UUID tradeId = UUID.randomUUID();
        Trade trade = Trade.builder().id(tradeId).user(user).build();
        when(tradeRepository.findByIdAndUserId(tradeId, user.getId())).thenReturn(java.util.Optional.of(trade));

        tradeService.delete(tradeId);

        verify(tradeRepository).delete(eq(trade));
    }

    private TradeRequest baseRequest() {
        TradeRequest request = new TradeRequest();
        request.setSymbol("AAPL");
        request.setMarket(Market.STOCK);
        request.setDirection(Direction.LONG);
        request.setStatus(TradeStatus.CLOSED);
        request.setOpenedAt(OffsetDateTime.now().minusDays(1));
        request.setClosedAt(OffsetDateTime.now());
        request.setQuantity(new BigDecimal("100"));
        request.setEntryPrice(new BigDecimal("100"));
        request.setFees(new BigDecimal("2"));
        request.setCommission(new BigDecimal("3"));
        request.setSlippage(BigDecimal.ZERO);
        request.setNotes("test");
        return request;
    }
}
