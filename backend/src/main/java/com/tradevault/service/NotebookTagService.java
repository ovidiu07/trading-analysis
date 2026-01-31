package com.tradevault.service;

import com.tradevault.domain.entity.NotebookTag;
import com.tradevault.domain.entity.User;
import com.tradevault.dto.notebook.NotebookTagRequest;
import com.tradevault.dto.notebook.NotebookTagResponse;
import com.tradevault.repository.NotebookTagRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotebookTagService {
    private final NotebookTagRepository tagRepository;
    private final CurrentUserService currentUserService;

    public List<NotebookTagResponse> list() {
        User user = currentUserService.getCurrentUser();
        return tagRepository.findByUserIdOrderByNameAsc(user.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public NotebookTagResponse create(NotebookTagRequest request) {
        User user = currentUserService.getCurrentUser();
        NotebookTag tag = NotebookTag.builder()
                .user(user)
                .name(request.getName())
                .color(request.getColor())
                .build();
        return toResponse(tagRepository.save(tag));
    }

    @Transactional
    public void delete(UUID id) {
        User user = currentUserService.getCurrentUser();
        NotebookTag tag = tagRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Tag not found"));
        tagRepository.delete(tag);
    }

    private NotebookTagResponse toResponse(NotebookTag tag) {
        return NotebookTagResponse.builder()
                .id(tag.getId())
                .name(tag.getName())
                .color(tag.getColor())
                .build();
    }
}
