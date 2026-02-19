package com.tradevault.service.checklist;

import com.tradevault.domain.entity.ChecklistItemCompletion;
import com.tradevault.domain.entity.ChecklistTemplateItem;
import com.tradevault.domain.entity.User;
import com.tradevault.dto.checklist.ChecklistTemplateItemUpdateRequest;
import com.tradevault.dto.checklist.ChecklistTemplateUpdateRequest;
import com.tradevault.dto.checklist.TodayChecklistUpdateEntryRequest;
import com.tradevault.dto.checklist.TodayChecklistUpdateRequest;
import com.tradevault.repository.ChecklistItemCompletionRepository;
import com.tradevault.repository.ChecklistTemplateItemRepository;
import com.tradevault.repository.ChecklistTemplateStateRepository;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.TimezoneService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ChecklistServiceTest {

    private ChecklistTemplateItemRepository checklistTemplateItemRepository;
    private ChecklistItemCompletionRepository checklistItemCompletionRepository;
    private ChecklistTemplateStateRepository checklistTemplateStateRepository;
    private CurrentUserService currentUserService;
    private TimezoneService timezoneService;
    private EntityManager entityManager;
    private ChecklistService checklistService;
    private User user;

    @BeforeEach
    void setUp() {
        checklistTemplateItemRepository = mock(ChecklistTemplateItemRepository.class);
        checklistItemCompletionRepository = mock(ChecklistItemCompletionRepository.class);
        checklistTemplateStateRepository = mock(ChecklistTemplateStateRepository.class);
        currentUserService = mock(CurrentUserService.class);
        timezoneService = mock(TimezoneService.class);
        entityManager = mock(EntityManager.class);

        checklistService = new ChecklistService(
                checklistTemplateItemRepository,
                checklistItemCompletionRepository,
                checklistTemplateStateRepository,
                currentUserService,
                timezoneService,
                entityManager
        );

        user = User.builder()
                .id(UUID.randomUUID())
                .timezone("Europe/Bucharest")
                .build();

        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(entityManager.getReference(User.class, user.getId())).thenReturn(user);
    }

    @Test
    void getTemplateCreatesDefaultsWhenMissing() {
        ChecklistTemplateItem item1 = ChecklistTemplateItem.builder()
                .id(UUID.randomUUID())
                .user(user)
                .text("Review today's plan and set a bias for your session.")
                .sortOrder(0)
                .isEnabled(true)
                .build();
        ChecklistTemplateItem item2 = ChecklistTemplateItem.builder()
                .id(UUID.randomUUID())
                .user(user)
                .text("Mark key liquidity levels (PDH/PDL, Asia H/L, EQH/EQL).")
                .sortOrder(1)
                .isEnabled(true)
                .build();

        when(checklistTemplateStateRepository.existsById(user.getId())).thenReturn(false);
        when(checklistTemplateItemRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));
        when(checklistTemplateItemRepository.findByUser_IdOrderBySortOrderAscCreatedAtAsc(user.getId()))
                .thenReturn(List.of(item1, item2));

        var response = checklistService.getTemplate();

        assertEquals(2, response.size());
        assertEquals("Review today's plan and set a bias for your session.", response.get(0).getText());
        verify(checklistTemplateItemRepository, times(1)).saveAll(anyList());
    }

    @Test
    void updateTemplateRejectsUnknownId() {
        when(checklistTemplateStateRepository.existsById(user.getId())).thenReturn(true);
        when(checklistTemplateItemRepository.findByUser_IdOrderBySortOrderAscCreatedAtAsc(user.getId()))
                .thenReturn(List.of());

        ChecklistTemplateItemUpdateRequest itemRequest = new ChecklistTemplateItemUpdateRequest();
        itemRequest.setId(UUID.randomUUID());
        itemRequest.setText("A valid item");
        itemRequest.setEnabled(true);

        ChecklistTemplateUpdateRequest request = new ChecklistTemplateUpdateRequest();
        request.setItems(List.of(itemRequest));

        assertThrows(IllegalArgumentException.class, () -> checklistService.updateTemplate(request));
    }

    @Test
    void updateTodayChecklistPersistsCompletionAndReturnsUpdatedState() {
        UUID checklistItemId = UUID.randomUUID();
        LocalDate date = LocalDate.of(2026, 2, 13);

        ChecklistTemplateItem templateItem = ChecklistTemplateItem.builder()
                .id(checklistItemId)
                .user(user)
                .text("Checklist item")
                .sortOrder(0)
                .isEnabled(true)
                .build();

        ChecklistItemCompletion persisted = ChecklistItemCompletion.builder()
                .id(UUID.randomUUID())
                .user(user)
                .checklistItem(templateItem)
                .date(date)
                .isCompleted(true)
                .build();

        when(checklistTemplateStateRepository.existsById(user.getId())).thenReturn(true);
        when(checklistTemplateItemRepository.findByUser_IdOrderBySortOrderAscCreatedAtAsc(user.getId()))
                .thenReturn(List.of(templateItem));
        when(checklistTemplateItemRepository.findByUser_IdAndIsEnabledTrueOrderBySortOrderAscCreatedAtAsc(user.getId()))
                .thenReturn(List.of(templateItem));
        when(checklistItemCompletionRepository.findByUser_IdAndChecklistItem_IdInAndDate(user.getId(), List.of(checklistItemId), date))
                .thenReturn(List.of());
        when(checklistItemCompletionRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));
        when(checklistItemCompletionRepository.findByUser_IdAndDate(user.getId(), date))
                .thenReturn(List.of(persisted));

        TodayChecklistUpdateEntryRequest entry = new TodayChecklistUpdateEntryRequest();
        entry.setChecklistItemId(checklistItemId);
        entry.setCompleted(true);

        TodayChecklistUpdateRequest request = new TodayChecklistUpdateRequest();
        request.setDate(date);
        request.setUpdates(List.of(entry));

        var response = checklistService.updateTodayChecklist(request);

        assertEquals(date, response.getDate());
        assertEquals(1, response.getItems().size());
        assertEquals(true, response.getItems().get(0).isCompleted());
        verify(checklistItemCompletionRepository, times(1)).saveAll(anyList());
    }
}
