package com.tradevault.service.follow;

import com.tradevault.domain.entity.Follow;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.FollowType;
import com.tradevault.dto.follow.FollowRequest;
import com.tradevault.dto.follow.FollowResponse;
import com.tradevault.repository.ContentPostRepository;
import com.tradevault.repository.FollowRepository;
import com.tradevault.service.CurrentUserService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FollowService {
    private final FollowRepository followRepository;
    private final CurrentUserService currentUserService;
    private final ContentPostRepository contentPostRepository;

    @Transactional(readOnly = true)
    public List<FollowResponse> listCurrentUserFollows() {
        User user = currentUserService.getCurrentUser();
        return followRepository.findByUser_IdOrderByCreatedAtDesc(user.getId()).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public FollowResponse createCurrentUserFollow(FollowRequest request) {
        User user = currentUserService.getCurrentUser();
        String normalizedValue = normalizeValue(request.getFollowType(), request.getValue());

        return followRepository.findByUser_IdAndFollowTypeAndValue(user.getId(), request.getFollowType(), normalizedValue)
                .map(this::toResponse)
                .orElseGet(() -> {
                    Follow follow = Follow.builder()
                            .user(user)
                            .followType(request.getFollowType())
                            .value(normalizedValue)
                            .createdAt(OffsetDateTime.now())
                            .build();
                    return toResponse(followRepository.save(follow));
                });
    }

    @Transactional
    public void deleteCurrentUserFollow(UUID id) {
        User user = currentUserService.getCurrentUser();
        Follow follow = followRepository.findByIdAndUser_Id(id, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Follow not found"));
        followRepository.delete(follow);
    }

    private String normalizeValue(FollowType followType, String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            throw new IllegalArgumentException("Follow value is required");
        }
        String trimmed = rawValue.trim();
        return switch (followType) {
            case SYMBOL -> trimmed.toUpperCase(Locale.ROOT);
            case TAG -> trimmed.toLowerCase(Locale.ROOT);
            case STRATEGY -> normalizeStrategyValue(trimmed);
        };
    }

    private String normalizeStrategyValue(String rawValue) {
        UUID strategyId;
        try {
            strategyId = UUID.fromString(rawValue);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Strategy follow value must be a valid UUID");
        }
        if (!contentPostRepository.existsById(strategyId)) {
            throw new EntityNotFoundException("Strategy not found");
        }
        return strategyId.toString();
    }

    private FollowResponse toResponse(Follow follow) {
        return FollowResponse.builder()
                .id(follow.getId())
                .followType(follow.getFollowType())
                .value(follow.getValue())
                .createdAt(follow.getCreatedAt())
                .build();
    }
}
