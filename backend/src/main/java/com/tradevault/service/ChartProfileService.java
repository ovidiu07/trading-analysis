package com.tradevault.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.ChartProfile;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.ChartProfileScope;
import com.tradevault.dto.chartprofile.ChartProfileRequest;
import com.tradevault.dto.chartprofile.ChartProfileResponse;
import com.tradevault.dto.chartprofile.ChartProfileUpdateRequest;
import com.tradevault.repository.ChartProfileRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ChartProfileService {
    private final ChartProfileRepository chartProfileRepository;
    private final CurrentUserService currentUserService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<ChartProfileResponse> listProfiles(ChartProfileScope scope) {
        User user = currentUserService.getCurrentUser();
        ChartProfileScope resolvedScope = normalizeScope(scope);
        return chartProfileRepository.findByUser_IdAndScopeOrderByUpdatedAtDesc(user.getId(), resolvedScope)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ChartProfileResponse createProfile(ChartProfileRequest request) {
        User user = currentUserService.getCurrentUser();
        ChartProfileScope scope = normalizeScope(request.getScope());

        ChartProfile profile = ChartProfile.builder()
                .user(user)
                .name(normalizeName(request.getName(), true))
                .scope(scope)
                .isDefault(Boolean.TRUE.equals(request.getIsDefault()))
                .embedConfigJson(normalizeJsonObject(request.getEmbedConfigJson()))
                .tjaPrefsJson(normalizeJsonObject(request.getTjaPrefsJson()))
                .build();

        ChartProfile saved = chartProfileRepository.save(profile);
        if (saved.isDefault()) {
            clearOtherDefaults(user.getId(), scope, saved.getId());
            saved = chartProfileRepository.save(saved);
        }
        return toResponse(saved);
    }

    @Transactional
    public ChartProfileResponse updateProfile(UUID profileId, ChartProfileUpdateRequest request) {
        User user = currentUserService.getCurrentUser();
        ChartProfile profile = chartProfileRepository.findByIdAndUser_Id(profileId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Chart profile not found"));

        if (request.getName() != null) {
            profile.setName(normalizeName(request.getName(), true));
        }

        if (request.getScope() != null) {
            profile.setScope(normalizeScope(request.getScope()));
        }

        if (request.getEmbedConfigJson() != null) {
            profile.setEmbedConfigJson(normalizeJsonObject(request.getEmbedConfigJson()));
        }

        if (request.getTjaPrefsJson() != null) {
            profile.setTjaPrefsJson(normalizeJsonObject(request.getTjaPrefsJson()));
        }

        if (request.getIsDefault() != null) {
            profile.setDefault(request.getIsDefault());
        }

        ChartProfile saved = chartProfileRepository.save(profile);
        if (saved.isDefault()) {
            clearOtherDefaults(user.getId(), saved.getScope(), saved.getId());
            saved = chartProfileRepository.save(saved);
        }
        return toResponse(saved);
    }

    @Transactional
    public void deleteProfile(UUID profileId) {
        User user = currentUserService.getCurrentUser();
        ChartProfile profile = chartProfileRepository.findByIdAndUser_Id(profileId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Chart profile not found"));
        chartProfileRepository.delete(profile);
    }

    @Transactional
    public ChartProfileResponse setDefault(UUID profileId) {
        User user = currentUserService.getCurrentUser();
        ChartProfile profile = chartProfileRepository.findByIdAndUser_Id(profileId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Chart profile not found"));
        profile.setDefault(true);
        clearOtherDefaults(user.getId(), profile.getScope(), profile.getId());
        return toResponse(chartProfileRepository.save(profile));
    }

    private void clearOtherDefaults(UUID userId, ChartProfileScope scope, UUID keepId) {
        List<ChartProfile> existingDefaults = chartProfileRepository.findByUser_IdAndScopeAndIsDefaultTrue(userId, scope);
        List<ChartProfile> changed = existingDefaults.stream()
                .filter(item -> !Objects.equals(item.getId(), keepId))
                .peek(item -> item.setDefault(false))
                .toList();
        if (!changed.isEmpty()) {
            chartProfileRepository.saveAll(changed);
        }
    }

    private ChartProfileScope normalizeScope(ChartProfileScope scope) {
        return scope == null ? ChartProfileScope.SESSION_MODE : scope;
    }

    private String normalizeName(String value, boolean required) {
        if (value == null) {
            if (required) {
                throw new IllegalArgumentException("Profile name is required");
            }
            return null;
        }
        String normalized = value.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("Profile name is required");
        }
        if (normalized.length() > 120) {
            throw new IllegalArgumentException("Profile name cannot exceed 120 characters");
        }
        return normalized;
    }

    private JsonNode normalizeJsonObject(JsonNode value) {
        if (value == null || value.isNull()) {
            return objectMapper.createObjectNode();
        }
        if (!value.isObject()) {
            throw new IllegalArgumentException("Profile JSON fields must be objects");
        }
        return value;
    }

    private ChartProfileResponse toResponse(ChartProfile profile) {
        return ChartProfileResponse.builder()
                .id(profile.getId())
                .name(profile.getName())
                .isDefault(profile.isDefault())
                .scope(profile.getScope())
                .embedConfigJson(profile.getEmbedConfigJson())
                .tjaPrefsJson(profile.getTjaPrefsJson())
                .createdAt(profile.getCreatedAt())
                .updatedAt(profile.getUpdatedAt())
                .build();
    }
}
