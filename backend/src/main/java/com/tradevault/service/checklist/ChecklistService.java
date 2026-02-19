package com.tradevault.service.checklist;

import com.tradevault.domain.entity.ChecklistItemCompletion;
import com.tradevault.domain.entity.ChecklistTemplateItem;
import com.tradevault.domain.entity.ChecklistTemplateState;
import com.tradevault.domain.entity.User;
import com.tradevault.dto.checklist.ChecklistTemplateItemResponse;
import com.tradevault.dto.checklist.ChecklistTemplateItemUpdateRequest;
import com.tradevault.dto.checklist.ChecklistTemplateUpdateRequest;
import com.tradevault.dto.checklist.TodayChecklistItemResponse;
import com.tradevault.dto.checklist.TodayChecklistResponse;
import com.tradevault.dto.checklist.TodayChecklistUpdateEntryRequest;
import com.tradevault.dto.checklist.TodayChecklistUpdateRequest;
import com.tradevault.repository.ChecklistItemCompletionRepository;
import com.tradevault.repository.ChecklistTemplateItemRepository;
import com.tradevault.repository.ChecklistTemplateStateRepository;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.TimezoneService;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ChecklistService {
    private static final int MAX_ITEMS = 30;
    private static final int MAX_TEXT_LENGTH = 160;
    private static final List<String> DEFAULT_TEMPLATE_TEXTS = List.of(
            "Review today's plan and set a bias for your session.",
            "Mark key liquidity levels (PDH/PDL, Asia H/L, EQH/EQL).",
            "Set max daily risk and max trades before execution.",
            "Define your session windows (London/New York).",
            "Open quick journal and write invalidation conditions."
    );

    private final ChecklistTemplateItemRepository checklistTemplateItemRepository;
    private final ChecklistItemCompletionRepository checklistItemCompletionRepository;
    private final ChecklistTemplateStateRepository checklistTemplateStateRepository;
    private final CurrentUserService currentUserService;
    private final TimezoneService timezoneService;
    private final EntityManager entityManager;

    @Transactional
    public List<ChecklistTemplateItemResponse> getTemplate() {
        User user = currentUserService.getCurrentUser();
        UUID userId = requireUserId(user);
        ensureDefaultTemplate(userId);
        return checklistTemplateItemRepository.findByUser_IdOrderBySortOrderAscCreatedAtAsc(userId).stream()
                .map(this::toTemplateResponse)
                .toList();
    }

    @Transactional
    public List<ChecklistTemplateItemResponse> updateTemplate(ChecklistTemplateUpdateRequest request) {
        User user = currentUserService.getCurrentUser();
        UUID userId = requireUserId(user);
        ensureDefaultTemplate(userId);
        User userRef = getManagedUserReference(userId);

        List<ChecklistTemplateItemUpdateRequest> requestedItems = request.getItems() == null
                ? List.of()
                : request.getItems();

        if (requestedItems.size() > MAX_ITEMS) {
            throw new IllegalArgumentException("Checklist template cannot have more than %d items".formatted(MAX_ITEMS));
        }

        List<ChecklistTemplateItem> existingItems = checklistTemplateItemRepository
                .findByUser_IdOrderBySortOrderAscCreatedAtAsc(userId);
        Map<UUID, ChecklistTemplateItem> existingById = new HashMap<>();
        for (ChecklistTemplateItem item : existingItems) {
            existingById.put(item.getId(), item);
        }

        Set<UUID> seenExistingIds = new HashSet<>();
        List<ChecklistTemplateItem> toSave = new ArrayList<>();

        for (int index = 0; index < requestedItems.size(); index++) {
            ChecklistTemplateItemUpdateRequest requested = requestedItems.get(index);
            ChecklistTemplateItem entity;

            if (requested.getId() != null) {
                if (!seenExistingIds.add(requested.getId())) {
                    throw new IllegalArgumentException("Duplicate checklist item id in request: %s".formatted(requested.getId()));
                }
                entity = existingById.get(requested.getId());
                if (entity == null) {
                    throw new IllegalArgumentException("Checklist item not found: %s".formatted(requested.getId()));
                }
            } else {
                entity = ChecklistTemplateItem.builder().user(userRef).build();
            }

            entity.setText(normalizeTemplateText(requested.getText()));
            entity.setSortOrder(index);
            entity.setEnabled(requested.getEnabled() == null || requested.getEnabled());
            toSave.add(entity);
        }

        List<ChecklistTemplateItem> toDelete = existingItems.stream()
                .filter(existing -> !seenExistingIds.contains(existing.getId()))
                .toList();
        if (!toDelete.isEmpty()) {
            checklistTemplateItemRepository.deleteAll(toDelete);
        }

        List<ChecklistTemplateItem> saved = checklistTemplateItemRepository.saveAll(toSave);
        markTemplateInitialized(userId, userRef);

        return saved.stream()
                .sorted(Comparator
                        .comparingInt(ChecklistTemplateItem::getSortOrder)
                        .thenComparing(ChecklistTemplateItem::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(this::toTemplateResponse)
                .toList();
    }

    @Transactional
    public TodayChecklistResponse getTodayChecklist(String timezone) {
        User user = currentUserService.getCurrentUser();
        UUID userId = requireUserId(user);
        ensureDefaultTemplate(userId);

        ZoneId zoneId = timezoneService.resolveZone(timezone, user);
        LocalDate date = LocalDate.now(zoneId);

        return buildTodayChecklist(userId, date);
    }

    @Transactional
    public TodayChecklistResponse updateTodayChecklist(TodayChecklistUpdateRequest request) {
        User user = currentUserService.getCurrentUser();
        UUID userId = requireUserId(user);
        ensureDefaultTemplate(userId);
        User userRef = getManagedUserReference(userId);

        LocalDate date = request.getDate();
        if (date == null) {
            throw new IllegalArgumentException("Checklist date is required");
        }

        List<TodayChecklistUpdateEntryRequest> updates = request.getUpdates() == null
                ? List.of()
                : request.getUpdates();

        if (updates.size() > MAX_ITEMS) {
            throw new IllegalArgumentException("Checklist update payload cannot contain more than %d items".formatted(MAX_ITEMS));
        }

        List<ChecklistTemplateItem> allTemplateItems = checklistTemplateItemRepository
                .findByUser_IdOrderBySortOrderAscCreatedAtAsc(userId);

        Map<UUID, ChecklistTemplateItem> templateById = new HashMap<>();
        for (ChecklistTemplateItem item : allTemplateItems) {
            templateById.put(item.getId(), item);
        }

        Set<UUID> requestedIds = new HashSet<>();
        for (TodayChecklistUpdateEntryRequest update : updates) {
            UUID checklistItemId = update.getChecklistItemId();
            if (checklistItemId == null) {
                throw new IllegalArgumentException("Checklist item id is required");
            }
            if (!requestedIds.add(checklistItemId)) {
                throw new IllegalArgumentException("Duplicate checklist item id in update payload: %s".formatted(checklistItemId));
            }
            ChecklistTemplateItem templateItem = templateById.get(checklistItemId);
            if (templateItem == null) {
                throw new IllegalArgumentException("Checklist item not found: %s".formatted(checklistItemId));
            }
            if (!templateItem.isEnabled()) {
                throw new IllegalArgumentException("Checklist item is disabled and cannot be updated: %s".formatted(checklistItemId));
            }
        }

        Map<UUID, ChecklistItemCompletion> existingByItemId = new HashMap<>();
        if (!requestedIds.isEmpty()) {
            List<ChecklistItemCompletion> existingCompletions = checklistItemCompletionRepository
                    .findByUser_IdAndChecklistItem_IdInAndDate(userId, requestedIds, date);
            for (ChecklistItemCompletion completion : existingCompletions) {
                existingByItemId.put(completion.getChecklistItem().getId(), completion);
            }
        }

        List<ChecklistItemCompletion> toSave = new ArrayList<>();
        for (TodayChecklistUpdateEntryRequest update : updates) {
            UUID checklistItemId = update.getChecklistItemId();
            ChecklistItemCompletion completion = existingByItemId.get(checklistItemId);
            if (completion == null) {
                completion = ChecklistItemCompletion.builder()
                        .user(userRef)
                        .checklistItem(templateById.get(checklistItemId))
                        .date(date)
                        .isCompleted(false)
                        .build();
            }
            completion.setCompleted(Boolean.TRUE.equals(update.getCompleted()));
            toSave.add(completion);
        }

        if (!toSave.isEmpty()) {
            checklistItemCompletionRepository.saveAll(toSave);
        }

        return buildTodayChecklist(userId, date);
    }

    private TodayChecklistResponse buildTodayChecklist(UUID userId, LocalDate date) {
        List<ChecklistTemplateItem> enabledItems = checklistTemplateItemRepository
                .findByUser_IdAndIsEnabledTrueOrderBySortOrderAscCreatedAtAsc(userId);

        Map<UUID, Boolean> completionByItemId = new HashMap<>();
        List<ChecklistItemCompletion> completions = checklistItemCompletionRepository.findByUser_IdAndDate(userId, date);
        for (ChecklistItemCompletion completion : completions) {
            completionByItemId.put(completion.getChecklistItem().getId(), completion.isCompleted());
        }

        List<TodayChecklistItemResponse> items = enabledItems.stream()
                .map(item -> TodayChecklistItemResponse.builder()
                        .id(item.getId())
                        .text(item.getText())
                        .completed(completionByItemId.getOrDefault(item.getId(), false))
                        .build())
                .toList();

        return TodayChecklistResponse.builder()
                .date(date)
                .items(items)
                .build();
    }

    private ChecklistTemplateItemResponse toTemplateResponse(ChecklistTemplateItem item) {
        return ChecklistTemplateItemResponse.builder()
                .id(item.getId())
                .text(item.getText())
                .sortOrder(item.getSortOrder())
                .enabled(item.isEnabled())
                .build();
    }

    private String normalizeTemplateText(String rawText) {
        if (rawText == null) {
            throw new IllegalArgumentException("Checklist item text is required");
        }
        String normalized = rawText.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("Checklist item text cannot be blank");
        }
        if (normalized.length() > MAX_TEXT_LENGTH) {
            throw new IllegalArgumentException("Checklist item text cannot exceed %d characters".formatted(MAX_TEXT_LENGTH));
        }
        return normalized;
    }

    private void ensureDefaultTemplate(UUID userId) {
        if (checklistTemplateStateRepository.existsById(userId)) {
            return;
        }

        User userRef = getManagedUserReference(userId);
        List<ChecklistTemplateItem> defaults = new ArrayList<>();
        for (int index = 0; index < DEFAULT_TEMPLATE_TEXTS.size(); index++) {
            defaults.add(ChecklistTemplateItem.builder()
                    .user(userRef)
                    .text(DEFAULT_TEMPLATE_TEXTS.get(index))
                    .sortOrder(index)
                    .isEnabled(true)
                    .build());
        }
        checklistTemplateItemRepository.saveAll(defaults);
        markTemplateInitialized(userId, userRef);
    }

    private void markTemplateInitialized(UUID userId, User userRef) {
        if (checklistTemplateStateRepository.existsById(userId)) {
            return;
        }
        checklistTemplateStateRepository.save(ChecklistTemplateState.builder()
                .user(userRef)
                .build());
    }

    private UUID requireUserId(User user) {
        if (user == null || user.getId() == null) {
            throw new IllegalStateException("Authenticated user id is required");
        }
        return user.getId();
    }

    private User getManagedUserReference(UUID userId) {
        return entityManager.getReference(User.class, userId);
    }
}
