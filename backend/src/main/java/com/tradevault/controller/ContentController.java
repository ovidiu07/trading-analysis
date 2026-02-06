package com.tradevault.controller;

import com.tradevault.domain.enums.ContentPostStatus;
import com.tradevault.domain.enums.ContentPostType;
import com.tradevault.dto.content.ContentPostResponse;
import com.tradevault.service.ContentPostService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/content")
@RequiredArgsConstructor
public class ContentController {
    private final ContentPostService contentPostService;

    @GetMapping
    public List<ContentPostResponse> list(@RequestParam(required = false) ContentPostType type,
                                          @RequestParam(required = false) ContentPostStatus status,
                                          @RequestParam(required = false, name = "q") String query,
                                          @RequestParam(defaultValue = "true") boolean activeOnly) {
        if (status != null && status != ContentPostStatus.PUBLISHED) {
            throw new IllegalArgumentException("Only published content is available");
        }
        return contentPostService.listPublished(type, query, activeOnly);
    }

    @GetMapping("/{idOrSlug}")
    public ContentPostResponse get(@PathVariable String idOrSlug) {
        return contentPostService.getByIdOrSlug(idOrSlug);
    }
}
