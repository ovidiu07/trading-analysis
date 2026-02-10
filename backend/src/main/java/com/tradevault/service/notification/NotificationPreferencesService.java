package com.tradevault.service.notification;

import com.tradevault.domain.entity.NotificationPreferences;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.NotificationMatchPolicy;
import com.tradevault.domain.enums.NotificationPreferenceMode;
import com.tradevault.dto.notification.NotificationPreferencesRequest;
import com.tradevault.dto.notification.NotificationPreferencesResponse;
import com.tradevault.repository.ContentTypeRepository;
import com.tradevault.repository.NotificationPreferencesRepository;
import com.tradevault.service.CurrentUserService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationPreferencesService {
    private final NotificationPreferencesRepository notificationPreferencesRepository;
    private final ContentTypeRepository contentTypeRepository;
    private final CurrentUserService currentUserService;
    private final NotificationJsonHelper notificationJsonHelper;

    @Transactional
    public NotificationPreferencesResponse getCurrentUserPreferences() {
        User user = currentUserService.getCurrentUser();
        NotificationPreferences preferences = getOrCreate(user);
        return toResponse(preferences);
    }

    @Transactional
    public NotificationPreferencesResponse updateCurrentUserPreferences(NotificationPreferencesRequest request) {
        User user = currentUserService.getCurrentUser();
        NotificationPreferences preferences = getOrCreate(user);

        NotificationPreferenceMode mode = request.getMode();
        if (mode == null) {
            throw new IllegalArgumentException("Notification mode is required");
        }

        List<UUID> categories = normalizeCategories(request.getCategories());
        if (!categories.isEmpty()) {
            List<UUID> existing = contentTypeRepository.findByIdIn(categories).stream()
                    .map(contentType -> contentType.getId())
                    .toList();
            if (existing.size() != categories.size()) {
                throw new EntityNotFoundException("One or more categories were not found");
            }
        }

        NotificationMatchPolicy matchPolicy = request.getMatchPolicy() == null
                ? NotificationMatchPolicy.CATEGORY_ONLY
                : request.getMatchPolicy();

        List<String> normalizedTags = notificationJsonHelper.normalizeTags(request.getTags());
        List<String> normalizedSymbols = notificationJsonHelper.normalizeSymbols(request.getSymbols());

        preferences.setEnabled(request.isEnabled());
        preferences.setNotifyOnNew(request.isNotifyOnNew());
        preferences.setNotifyOnUpdates(request.isNotifyOnUpdates());
        preferences.setMode(mode);
        preferences.setCategoriesJson(notificationJsonHelper.writeUuidList(categories));
        preferences.setTagsJson(notificationJsonHelper.writeStringList(normalizedTags));
        preferences.setSymbolsJson(notificationJsonHelper.writeStringList(normalizedSymbols));
        preferences.setMatchPolicy(matchPolicy);

        NotificationPreferences saved = notificationPreferencesRepository.save(preferences);
        return toResponse(saved);
    }

    @Transactional
    public NotificationPreferences ensureForUser(User user) {
        return getOrCreate(user);
    }

    private NotificationPreferences getOrCreate(User user) {
        return notificationPreferencesRepository.findById(user.getId())
                .orElseGet(() -> notificationPreferencesRepository.save(defaultPreferences(user)));
    }

    private NotificationPreferences defaultPreferences(User user) {
        return NotificationPreferences.builder()
                .user(user)
                .enabled(true)
                .notifyOnNew(true)
                .notifyOnUpdates(true)
                .mode(NotificationPreferenceMode.ALL)
                .matchPolicy(NotificationMatchPolicy.CATEGORY_ONLY)
                .build();
    }

    private NotificationPreferencesResponse toResponse(NotificationPreferences preferences) {
        List<UUID> categories = notificationJsonHelper.readUuidList(preferences.getCategoriesJson());
        List<String> tags = notificationJsonHelper.readStringList(preferences.getTagsJson());
        List<String> symbols = notificationJsonHelper.readStringList(preferences.getSymbolsJson());

        return NotificationPreferencesResponse.builder()
                .enabled(preferences.isEnabled())
                .notifyOnNew(preferences.isNotifyOnNew())
                .notifyOnUpdates(preferences.isNotifyOnUpdates())
                .mode(preferences.getMode())
                .categories(categories)
                .tags(tags)
                .symbols(symbols)
                .matchPolicy(preferences.getMatchPolicy())
                .build();
    }

    private List<UUID> normalizeCategories(List<UUID> categories) {
        if (categories == null || categories.isEmpty()) {
            return List.of();
        }
        Set<UUID> unique = new LinkedHashSet<>();
        for (UUID category : categories) {
            if (category != null) {
                unique.add(category);
            }
        }
        return unique.stream().toList();
    }
}
