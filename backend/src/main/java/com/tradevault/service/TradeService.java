package com.tradevault.service;

import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.Tag;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.dto.trade.TradeRequest;
import com.tradevault.dto.trade.TradeResponse;
import com.tradevault.repository.AccountRepository;
import com.tradevault.repository.TagRepository;
import com.tradevault.repository.TradeRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TradeService {
    private final TradeRepository tradeRepository;
    private final AccountRepository accountRepository;
    private final TagRepository tagRepository;
    private final CurrentUserService currentUserService;

    public Page<TradeResponse> search(int page, int size,
                                      OffsetDateTime openedAtFrom,
                                      OffsetDateTime openedAtTo,
                                      OffsetDateTime closedAtFrom,
                                      OffsetDateTime closedAtTo,
                                      String symbol,
                                      Direction direction) {
        User user = currentUserService.getCurrentUser();
        var pageable = PageRequest.of(Math.max(page, 0), size, Sort.by(Sort.Direction.DESC, "openedAt", "createdAt"));
        var normalizedSymbol = (symbol == null || symbol.isBlank()) ? null : symbol;

        var result = tradeRepository.search(
                user.getId(),
                openedAtFrom,
                openedAtTo,
                closedAtFrom,
                closedAtTo,
                normalizedSymbol,
                null,
                direction,
                null,
                pageable
        );
        return result.map(this::toResponse);
    }

    public Page<TradeResponse> listAll(int page, int size) {
        User user = currentUserService.getCurrentUser();
        var pageable = PageRequest.of(Math.max(page, 0), size, Sort.by(Sort.Direction.DESC, "openedAt", "createdAt"));
        return tradeRepository.findByUserIdOrderByOpenedAtDescCreatedAtDesc(user.getId(), pageable).map(this::toResponse);
    }

    @Transactional
    public TradeResponse create(TradeRequest request) {
        User user = currentUserService.getCurrentUser();
        Trade trade = new Trade();
        trade.setUser(user);
        trade.setSymbol(request.getSymbol());
        trade.setMarket(request.getMarket());
        trade.setDirection(request.getDirection());
        trade.setStatus(request.getStatus());
        trade.setOpenedAt(request.getOpenedAt());
        trade.setClosedAt(request.getClosedAt());
        trade.setQuantity(request.getQuantity());
        trade.setEntryPrice(request.getEntryPrice());
        trade.setExitPrice(request.getExitPrice());
        trade.setStopLossPrice(request.getStopLossPrice());
        trade.setTakeProfitPrice(request.getTakeProfitPrice());
        trade.setFees(defaultZero(request.getFees()));
        trade.setCommission(defaultZero(request.getCommission()));
        trade.setSlippage(defaultZero(request.getSlippage()));
        trade.setPnlGross(request.getPnlGross());
        trade.setPnlNet(request.getPnlNet());
        trade.setPnlPercent(request.getPnlPercent());
        trade.setRiskAmount(request.getRiskAmount());
        trade.setRiskPercent(request.getRiskPercent());
        trade.setRMultiple(request.getRMultiple());
        trade.setCapitalUsed(request.getCapitalUsed());
        trade.setTimeframe(request.getTimeframe());
        trade.setSetup(request.getSetup());
        trade.setStrategyTag(request.getStrategyTag());
        trade.setCatalystTag(request.getCatalystTag());
        trade.setNotes(request.getNotes());
        trade.setCreatedAt(OffsetDateTime.now());
        if (request.getAccountId() != null) {
            Account account = accountRepository.findByIdAndUserId(request.getAccountId(), user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Account not found"));
            trade.setAccount(account);
        }
        if (request.getTagIds() != null && !request.getTagIds().isEmpty()) {
            Set<Tag> tags = tagRepository.findAllById(request.getTagIds()).stream().filter(t -> t.getUser().getId().equals(user.getId())).collect(Collectors.toSet());
            trade.setTags(tags);
        }
        calculateMetrics(trade);
        return toResponse(tradeRepository.save(trade));
    }

    @Transactional
    public TradeResponse update(UUID id, TradeRequest request) {
        User user = currentUserService.getCurrentUser();
        Trade trade = tradeRepository.findByIdAndUserId(id, user.getId()).orElseThrow(() -> new EntityNotFoundException("Trade not found"));
        trade.setSymbol(request.getSymbol());
        trade.setMarket(request.getMarket());
        trade.setDirection(request.getDirection());
        trade.setStatus(request.getStatus());
        trade.setOpenedAt(request.getOpenedAt());
        trade.setClosedAt(request.getClosedAt());
        trade.setQuantity(request.getQuantity());
        trade.setEntryPrice(request.getEntryPrice());
        trade.setExitPrice(request.getExitPrice());
        trade.setStopLossPrice(request.getStopLossPrice());
        trade.setTakeProfitPrice(request.getTakeProfitPrice());
        trade.setFees(defaultZero(request.getFees()));
        trade.setCommission(defaultZero(request.getCommission()));
        trade.setSlippage(defaultZero(request.getSlippage()));
        trade.setPnlGross(request.getPnlGross());
        trade.setPnlNet(request.getPnlNet());
        trade.setPnlPercent(request.getPnlPercent());
        trade.setRiskAmount(request.getRiskAmount());
        trade.setRiskPercent(request.getRiskPercent());
        trade.setRMultiple(request.getRMultiple());
        trade.setCapitalUsed(request.getCapitalUsed());
        trade.setTimeframe(request.getTimeframe());
        trade.setSetup(request.getSetup());
        trade.setStrategyTag(request.getStrategyTag());
        trade.setCatalystTag(request.getCatalystTag());
        trade.setNotes(request.getNotes());
        if (request.getAccountId() != null) {
            Account account = accountRepository.findByIdAndUserId(request.getAccountId(), user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Account not found"));
            trade.setAccount(account);
        } else {
            trade.setAccount(null);
        }
        if (request.getTagIds() != null) {
            Set<Tag> tags = tagRepository.findAllById(request.getTagIds()).stream().filter(t -> t.getUser().getId().equals(user.getId())).collect(Collectors.toSet());
            trade.setTags(tags);
        }
        calculateMetrics(trade);
        return toResponse(tradeRepository.save(trade));
    }

    public void delete(UUID id) {
        User user = currentUserService.getCurrentUser();
        Trade trade = tradeRepository.findByIdAndUserId(id, user.getId()).orElseThrow(() -> new EntityNotFoundException("Trade not found"));
        tradeRepository.delete(trade);
    }

    private BigDecimal defaultZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private void calculateMetrics(Trade trade) {
        if (trade.getExitPrice() != null) {
            BigDecimal priceDiff = trade.getDirection() == Direction.LONG ?
                    trade.getExitPrice().subtract(trade.getEntryPrice()) :
                    trade.getEntryPrice().subtract(trade.getExitPrice());
            BigDecimal pnlGross = priceDiff.multiply(trade.getQuantity());
            BigDecimal totalCosts = defaultZero(trade.getFees()).add(defaultZero(trade.getCommission())).add(defaultZero(trade.getSlippage()));
            BigDecimal pnlNet = pnlGross.subtract(totalCosts);
            if (trade.getPnlGross() == null) {
                trade.setPnlGross(pnlGross);
            }
            if (trade.getPnlNet() == null) {
                trade.setPnlNet(pnlNet);
            }
            if (trade.getPnlPercent() == null) {
                if (trade.getRiskAmount() != null && trade.getRiskAmount().compareTo(BigDecimal.ZERO) != 0) {
                    trade.setPnlPercent(pnlNet.divide(trade.getRiskAmount(), 4, java.math.RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)));
                } else if (trade.getCapitalUsed() != null && trade.getCapitalUsed().compareTo(BigDecimal.ZERO) != 0) {
                    trade.setPnlPercent(pnlNet.divide(trade.getCapitalUsed(), 4, java.math.RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)));
                }
            }
            if (trade.getRMultiple() == null) {
                if (trade.getRiskAmount() != null && trade.getRiskAmount().compareTo(BigDecimal.ZERO) != 0) {
                    trade.setRMultiple(pnlNet.divide(trade.getRiskAmount(), 4, java.math.RoundingMode.HALF_UP));
                } else if (trade.getStopLossPrice() != null) {
                    BigDecimal riskPerUnit = trade.getDirection() == Direction.LONG ?
                            trade.getEntryPrice().subtract(trade.getStopLossPrice()) :
                            trade.getStopLossPrice().subtract(trade.getEntryPrice());
                    if (riskPerUnit.compareTo(BigDecimal.ZERO) > 0) {
                        BigDecimal riskValue = riskPerUnit.multiply(trade.getQuantity());
                        trade.setRMultiple(pnlNet.divide(riskValue, 4, java.math.RoundingMode.HALF_UP));
                    }
                }
            }
        }
    }

    private TradeResponse toResponse(Trade trade) {
        return TradeResponse.builder()
                .id(trade.getId())
                .symbol(trade.getSymbol())
                .market(trade.getMarket())
                .direction(trade.getDirection())
                .status(trade.getStatus())
                .openedAt(trade.getOpenedAt())
                .closedAt(trade.getClosedAt())
                .quantity(trade.getQuantity())
                .entryPrice(trade.getEntryPrice())
                .exitPrice(trade.getExitPrice())
                .stopLossPrice(trade.getStopLossPrice())
                .takeProfitPrice(trade.getTakeProfitPrice())
                .fees(trade.getFees())
                .commission(trade.getCommission())
                .slippage(trade.getSlippage())
                .pnlGross(trade.getPnlGross())
                .pnlNet(trade.getPnlNet())
                .pnlPercent(trade.getPnlPercent())
                .rMultiple(trade.getRMultiple())
                .riskAmount(trade.getRiskAmount())
                .riskPercent(trade.getRiskPercent())
                .capitalUsed(trade.getCapitalUsed())
                .timeframe(trade.getTimeframe())
                .setup(trade.getSetup())
                .strategyTag(trade.getStrategyTag())
                .catalystTag(trade.getCatalystTag())
                .notes(trade.getNotes())
                .createdAt(trade.getCreatedAt())
                .updatedAt(trade.getUpdatedAt())
                .tags(trade.getTags().stream().map(Tag::getName).collect(Collectors.toSet()))
                .build();
    }
}
