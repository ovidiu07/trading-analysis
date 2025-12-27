package com.tradevault.controller;

import com.tradevault.domain.enums.TagType;
import com.tradevault.dto.tag.TagRequest;
import com.tradevault.dto.tag.TagResponse;
import com.tradevault.service.TagService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/tags")
@RequiredArgsConstructor
public class TagController {
    private final TagService tagService;

    @GetMapping
    public List<TagResponse> list(@RequestParam(required = false) TagType type) {
        return tagService.list(type);
    }

    @PostMapping
    public ResponseEntity<TagResponse> create(@Valid @RequestBody TagRequest request) {
        return ResponseEntity.ok(tagService.create(request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        tagService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
