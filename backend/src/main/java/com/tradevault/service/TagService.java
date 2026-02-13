package com.tradevault.service;

import com.tradevault.domain.entity.Tag;
import com.tradevault.domain.enums.TagType;
import com.tradevault.dto.tag.TagRequest;
import com.tradevault.dto.tag.TagResponse;
import com.tradevault.repository.TagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TagService {
    private final TagRepository tagRepository;
    private final CurrentUserService currentUserService;

    public List<TagResponse> list(TagType type) {
        var user = currentUserService.getCurrentUser();
        List<Tag> tags = type == null ? tagRepository.findByUserId(user.getId()) : tagRepository.findByUserIdAndType(user.getId(), type);
        return tags.stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public TagResponse create(TagRequest request) {
        var user = currentUserService.getCurrentUser();
        Tag tag = Tag.builder().name(request.getName()).type(request.getType()).user(user).build();
        return toResponse(tagRepository.save(tag));
    }

    public void delete(UUID id) {
        var user = currentUserService.getCurrentUser();
        var tag = tagRepository.findByIdAndUserId(id, user.getId()).orElseThrow();
        tagRepository.delete(tag);
    }

    private TagResponse toResponse(Tag tag) {
        return TagResponse.builder().id(tag.getId()).name(tag.getName()).type(tag.getType()).build();
    }
}
