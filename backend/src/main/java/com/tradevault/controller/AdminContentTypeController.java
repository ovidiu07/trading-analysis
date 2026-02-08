package com.tradevault.controller;

import com.tradevault.dto.content.ContentTypeRequest;
import com.tradevault.dto.content.ContentTypeResponse;
import com.tradevault.service.ContentTypeService;
import com.tradevault.service.LocaleResolverService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/content-types")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminContentTypeController {
    private final ContentTypeService contentTypeService;
    private final LocaleResolverService localeResolverService;

    @GetMapping
    public List<ContentTypeResponse> list(@RequestParam(defaultValue = "true") boolean includeInactive,
                                          @RequestParam(required = false, name = "lang") String lang,
                                          @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage) {
        String locale = localeResolverService.resolveLocale(lang, acceptLanguage);
        return contentTypeService.adminList(locale, includeInactive);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ContentTypeResponse> get(@PathVariable UUID id,
                                                   @RequestParam(required = false, name = "lang") String lang,
                                                   @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage) {
        String locale = localeResolverService.resolveLocale(lang, acceptLanguage);
        return ResponseEntity.ok(contentTypeService.adminGet(id, locale));
    }

    @PostMapping
    public ResponseEntity<ContentTypeResponse> create(@Valid @RequestBody ContentTypeRequest request,
                                                      @RequestParam(required = false, name = "lang") String lang,
                                                      @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage) {
        String locale = localeResolverService.resolveLocale(lang, acceptLanguage);
        return ResponseEntity.ok(contentTypeService.create(request, locale));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ContentTypeResponse> update(@PathVariable UUID id,
                                                      @Valid @RequestBody ContentTypeRequest request,
                                                      @RequestParam(required = false, name = "lang") String lang,
                                                      @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage) {
        String locale = localeResolverService.resolveLocale(lang, acceptLanguage);
        return ResponseEntity.ok(contentTypeService.update(id, request, locale));
    }
}
