package com.tradevault.controller;

import com.tradevault.domain.enums.ContentPostStatus;
import com.tradevault.dto.content.ContentPostRequest;
import com.tradevault.dto.content.ContentPostResponse;
import com.tradevault.service.ContentPostService;
import com.tradevault.service.LocaleResolverService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
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
    private final LocaleResolverService localeResolverService;

    @GetMapping
    public Page<ContentPostResponse> list(@RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "20") int size,
                                          @RequestParam(required = false) UUID contentTypeId,
                                          @RequestParam(required = false) ContentPostStatus status,
                                          @RequestParam(required = false, name = "q") String query,
                                          @RequestParam(required = false, name = "lang") String lang,
                                          @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage) {
        String locale = localeResolverService.resolveLocale(lang, acceptLanguage);
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "updatedAt"));
        return contentPostService.adminList(contentTypeId, status, query, locale, pageable);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ContentPostResponse> get(@PathVariable UUID id,
                                                   @RequestParam(required = false, name = "lang") String lang,
                                                   @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage) {
        String locale = localeResolverService.resolveLocale(lang, acceptLanguage);
        return ResponseEntity.ok(contentPostService.adminGet(id, locale));
    }

    @PostMapping
    public ResponseEntity<ContentPostResponse> create(@Valid @RequestBody ContentPostRequest request,
                                                      @RequestParam(required = false, name = "lang") String lang,
                                                      @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage) {
        String locale = localeResolverService.resolveLocale(lang, acceptLanguage);
        return ResponseEntity.ok(contentPostService.createDraft(request, locale));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ContentPostResponse> update(@PathVariable UUID id,
                                                      @Valid @RequestBody ContentPostRequest request,
                                                      @RequestParam(required = false, name = "lang") String lang,
                                                      @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage) {
        String locale = localeResolverService.resolveLocale(lang, acceptLanguage);
        return ResponseEntity.ok(contentPostService.update(id, request, locale));
    }

    @PostMapping("/{id}/publish")
    public ResponseEntity<ContentPostResponse> publish(@PathVariable UUID id,
                                                       @RequestParam(required = false, name = "lang") String lang,
                                                       @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage) {
        String locale = localeResolverService.resolveLocale(lang, acceptLanguage);
        return ResponseEntity.ok(contentPostService.publish(id, locale));
    }

    @PostMapping("/{id}/archive")
    public ResponseEntity<ContentPostResponse> archive(@PathVariable UUID id,
                                                       @RequestParam(required = false, name = "lang") String lang,
                                                       @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage) {
        String locale = localeResolverService.resolveLocale(lang, acceptLanguage);
        return ResponseEntity.ok(contentPostService.archive(id, locale));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        contentPostService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
