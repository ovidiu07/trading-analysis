package com.tradevault.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.ContentPost;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.ContentPostStatus;
import com.tradevault.domain.enums.ContentPostType;
import com.tradevault.domain.enums.Role;
import com.tradevault.dto.content.ContentPostRequest;
import com.tradevault.dto.content.ContentPostResponse;
import com.tradevault.repository.ContentPostRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ContentPostService {
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};

    private final ContentPostRepository repository;
    private final CurrentUserService currentUserService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public Page<ContentPostResponse> adminList(ContentPostType type,
                                               ContentPostStatus status,
                                               String query,
                                               Pageable pageable) {
        return repository.searchAdmin(type, status, query, pageable)
                .map(this::toResponse);
    }

    @Transactional
    public ContentPostResponse createDraft(ContentPostRequest request) {
        User user = currentUserService.getCurrentUser();
        ContentPost post = new ContentPost();
        applyRequest(post, request, true);
        post.setCreatedBy(user);
        post.setStatus(ContentPostStatus.DRAFT);
        post.setPublishedAt(null);
        ContentPost saved = repository.save(post);
        return toResponse(saved);
    }

    @Transactional
    public ContentPostResponse update(UUID id, ContentPostRequest request) {
        ContentPost post = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Content not found"));
        applyRequest(post, request, false);
        ContentPost saved = repository.save(post);
        return toResponse(saved);
    }

    @Transactional
    public ContentPostResponse publish(UUID id) {
        ContentPost post = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Content not found"));
        post.setStatus(ContentPostStatus.PUBLISHED);
        if (post.getPublishedAt() == null) {
            post.setPublishedAt(OffsetDateTime.now());
        }
        ContentPost saved = repository.save(post);
        return toResponse(saved);
    }

    @Transactional
    public ContentPostResponse archive(UUID id) {
        ContentPost post = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Content not found"));
        post.setStatus(ContentPostStatus.ARCHIVED);
        ContentPost saved = repository.save(post);
        return toResponse(saved);
    }

    @Transactional
    public void delete(UUID id) {
        ContentPost post = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Content not found"));
        repository.delete(post);
    }

    @Transactional(readOnly = true)
    public List<ContentPostResponse> listPublished(ContentPostType type,
                                                   String query,
                                                   boolean activeOnly) {
        OffsetDateTime now = OffsetDateTime.now();
        return repository.searchPublished(ContentPostStatus.PUBLISHED, type, query, activeOnly, now)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ContentPostResponse getByIdOrSlug(String idOrSlug) {
        User user = currentUserService.getCurrentUser();
        boolean isAdmin = user.getRole() == Role.ADMIN;
        ContentPost post = findByIdOrSlug(idOrSlug);
        if (!isAdmin && !isVisibleToUsers(post, OffsetDateTime.now())) {
            throw new EntityNotFoundException("Content not found");
        }
        return toResponse(post);
    }

    private ContentPost findByIdOrSlug(String idOrSlug) {
        if (idOrSlug == null || idOrSlug.isBlank()) {
            throw new EntityNotFoundException("Content not found");
        }
        try {
            UUID id = UUID.fromString(idOrSlug);
            return repository.findById(id)
                    .orElseThrow(() -> new EntityNotFoundException("Content not found"));
        } catch (IllegalArgumentException ex) {
            return repository.findBySlug(idOrSlug)
                    .orElseThrow(() -> new EntityNotFoundException("Content not found"));
        }
    }

    private boolean isVisibleToUsers(ContentPost post, OffsetDateTime now) {
        if (post.getStatus() != ContentPostStatus.PUBLISHED) {
            return false;
        }
        if (post.getVisibleFrom() != null && post.getVisibleFrom().isAfter(now)) {
            return false;
        }
        if (post.getVisibleUntil() != null && post.getVisibleUntil().isBefore(now)) {
            return false;
        }
        return true;
    }

    private void applyRequest(ContentPost post, ContentPostRequest request, boolean isCreate) {
        if (request.getVisibleFrom() != null && request.getVisibleUntil() != null
                && request.getVisibleFrom().isAfter(request.getVisibleUntil())) {
            throw new IllegalArgumentException("visibleFrom must be before visibleUntil");
        }

        post.setType(request.getType());
        post.setTitle(request.getTitle().trim());
        post.setSummary(normalizeBlank(request.getSummary()));
        post.setBody(request.getBody().trim());
        post.setVisibleFrom(request.getVisibleFrom());
        post.setVisibleUntil(request.getVisibleUntil());

        if (request.getType() == ContentPostType.WEEKLY_PLAN) {
            if (request.getWeekStart() == null || request.getWeekEnd() == null) {
                throw new IllegalArgumentException("Weekly plans require weekStart and weekEnd");
            }
            if (request.getWeekStart().isAfter(request.getWeekEnd())) {
                throw new IllegalArgumentException("weekStart must be on or before weekEnd");
            }
            post.setWeekStart(request.getWeekStart());
            post.setWeekEnd(request.getWeekEnd());
        } else {
            post.setWeekStart(null);
            post.setWeekEnd(null);
        }

        post.setTags(writeList(request.getTags()));
        post.setSymbols(writeList(request.getSymbols()));

        String requestedSlug = normalizeBlank(request.getSlug());
        String resolvedSlug;
        if (requestedSlug == null) {
            if (isCreate) {
                resolvedSlug = normalizeSlug(request.getTitle());
            } else {
                resolvedSlug = post.getSlug() != null ? post.getSlug() : normalizeSlug(request.getTitle());
            }
        } else {
            resolvedSlug = normalizeSlug(requestedSlug);
        }

        if (resolvedSlug != null) {
            resolvedSlug = ensureUniqueSlug(resolvedSlug, post.getId());
        }
        post.setSlug(resolvedSlug);
    }

    private String ensureUniqueSlug(String baseSlug, UUID currentId) {
        String candidate = baseSlug;
        int counter = 2;
        while (true) {
            Optional<ContentPost> existing = repository.findBySlug(candidate);
            if (existing.isEmpty() || (currentId != null && existing.get().getId().equals(currentId))) {
                return candidate;
            }
            candidate = baseSlug + "-" + counter;
            counter++;
        }
    }

    private String normalizeSlug(String value) {
        if (value == null) return null;
        String normalized = value.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        return normalized.isBlank() ? null : normalized;
    }

    private String normalizeBlank(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private String writeList(List<String> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(values);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid list payload");
        }
    }

    private List<String> readList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, STRING_LIST);
        } catch (Exception ex) {
            return List.of();
        }
    }

    private ContentPostResponse toResponse(ContentPost post) {
        return ContentPostResponse.builder()
                .id(post.getId())
                .type(post.getType())
                .title(post.getTitle())
                .slug(post.getSlug())
                .summary(post.getSummary())
                .body(post.getBody())
                .status(post.getStatus())
                .tags(readList(post.getTags()))
                .symbols(readList(post.getSymbols()))
                .visibleFrom(post.getVisibleFrom())
                .visibleUntil(post.getVisibleUntil())
                .weekStart(post.getWeekStart())
                .weekEnd(post.getWeekEnd())
                .createdBy(post.getCreatedBy() != null ? post.getCreatedBy().getId() : null)
                .createdAt(post.getCreatedAt())
                .updatedAt(post.getUpdatedAt())
                .publishedAt(post.getPublishedAt())
                .build();
    }
}
