package com.tradevault.service;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.entity.UserStrategy;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.trade.ImportedTradeCandidate;
import com.tradevault.dto.trade.TradeRequest;
import com.tradevault.exception.TradeSearchValidationException;
import com.tradevault.repository.AccountRepository;
import com.tradevault.repository.TagRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.repository.UserStrategyRepository;
import com.tradevault.service.TimezoneService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.never;

public class TradeServiceTest {
    private TradeRepository tradeRepository;
    private AccountRepository accountRepository;
    private TagRepository tagRepository;
    private UserStrategyRepository userStrategyRepository;
    private CurrentUserService currentUserService;
    private TimezoneService timezoneService;
    private TradeService tradeService;
    private User user;

    @BeforeEach
    void setup() {
        tradeRepository = Mockito.mock(TradeRepository.class);
        accountRepository = Mockito.mock(AccountRepository.class);
        tagRepository = Mockito.mock(TagRepository.class);
        userStrategyRepository = Mockito.mock(UserStrategyRepository.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        timezoneService = Mockito.mock(TimezoneService.class);
        tradeService = new TradeService(tradeRepository, accountRepository, tagRepository, userStrategyRepository, currentUserService, timezoneService);
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
    void calculatesPnlPercentFromCapitalUsedAndRMultipleFromRiskAmount() {
        TradeRequest request = baseRequest();
        request.setDirection(Direction.LONG);
        request.setExitPrice(new BigDecimal("130.60"));
        request.setRiskAmount(new BigDecimal("250"));
        request.setCapitalUsed(new BigDecimal("500"));
        request.setFees(BigDecimal.ZERO);
        request.setCommission(BigDecimal.ZERO);
        request.setSlippage(BigDecimal.ZERO);
        request.setQuantity(BigDecimal.TEN);
        request.setEntryPrice(new BigDecimal("100"));

        when(tradeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0, Trade.class));

        var response = tradeService.create(request);

        assertEquals(0, response.getPnlNet().compareTo(new BigDecimal("306.00")));
        assertEquals(0, response.getPnlPercent().compareTo(new BigDecimal("61.2000")));
        assertEquals(0, response.getRMultiple().compareTo(new BigDecimal("1.2240")));
        assertEquals(0, response.getRiskPercent().compareTo(new BigDecimal("50.0000")));
    }

    @Test
    void leavesRMultipleBlankWhenRiskAmountMissingEvenIfStopLossExists() {
        TradeRequest request = baseRequest();
        request.setDirection(Direction.LONG);
        request.setExitPrice(new BigDecimal("130.60"));
        request.setCapitalUsed(new BigDecimal("500"));
        request.setStopLossPrice(new BigDecimal("95"));
        request.setFees(BigDecimal.ZERO);
        request.setCommission(BigDecimal.ZERO);
        request.setSlippage(BigDecimal.ZERO);
        request.setQuantity(BigDecimal.TEN);
        request.setEntryPrice(new BigDecimal("100"));

        when(tradeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0, Trade.class));

        var response = tradeService.create(request);

        assertEquals(0, response.getPnlNet().compareTo(new BigDecimal("306.00")));
        assertEquals(0, response.getPnlPercent().compareTo(new BigDecimal("61.2000")));
        assertNull(response.getRMultiple());
    }

    @Test
    void rejectsStrategyIdsOutsideCurrentUserScope() {
        TradeRequest request = baseRequest();
        UUID strategyId = UUID.randomUUID();
        request.setStrategyId(strategyId);
        request.setExitPrice(new BigDecimal("120"));

        when(userStrategyRepository.findByIdAndUser_Id(strategyId, user.getId())).thenReturn(java.util.Optional.empty());

        assertThrows(jakarta.persistence.EntityNotFoundException.class, () -> tradeService.create(request));
        verify(tradeRepository, never()).save(any());
    }

    @Test
    void includesStrategyNameWhenStrategyIsOwnedByCurrentUser() {
        TradeRequest request = baseRequest();
        UUID strategyId = UUID.randomUUID();
        UserStrategy strategy = UserStrategy.builder()
                .id(strategyId)
                .user(user)
                .name("London sweep")
                .model("Model")
                .entryConditionsJson("[]")
                .entryConditionsRich("<p></p>")
                .invalidationLogic("x")
                .tpFramework("x")
                .build();
        request.setStrategyId(strategyId);
        request.setExitPrice(new BigDecimal("120"));

        when(userStrategyRepository.findByIdAndUser_Id(strategyId, user.getId())).thenReturn(java.util.Optional.of(strategy));
        when(userStrategyRepository.findByIdInAndUser_Id(java.util.List.of(strategyId), user.getId())).thenReturn(java.util.List.of(strategy));
        when(tradeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0, Trade.class));

        var response = tradeService.create(request);

        assertEquals(strategyId, response.getStrategyId());
        assertEquals("London sweep", response.getStrategyName());
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
    void createAppliesFxRateToProfileCurrencyFields() {
        TradeRequest request = baseRequest();
        request.setDirection(Direction.LONG);
        request.setExitPrice(new BigDecimal("110"));
        request.setFees(new BigDecimal("2"));
        request.setCommission(new BigDecimal("3"));
        request.setTradeCurrency("EUR");
        request.setProfileCurrency("USD");
        request.setFxRateTradeToProfile(new BigDecimal("1.1000"));
        request.setFxRateSource("MANUAL");

        when(tradeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0, Trade.class));

        var response = tradeService.create(request);

        assertEquals("EUR", response.getTradeCurrency());
        assertEquals("USD", response.getProfileCurrency());
        assertEquals(new BigDecimal("1.10000000"), response.getFxRateTradeToProfile());
        assertEquals(new BigDecimal("1094.5000"), response.getPnlProfileCurrency());
        assertEquals(new BigDecimal("2.2000"), response.getFeesProfileCurrency());
    }

    @Test
    void createAcceptsBrokerStyleAccountIdAndContractMultiplier() {
        TradeRequest request = baseRequest();
        request.setExitPrice(new BigDecimal("120"));
        request.setAccountId("APEX4855840000003");
        request.setContractMultiplier(new BigDecimal("2"));

        when(tradeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0, Trade.class));

        var response = tradeService.create(request);

        assertEquals("APEX4855840000003", response.getAccountId());
        assertNull(response.getAccountRefId());
        assertEquals(new BigDecimal("2"), response.getContractMultiplier());
        assertEquals(new BigDecimal("4000"), response.getPnlGross());
        assertEquals(new BigDecimal("3995"), response.getPnlNet());
        verify(accountRepository, never()).findByIdAndUserId(any(), any());
    }

    @Test
    void upsertImportedTradePreservesExistingNotesAndJournalFields() {
        Trade existing = Trade.builder()
                .id(UUID.randomUUID())
                .user(user)
                .symbol("MNQM6")
                .brokerAccountId("APEX4855840000003")
                .market(Market.FUTURES)
                .direction(Direction.LONG)
                .status(TradeStatus.OPEN)
                .openedAt(OffsetDateTime.parse("2026-04-17T13:44:42Z"))
                .quantity(new BigDecimal("2"))
                .entryPrice(new BigDecimal("26711.5"))
                .fees(BigDecimal.ZERO)
                .commission(BigDecimal.ZERO)
                .slippage(BigDecimal.ZERO)
                .contractMultiplier(new BigDecimal("2"))
                .notes("keep me")
                .entryJournalText("keep journal")
                .build();

        ImportedTradeCandidate candidate = ImportedTradeCandidate.builder()
                .symbol("MNQM6")
                .market(Market.FUTURES)
                .direction(Direction.LONG)
                .status(TradeStatus.CLOSED)
                .openedAt(existing.getOpenedAt())
                .closedAt(OffsetDateTime.parse("2026-04-17T14:36:58Z"))
                .quantity(new BigDecimal("2"))
                .entryPrice(new BigDecimal("26711.5"))
                .exitPrice(new BigDecimal("26788"))
                .stopLossPrice(new BigDecimal("26712.25"))
                .takeProfitPrice(new BigDecimal("26884.75"))
                .tradeCurrency("USD")
                .accountId("APEX4855840000003")
                .contractMultiplier(new BigDecimal("2"))
                .initialNotes("Imported from Tradovate Orders CSV")
                .build();

        when(tradeRepository.findByUserIdAndSymbolAndDirectionAndOpenedAtAndBrokerAccountId(
                user.getId(),
                "MNQM6",
                Direction.LONG,
                existing.getOpenedAt(),
                "APEX4855840000003"
        )).thenReturn(java.util.Optional.of(existing));
        when(tradeRepository.findByIdAndUserId(existing.getId(), user.getId())).thenReturn(java.util.Optional.of(existing));
        when(tradeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0, Trade.class));

        TradeService.ImportUpsertResult result = tradeService.upsertImportedTrade(candidate);

        assertTrue(result.updated());
        assertEquals("keep me", result.trade().getNotes());
        assertEquals("keep journal", result.trade().getEntryJournalText());
        assertEquals("Imported from Tradovate Orders CSV", result.trade().getInitialNotes());
        assertEquals(0, new BigDecimal("306.0000").compareTo(result.trade().getPnlNet()));
    }

    @Test
    void upsertImportedTradeDoesNotMergeDifferentBrokerAccounts() {
        OffsetDateTime openedAt = OffsetDateTime.parse("2026-04-17T13:44:42Z");
        Trade existingOtherAccount = Trade.builder()
                .id(UUID.randomUUID())
                .user(user)
                .symbol("MNQM6")
                .brokerAccountId("APEX4855840000003")
                .market(Market.FUTURES)
                .direction(Direction.LONG)
                .status(TradeStatus.CLOSED)
                .openedAt(openedAt)
                .closedAt(OffsetDateTime.parse("2026-04-17T14:36:58Z"))
                .quantity(new BigDecimal("2"))
                .entryPrice(new BigDecimal("26711.5"))
                .exitPrice(new BigDecimal("26788"))
                .fees(BigDecimal.ZERO)
                .commission(BigDecimal.ZERO)
                .slippage(BigDecimal.ZERO)
                .contractMultiplier(new BigDecimal("2"))
                .build();

        ImportedTradeCandidate candidate = ImportedTradeCandidate.builder()
                .symbol("MNQM6")
                .market(Market.FUTURES)
                .direction(Direction.LONG)
                .status(TradeStatus.CLOSED)
                .openedAt(openedAt)
                .closedAt(OffsetDateTime.parse("2026-04-17T14:36:58Z"))
                .quantity(new BigDecimal("4"))
                .entryPrice(new BigDecimal("26711.5"))
                .exitPrice(new BigDecimal("26788"))
                .accountId("APEX4855840000005")
                .contractMultiplier(new BigDecimal("2"))
                .build();

        when(tradeRepository.findByUserIdAndSymbolAndDirectionAndOpenedAtAndBrokerAccountId(
                user.getId(),
                "MNQM6",
                Direction.LONG,
                openedAt,
                "APEX4855840000005"
        )).thenReturn(java.util.Optional.empty());
        when(tradeRepository.findByUserIdAndSymbolAndDirectionAndOpenedAt(
                user.getId(),
                "MNQM6",
                Direction.LONG,
                openedAt
        )).thenReturn(java.util.Optional.of(existingOtherAccount));
        when(tradeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0, Trade.class));

        TradeService.ImportUpsertResult result = tradeService.upsertImportedTrade(candidate);

        assertFalse(result.updated());
        assertEquals("APEX4855840000005", result.trade().getAccountId());
        verify(tradeRepository, never()).findByUserIdAndSymbolAndDirectionAndOpenedAt(
                user.getId(),
                "MNQM6",
                Direction.LONG,
                openedAt
        );
    }

    @Test
    void createDefaultsNarrativeSnapshotToEmptyObjectWhenRequestOmitsIt() {
        TradeRequest request = baseRequest();
        request.setStatus(TradeStatus.OPEN);
        request.setClosedAt(null);
        request.setExitPrice(null);
        request.setNarrativeSnapshotJson(null);

        when(tradeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0, Trade.class));

        var response = tradeService.create(request);

        assertNotNull(response.getNarrativeSnapshotJson());
        assertTrue(response.getNarrativeSnapshotJson().isObject());
        assertEquals(0, response.getNarrativeSnapshotJson().size());

        ArgumentCaptor<Trade> captor = ArgumentCaptor.forClass(Trade.class);
        verify(tradeRepository).save(captor.capture());
        assertNotNull(captor.getValue().getNarrativeSnapshotJson());
    }

    @Test
    void updatePreservesNarrativeSnapshotWhenRequestOmitsIt() {
        ObjectNode existingNarrative = JsonNodeFactory.instance.objectNode().put("source", "session");
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
                .narrativeSnapshotJson(existingNarrative)
                .build();

        TradeRequest updateRequest = new TradeRequest();
        updateRequest.setSymbol(existing.getSymbol());
        updateRequest.setMarket(existing.getMarket());
        updateRequest.setDirection(existing.getDirection());
        updateRequest.setStatus(existing.getStatus());
        updateRequest.setOpenedAt(existing.getOpenedAt());
        updateRequest.setClosedAt(existing.getClosedAt());
        updateRequest.setQuantity(existing.getQuantity());
        updateRequest.setEntryPrice(existing.getEntryPrice());
        updateRequest.setExitPrice(existing.getExitPrice());
        updateRequest.setFees(BigDecimal.ZERO);
        updateRequest.setCommission(BigDecimal.ZERO);
        updateRequest.setSlippage(BigDecimal.ZERO);
        updateRequest.setNarrativeSnapshotJson(null);

        when(tradeRepository.findByIdAndUserId(existing.getId(), user.getId())).thenReturn(java.util.Optional.of(existing));
        when(tradeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0, Trade.class));

        var response = tradeService.update(existing.getId(), updateRequest);

        assertEquals(existingNarrative, response.getNarrativeSnapshotJson());

        ArgumentCaptor<Trade> captor = ArgumentCaptor.forClass(Trade.class);
        verify(tradeRepository).save(captor.capture());
        assertEquals(existingNarrative, captor.getValue().getNarrativeSnapshotJson());
    }

    @Test
    void createUsesIdentityRateWhenCurrenciesMatch() {
        TradeRequest request = baseRequest();
        request.setExitPrice(new BigDecimal("120"));
        request.setTradeCurrency("USD");
        request.setProfileCurrency("USD");
        request.setFxRateTradeToProfile(new BigDecimal("1.2500"));
        request.setFxRateSource("MANUAL");

        when(tradeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0, Trade.class));

        var response = tradeService.create(request);

        assertEquals(new BigDecimal("1"), response.getFxRateTradeToProfile());
        assertEquals("IDENTITY", response.getFxRateSource());
        assertEquals(0, response.getPnlNet().compareTo(response.getPnlProfileCurrency()));
    }

    @Test
    void updateRecalculatesProfileCurrencyWhenOnlyFxRateChanges() {
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
                .tradeCurrency("EUR")
                .profileCurrency("USD")
                .fxRateTradeToProfile(new BigDecimal("1.10000000"))
                .fxRateSource("MANUAL")
                .pnlProfileCurrency(new BigDecimal("2194.5000"))
                .feesProfileCurrency(new BigDecimal("2.2000"))
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
        updateRequest.setTradeCurrency("EUR");
        updateRequest.setProfileCurrency("USD");
        updateRequest.setFxRateTradeToProfile(new BigDecimal("1.2000"));
        updateRequest.setFxRateSource("MANUAL");

        when(tradeRepository.findByIdAndUserId(existing.getId(), user.getId())).thenReturn(java.util.Optional.of(existing));
        when(tradeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0, Trade.class));

        var response = tradeService.update(existing.getId(), updateRequest);

        assertEquals(new BigDecimal("1995"), response.getPnlNet());
        assertEquals(new BigDecimal("2394.0000"), response.getPnlProfileCurrency());
        assertEquals(new BigDecimal("2.4000"), response.getFeesProfileCurrency());
        assertEquals(new BigDecimal("1.20000000"), response.getFxRateTradeToProfile());
    }

    @Test
    void deletesTradeForUser() {
        UUID tradeId = UUID.randomUUID();
        Trade trade = Trade.builder().id(tradeId).user(user).build();
        when(tradeRepository.findByIdAndUserId(tradeId, user.getId())).thenReturn(java.util.Optional.of(trade));

        tradeService.delete(tradeId);

        verify(tradeRepository).delete(eq(trade));
    }

    @Test
    void openedAtToDateOnlyUsesInclusiveEndOfDayInBucharest() {
        ZoneId zone = ZoneId.of("Europe/Bucharest");
        OffsetDateTime parsedTo = ReflectionTestUtils.invokeMethod(
                tradeService,
                "parseDateTimeFilter",
                "2026-02-06",
                zone,
                true,
                "openedAtTo"
        );

        assertNotNull(parsedTo);
        assertEquals(OffsetDateTime.parse("2026-02-06T23:59:59.999999999+02:00"), parsedTo);
        OffsetDateTime tradeOpenedAt = OffsetDateTime.parse("2026-02-06T18:08:00+02:00");
        assertFalse(tradeOpenedAt.isAfter(parsedTo));
    }

    @Test
    void searchRejectsOpenedRangeWhenFromIsAfterTo() {
        when(timezoneService.resolveZone(null, user)).thenReturn(ZoneId.of("Europe/Bucharest"));

        TradeSearchValidationException ex = assertThrows(
                TradeSearchValidationException.class,
                () -> tradeService.search(
                        0,
                        50,
                        "2026-02-07",
                        "2026-02-06",
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null
                )
        );

        assertEquals("Invalid date range: 'openedAtFrom' must be before or equal to 'openedAtTo'.", ex.getMessage());
        Map<String, Object> details = (Map<String, Object>) ex.getDetails();
        List<Map<String, String>> fieldErrors = (List<Map<String, String>>) details.get("fieldErrors");
        assertEquals("openedAtFrom", fieldErrors.get(0).get("field"));
        assertEquals("openedAtTo", fieldErrors.get(1).get("field"));
        verify(tradeRepository, never()).searchTradeIds(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void updateEntryJournalPersistsJournalFieldsAndScreenshotAssetIds() {
        UUID tradeId = UUID.randomUUID();
        Trade existing = Trade.builder()
                .id(tradeId)
                .user(user)
                .symbol("EURUSD")
                .market(Market.FOREX)
                .direction(Direction.LONG)
                .status(TradeStatus.OPEN)
                .openedAt(OffsetDateTime.now().minusMinutes(15))
                .quantity(new BigDecimal("1"))
                .entryPrice(new BigDecimal("1.08"))
                .build();
        when(tradeRepository.findByIdAndUserId(tradeId, user.getId())).thenReturn(java.util.Optional.of(existing));
        when(tradeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0, Trade.class));

        UUID assetId = UUID.randomUUID();
        var response = tradeService.updateEntryJournal(
                tradeId,
                "Sweep + displacement close on M5",
                "I'm wrong if price closes below the sweep origin.",
                "Focused",
                Set.of(assetId)
        );

        assertEquals("Sweep + displacement close on M5", response.getEntryJournalText());
        assertEquals("I'm wrong if price closes below the sweep origin.", response.getEntryInvalidation());
        assertEquals(Set.of(assetId), response.getEntryScreenshotAssetIds());
        assertEquals("Focused", response.getFeeling());
    }

    @Test
    void searchPassesBrokerAccountFilterToRepository() {
        when(timezoneService.resolveZone(null, user)).thenReturn(ZoneId.of("UTC"));
        when(tradeRepository.searchTradeIds(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of()));

        tradeService.search(
                0,
                20,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                " APEX4855840000003 ",
                null,
                null
        );

        verify(tradeRepository).searchTradeIds(
                eq(user.getId()),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                eq("APEX4855840000003"),
                isNull(),
                isNull(),
                isNull(),
                any()
        );
    }

    @Test
    void dailySummaryBuildsPerAccountBreakdown() {
        LocalDate date = LocalDate.of(2026, 4, 17);
        ZoneId zone = ZoneId.of("Europe/Bucharest");
        UUID firstId = UUID.randomUUID();
        UUID secondId = UUID.randomUUID();

        when(timezoneService.resolveZone("Europe/Bucharest", user)).thenReturn(zone);
        when(tradeRepository.findClosedTradeIdsForLocalDate(user.getId(), date, zone.getId(), null, null))
                .thenReturn(List.of(firstId, secondId));
        when(tradeRepository.findAllByIdInWithTagsAndAccount(List.of(firstId, secondId)))
                .thenReturn(List.of(
                        Trade.builder()
                                .id(firstId)
                                .user(user)
                                .brokerAccountId("APEX4855840000003")
                                .pnlNet(new BigDecimal("150"))
                                .build(),
                        Trade.builder()
                                .id(secondId)
                                .user(user)
                                .brokerAccountId("APEX4855840000004")
                                .pnlNet(new BigDecimal("-45"))
                                .build()
                ));

        var summary = tradeService.dailySummary(date, "Europe/Bucharest", null);

        assertEquals(new BigDecimal("105"), summary.getNetPnl());
        assertEquals(2, summary.getTradeCount());
        assertEquals(2, summary.getAccounts().size());
        assertEquals("APEX4855840000003", summary.getAccounts().get(0).getAccountId());
        assertEquals(new BigDecimal("150"), summary.getAccounts().get(0).getNetPnl());
        assertEquals("APEX4855840000004", summary.getAccounts().get(1).getAccountId());
        assertEquals(new BigDecimal("-45"), summary.getAccounts().get(1).getNetPnl());
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
