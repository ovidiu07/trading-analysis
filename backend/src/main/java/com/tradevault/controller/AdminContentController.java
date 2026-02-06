package com.tradevault.controller;

import com.tradevault.domain.enums.ContentPostStatus;
import com.tradevault.domain.enums.ContentPostType;
import com.tradevault.dto.content.ContentPostRequest;
import com.tradevault.dto.content.ContentPostResponse;
import com.tradevault.service.ContentPostService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/admin/content")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminContentController {
    private final ContentPostService contentPostService;

    @GetMapping
    public Page<ContentPostResponse> list(@RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "20") int size,
                                          @RequestParam(required = false) ContentPostType type,
                                          @RequestParam(required = false) ContentPostStatus status,
                                          @RequestParam(required = false, name = "q") String query) {
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "updatedAt"));
        return contentPostService.adminList(type, status, query, pageable);
    }

    @PostMapping
    public ResponseEntity<ContentPostResponse> create(@Valid @RequestBody ContentPostRequest request) {
        return ResponseEntity.ok(contentPostService.createDraft(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ContentPostResponse> update(@PathVariable UUID id,
                                                      @Valid @RequestBody ContentPostRequest request) {
        return ResponseEntity.ok(contentPostService.update(id, request));
    }

    @PostMapping("/{id}/publish")
    public ResponseEntity<ContentPostResponse> publish(@PathVariable UUID id) {
        return ResponseEntity.ok(contentPostService.publish(id));
    }

    @PostMapping("/{id}/archive")
    public ResponseEntity<ContentPostResponse> archive(@PathVariable UUID id) {
        return ResponseEntity.ok(contentPostService.archive(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        contentPostService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
