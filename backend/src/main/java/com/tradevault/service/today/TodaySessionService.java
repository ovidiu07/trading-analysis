package com.tradevault.service.today;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.ChecklistTemplate;
import com.tradevault.domain.entity.ChecklistTemplateEntry;
import com.tradevault.domain.entity.ChecklistTemplateItem;
import com.tradevault.domain.entity.TodaySession;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TodaySessionStatus;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.session.ChecklistTemplateRequest;
import com.tradevault.dto.session.ChecklistTemplateResponse;
import com.tradevault.dto.session.CloseSessionTradeRequest;
import com.tradevault.dto.session.SessionChecklistItemDto;
import com.tradevault.dto.session.StartSessionTradeRequest;
import com.tradevault.dto.session.TodaySessionChecklistUpdateRequest;
import com.tradevault.dto.session.TodaySessionConfigRequest;
import com.tradevault.dto.session.TodaySessionPlannedTickersRequest;
import com.tradevault.dto.session.TodaySessionResponse;
import com.tradevault.dto.trade.TradeRequest;
import com.tradevault.dto.trade.TradeResponse;
import com.tradevault.repository.ChecklistTemplateEntryRepository;
import com.tradevault.repository.ChecklistTemplateItemRepository;
import com.tradevault.repository.ChecklistTemplateRepository;
import com.tradevault.repository.TodaySessionRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.TimezoneService;
import com.tradevault.service.TradeService;
import com.tradevault.service.TradeTaxonomy;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TodaySessionService {
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};
    private static final TypeReference<List<SessionChecklistItemDto>> CHECKLIST_LIST = new TypeReference<>() {};
    private static final int MAX_CHECKLIST_ITEMS = 30;
    private static final int MAX_TICKERS = 30;
    private static final int MAX_TICKER_LENGTH = 16;

    private final TodaySessionRepository todaySessionRepository;
    private final TradeRepository tradeRepository;
    private final ChecklistTemplateRepository checklistTemplateRepository;
    private final ChecklistTemplateEntryRepository checklistTemplateEntryRepository;
    private final ChecklistTemplateItemRepository checklistTemplateItemRepository;
    private final CurrentUserService currentUserService;
    private final TradeService tradeService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public TodaySessionResponse getTodaySession() {
        User user = currentUserService.getCurrentUser();
        LocalDate today = resolveSessionDate();
        TodaySession session = todaySessionRepository.findByUser_IdAndSessionDate(user.getId(), today).orElse(null);
        if (session == null) {
            return null;
        }
        return toResponse(session, user.getId());
    }

    @Transactional
    public TodaySessionResponse saveTodaySessionConfig(TodaySessionConfigRequest request) {
        User user = currentUserService.getCurrentUser();
        LocalDate today = resolveSessionDate();

        TodaySession session = todaySessionRepository.findByUser_IdAndSessionDate(user.getId(), today)
                .orElseGet(() -> TodaySession.builder()
                        .user(user)
                        .sessionDate(today)
                        .status(TodaySessionStatus.ACTIVE)
                        .build());

        session.setProfitTarget(normalizeMoney(request.getProfitTarget(), "profitTarget"));
        session.setLossLimit(normalizeMoney(request.getLossLimit(), "lossLimit"));
        session.setMaxTrades(normalizeMaxTrades(request.getMaxTrades()));
        if (session.getStatus() == null) {
            session.setStatus(TodaySessionStatus.ACTIVE);
        }
        if (session.getChecklistStateJson() == null || session.getChecklistStateJson().isBlank()) {
            session.setChecklistStateJson(writeChecklistItems(defaultChecklistItems(user.getId())));
        }

        TodaySession saved = todaySessionRepository.save(session);
        refreshSessionStatus(saved, user.getId());
        return toResponse(saved, user.getId());
    }

    @Transactional
    public TodaySessionResponse updatePlannedTickers(TodaySessionPlannedTickersRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireTodaySession(user);
        List<String> tickers = normalizeTickers(request == null ? null : request.getTickers());
        session.setPlannedTickersJson(writeStringList(tickers));
        TodaySession saved = todaySessionRepository.save(session);
        return toResponse(saved, user.getId());
    }

    @Transactional
    public TodaySessionResponse updateChecklist(TodaySessionChecklistUpdateRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireTodaySession(user);

        if (request != null && request.getTemplateId() != null) {
            ChecklistTemplate template = checklistTemplateRepository.findByIdAndUser_Id(request.getTemplateId(), user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Checklist template not found"));
            session.setChecklistTemplate(template);
            session.setChecklistStateJson(writeChecklistItems(entriesToChecklistItems(template.getId())));
        } else {
            List<SessionChecklistItemDto> items = normalizeChecklistItems(request == null ? null : request.getItems());
            session.setChecklistStateJson(writeChecklistItems(items));
        }

        TodaySession saved = todaySessionRepository.save(session);
        return toResponse(saved, user.getId());
    }

    @Transactional(readOnly = true)
    public List<ChecklistTemplateResponse> listChecklistTemplates() {
        User user = currentUserService.getCurrentUser();
        return checklistTemplateRepository.findByUser_IdOrderByUpdatedAtDesc(user.getId()).stream()
                .map(this::toChecklistTemplateResponse)
                .toList();
    }

    @Transactional
    public ChecklistTemplateResponse createChecklistTemplate(ChecklistTemplateRequest request) {
        User user = currentUserService.getCurrentUser();
        String name = normalizeTemplateName(request.getName());
        List<String> items = normalizeTemplateItems(request.getItems());

        ChecklistTemplate template = checklistTemplateRepository.save(ChecklistTemplate.builder()
                .user(user)
                .name(name)
                .build());

        saveTemplateEntries(template, items);
        return toChecklistTemplateResponse(template);
    }

    @Transactional
    public ChecklistTemplateResponse updateChecklistTemplate(UUID templateId, ChecklistTemplateRequest request) {
        User user = currentUserService.getCurrentUser();
        ChecklistTemplate template = checklistTemplateRepository.findByIdAndUser_Id(templateId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Checklist template not found"));

        template.setName(normalizeTemplateName(request.getName()));
        checklistTemplateRepository.save(template);
        checklistTemplateEntryRepository.deleteByTemplate_Id(templateId);
        saveTemplateEntries(template, normalizeTemplateItems(request.getItems()));

        return toChecklistTemplateResponse(template);
    }

    @Transactional
    public void deleteChecklistTemplate(UUID templateId) {
        User user = currentUserService.getCurrentUser();
        ChecklistTemplate template = checklistTemplateRepository.findByIdAndUser_Id(templateId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Checklist template not found"));
        checklistTemplateRepository.delete(template);
    }

    @Transactional
    public TradeResponse startTrade(StartSessionTradeRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireTodaySession(user);
        enforceSessionGuardrails(session, user.getId());

        Trade activeTrade = tradeRepository
                .findFirstByUser_IdAndSessionIdAndStatusOrderByOpenedAtDescCreatedAtDesc(user.getId(), session.getId(), TradeStatus.OPEN)
                .orElse(null);
        if (activeTrade != null) {
            throw new IllegalArgumentException("An active trade already exists for this session");
        }

        if (request.getFeeling() != null && !TradeTaxonomy.FEELINGS_SET.contains(request.getFeeling().trim())) {
            throw new IllegalArgumentException("Invalid feeling selection");
        }

        TradeRequest tradeRequest = new TradeRequest();
        tradeRequest.setSymbol(normalizeTicker(request.getSymbol()));
        tradeRequest.setMarket(request.getMarket() == null ? Market.FOREX : request.getMarket());
        tradeRequest.setDirection(request.getDirection());
        tradeRequest.setStatus(TradeStatus.OPEN);
        tradeRequest.setOpenedAt(OffsetDateTime.now(ZoneOffset.UTC));
        tradeRequest.setQuantity(request.getQuantity());
        tradeRequest.setEntryPrice(request.getEntryPrice());
        tradeRequest.setTakeProfitPrice(request.getTakeProfitPrice());
        tradeRequest.setStopLossPrice(request.getStopLossPrice());
        tradeRequest.setSession(request.getSession());
        tradeRequest.setSetupGrade(request.getSetupGrade());
        tradeRequest.setStrategyId(request.getStrategyId());
        tradeRequest.setStrategyTag(normalizeOptionalText(request.getStrategyTag()));
        tradeRequest.setRuleBreaks(Set.of());
        tradeRequest.setSessionId(session.getId());
        tradeRequest.setFeeling(normalizeOptionalText(request.getFeeling()));
        tradeRequest.setNotes(normalizeOptionalText(request.getNotes()));

        UUID linkedPlanId = request.getLinkedPlanId();
        if (linkedPlanId != null) {
            tradeRequest.setLinkedContentIds(Set.of(linkedPlanId));
        }

        TradeResponse response = tradeService.create(tradeRequest);
        refreshSessionStatus(session, user.getId());
        return response;
    }

    @Transactional
    public TradeResponse closeTrade(UUID tradeId, CloseSessionTradeRequest request) {
        User user = currentUserService.getCurrentUser();
        TodaySession session = requireTodaySession(user);

        Trade existing = tradeRepository.findByIdAndUserId(tradeId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Trade not found"));
        if (!Objects.equals(existing.getSessionId(), session.getId())) {
            throw new IllegalArgumentException("Trade is not linked to today's session");
        }
        if (existing.getStatus() != TradeStatus.OPEN) {
            throw new IllegalArgumentException("Trade is already closed");
        }

        Set<String> normalizedRuleBreaks = normalizeRuleBreaks(request.getRuleBreaks());
        String postTradeNotes = normalizeOptionalText(request.getPostTradeNotes());

        TradeRequest update = toTradeUpdateRequest(existing);
        update.setStatus(TradeStatus.CLOSED);
        update.setClosedAt(OffsetDateTime.now(ZoneOffset.UTC));
        update.setExitPrice(request.getExitPrice());
        update.setRuleBreaks(normalizedRuleBreaks);
        update.setNotes(postTradeNotes);

        TradeResponse updated = tradeService.update(existing.getId(), update);
        refreshSessionStatus(session, user.getId());
        return updated;
    }

    private TradeRequest toTradeUpdateRequest(Trade trade) {
        TradeRequest request = new TradeRequest();
        request.setSymbol(trade.getSymbol());
        request.setMarket(trade.getMarket());
        request.setDirection(trade.getDirection());
        request.setStatus(trade.getStatus());
        request.setOpenedAt(trade.getOpenedAt());
        request.setClosedAt(trade.getClosedAt());
        request.setQuantity(trade.getQuantity());
        request.setEntryPrice(trade.getEntryPrice());
        request.setExitPrice(trade.getExitPrice());
        request.setStopLossPrice(trade.getStopLossPrice());
        request.setTakeProfitPrice(trade.getTakeProfitPrice());
        request.setFees(trade.getFees());
        request.setCommission(trade.getCommission());
        request.setSlippage(trade.getSlippage());
        request.setRiskAmount(trade.getRiskAmount());
        request.setCapitalUsed(trade.getCapitalUsed());
        request.setTimeframe(trade.getTimeframe());
        request.setSetup(trade.getSetup());
        request.setStrategyTag(trade.getStrategyTag());
        request.setCatalystTag(trade.getCatalystTag());
        request.setStrategyId(trade.getStrategyId());
        request.setSetupGrade(trade.getSetupGrade());
        request.setSession(trade.getSession());
        request.setSessionId(trade.getSessionId());
        request.setFeeling(trade.getFeeling());
        request.setLinkedContentIds(trade.getLinkedContentIds());
        request.setLinkedPlanIds(trade.getLinkedPlanIds());
        request.setRuleBreaks(trade.getRuleBreaks());
        request.setNotes(trade.getNotes());
        request.setAccountId(trade.getAccount() == null ? null : trade.getAccount().getId());
        return request;
    }

    private void enforceSessionGuardrails(TodaySession session, UUID userId) {
        if (session.getStatus() == TodaySessionStatus.COMPLETED) {
            throw new IllegalArgumentException("Session is completed. Configure a new one tomorrow.");
        }
        SessionProgress progress = computeProgress(session, userId);
        if (isStopConditionReached(session, progress)) {
            session.setStatus(TodaySessionStatus.COMPLETED);
            todaySessionRepository.save(session);
            throw new IllegalArgumentException("Session guardrail reached. Trading is locked for today.");
        }
    }

    private void refreshSessionStatus(TodaySession session, UUID userId) {
        SessionProgress progress = computeProgress(session, userId);
        if (isStopConditionReached(session, progress)) {
            session.setStatus(TodaySessionStatus.COMPLETED);
        } else if (session.getStatus() == null) {
            session.setStatus(TodaySessionStatus.ACTIVE);
        }
        todaySessionRepository.save(session);
    }

    private SessionProgress computeProgress(TodaySession session, UUID userId) {
        long closedTrades = tradeRepository.countByUser_IdAndSessionIdAndStatus(userId, session.getId(), TradeStatus.CLOSED);
        BigDecimal realizedPnl = tradeRepository.sumNetPnlByUserAndSessionAndStatus(userId, session.getId(), TradeStatus.CLOSED);
        if (realizedPnl == null) {
            realizedPnl = BigDecimal.ZERO;
        }
        return new SessionProgress(closedTrades, realizedPnl);
    }

    private boolean isStopConditionReached(TodaySession session, SessionProgress progress) {
        if (progress.closedTrades() >= session.getMaxTrades()) {
            return true;
        }
        if (progress.realizedPnl().compareTo(session.getProfitTarget()) >= 0) {
            return true;
        }
        BigDecimal negativeLossLimit = session.getLossLimit().negate();
        return progress.realizedPnl().compareTo(negativeLossLimit) <= 0;
    }

    private TodaySessionResponse toResponse(TodaySession session, UUID userId) {
        SessionProgress progress = computeProgress(session, userId);
        long remainingTrades = Math.max(0, session.getMaxTrades() - progress.closedTrades());

        TradeResponse activeTrade = tradeRepository
                .findFirstByUser_IdAndSessionIdAndStatusOrderByOpenedAtDescCreatedAtDesc(userId, session.getId(), TradeStatus.OPEN)
                .map(trade -> tradeService.getById(trade.getId()))
                .orElse(null);

        return TodaySessionResponse.builder()
                .id(session.getId())
                .sessionDate(session.getSessionDate())
                .profitTarget(session.getProfitTarget())
                .lossLimit(session.getLossLimit())
                .maxTrades(session.getMaxTrades())
                .status(session.getStatus())
                .realizedPnl(progress.realizedPnl())
                .closedTradesCount(progress.closedTrades())
                .remainingTrades(remainingTrades)
                .plannedTickers(readStringList(session.getPlannedTickersJson()))
                .checklistItems(readChecklistItems(session.getChecklistStateJson()))
                .checklistTemplateId(session.getChecklistTemplate() == null ? null : session.getChecklistTemplate().getId())
                .activeTrade(activeTrade)
                .createdAt(session.getCreatedAt())
                .updatedAt(session.getUpdatedAt())
                .build();
    }

    private TodaySession requireTodaySession(User user) {
        LocalDate today = resolveSessionDate();
        return todaySessionRepository.findByUser_IdAndSessionDate(user.getId(), today)
                .orElseThrow(() -> new IllegalArgumentException("Session is not configured for today"));
    }

    private LocalDate resolveSessionDate() {
        ZoneId zone = ZoneId.of(TimezoneService.DEFAULT_TIMEZONE);
        return LocalDate.now(zone);
    }

    private String writeStringList(List<String> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(values);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid list payload");
        }
    }

    private List<String> readStringList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<String> values = objectMapper.readValue(json, STRING_LIST);
            return values == null ? List.of() : values.stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(item -> !item.isEmpty())
                    .toList();
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private String writeChecklistItems(List<SessionChecklistItemDto> items) {
        if (items == null || items.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(items);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid checklist payload");
        }
    }

    private List<SessionChecklistItemDto> readChecklistItems(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<SessionChecklistItemDto> items = objectMapper.readValue(json, CHECKLIST_LIST);
            return items == null ? List.of() : items;
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private List<SessionChecklistItemDto> normalizeChecklistItems(List<SessionChecklistItemDto> items) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        if (items.size() > MAX_CHECKLIST_ITEMS) {
            throw new IllegalArgumentException("Checklist cannot contain more than " + MAX_CHECKLIST_ITEMS + " items");
        }
        List<SessionChecklistItemDto> normalized = new ArrayList<>();
        for (int index = 0; index < items.size(); index++) {
            SessionChecklistItemDto item = items.get(index);
            String text = normalizeChecklistText(item == null ? null : item.getText());
            String id = normalizeOptionalText(item == null ? null : item.getId());
            normalized.add(SessionChecklistItemDto.builder()
                    .id(id == null ? ("item-" + (index + 1)) : id)
                    .text(text)
                    .completed(item != null && item.isCompleted())
                    .build());
        }
        return normalized;
    }

    private List<SessionChecklistItemDto> defaultChecklistItems(UUID userId) {
        List<ChecklistTemplateItem> items = checklistTemplateItemRepository
                .findByUser_IdAndIsEnabledTrueOrderBySortOrderAscCreatedAtAsc(userId);
        if (items.isEmpty()) {
            return List.of();
        }
        return items.stream()
                .limit(MAX_CHECKLIST_ITEMS)
                .map(item -> SessionChecklistItemDto.builder()
                        .id(item.getId().toString())
                        .text(item.getText())
                        .completed(false)
                        .build())
                .toList();
    }

    private String normalizeChecklistText(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            throw new IllegalArgumentException("Checklist item text is required");
        }
        if (normalized.length() > 160) {
            throw new IllegalArgumentException("Checklist item text cannot exceed 160 characters");
        }
        return normalized;
    }

    private String normalizeTemplateName(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            throw new IllegalArgumentException("Template name is required");
        }
        if (normalized.length() > 120) {
            throw new IllegalArgumentException("Template name cannot exceed 120 characters");
        }
        return normalized;
    }

    private List<String> normalizeTemplateItems(List<String> values) {
        if (values == null || values.isEmpty()) {
            throw new IllegalArgumentException("Template items are required");
        }
        if (values.size() > MAX_CHECKLIST_ITEMS) {
            throw new IllegalArgumentException("Template cannot contain more than " + MAX_CHECKLIST_ITEMS + " items");
        }
        List<String> normalized = values.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .distinct()
                .toList();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("Template items are required");
        }
        return normalized;
    }

    private void saveTemplateEntries(ChecklistTemplate template, List<String> items) {
        for (int index = 0; index < items.size(); index++) {
            checklistTemplateEntryRepository.save(ChecklistTemplateEntry.builder()
                    .template(template)
                    .itemText(items.get(index))
                    .sortOrder(index)
                    .build());
        }
    }

    private List<SessionChecklistItemDto> entriesToChecklistItems(UUID templateId) {
        List<ChecklistTemplateEntry> entries = checklistTemplateEntryRepository.findByTemplate_IdOrderBySortOrderAscCreatedAtAsc(templateId);
        return entries.stream()
                .map(entry -> SessionChecklistItemDto.builder()
                        .id(entry.getId().toString())
                        .text(entry.getItemText())
                        .completed(false)
                        .build())
                .toList();
    }

    private ChecklistTemplateResponse toChecklistTemplateResponse(ChecklistTemplate template) {
        List<String> items = checklistTemplateEntryRepository.findByTemplate_IdOrderBySortOrderAscCreatedAtAsc(template.getId()).stream()
                .map(ChecklistTemplateEntry::getItemText)
                .toList();
        return ChecklistTemplateResponse.builder()
                .id(template.getId())
                .name(template.getName())
                .items(items)
                .createdAt(template.getCreatedAt())
                .updatedAt(template.getUpdatedAt())
                .build();
    }

    private List<String> normalizeTickers(List<String> tickers) {
        if (tickers == null || tickers.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> values = new LinkedHashSet<>();
        for (String ticker : tickers) {
            String normalized = normalizeTicker(ticker);
            if (normalized != null) {
                values.add(normalized);
            }
            if (values.size() > MAX_TICKERS) {
                throw new IllegalArgumentException("Planned tickers cannot exceed " + MAX_TICKERS);
            }
        }
        return List.copyOf(values);
    }

    private String normalizeTicker(String ticker) {
        String normalized = normalizeOptionalText(ticker);
        if (normalized == null) {
            return null;
        }
        String upper = normalized.toUpperCase();
        if (upper.length() > MAX_TICKER_LENGTH) {
            throw new IllegalArgumentException("Ticker cannot exceed " + MAX_TICKER_LENGTH + " characters");
        }
        return upper;
    }

    private Integer normalizeMaxTrades(Integer value) {
        if (value == null || value <= 0) {
            throw new IllegalArgumentException("maxTrades must be greater than zero");
        }
        return value;
    }

    private BigDecimal normalizeMoney(BigDecimal value, String fieldName) {
        if (value == null) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        if (value.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException(fieldName + " cannot be negative");
        }
        return value.setScale(4, RoundingMode.HALF_UP);
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private Set<String> normalizeRuleBreaks(Set<String> values) {
        if (values == null || values.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String value : values) {
            String token = normalizeOptionalText(value);
            if (token == null) continue;
            if (!TradeTaxonomy.RULE_BREAKS_SET.contains(token)) {
                throw new IllegalArgumentException("Invalid rule break: " + token);
            }
            normalized.add(token);
        }
        return normalized;
    }

    private record SessionProgress(long closedTrades, BigDecimal realizedPnl) {
    }
}
