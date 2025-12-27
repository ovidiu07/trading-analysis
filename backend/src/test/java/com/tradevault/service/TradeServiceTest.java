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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

public class TradeServiceTest {
    private TradeRepository tradeRepository;
    private AccountRepository accountRepository;
    private TagRepository tagRepository;
    private CurrentUserService currentUserService;
    private TradeService tradeService;
    private User user;

    @BeforeEach
    void setup() {
        tradeRepository = Mockito.mock(TradeRepository.class);
        accountRepository = Mockito.mock(AccountRepository.class);
        tagRepository = Mockito.mock(TagRepository.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        tradeService = new TradeService(tradeRepository, accountRepository, tagRepository, currentUserService);
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
        assertEquals(new BigDecimal("2000.0000"), response.getPnlGross());
        assertEquals(new BigDecimal("1995.0000"), response.getPnlNet());
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
