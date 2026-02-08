package com.tradevault.controller;

import com.tradevault.domain.enums.ContentPostStatus;
import com.tradevault.dto.content.ContentPostResponse;
import com.tradevault.service.ContentPostService;
import com.tradevault.service.LocaleResolverService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/content")
@RequiredArgsConstructor
public class ContentController {
    private final ContentPostService contentPostService;
    private final LocaleResolverService localeResolverService;

    @GetMapping
    public List<ContentPostResponse> list(@RequestParam(required = false, name = "type") String contentTypeKey,
                                          @RequestParam(required = false) ContentPostStatus status,
                                          @RequestParam(required = false, name = "q") String query,
                                          @RequestParam(defaultValue = "true") boolean activeOnly,
                                          @RequestParam(required = false, name = "lang") String lang,
                                          @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage) {
        if (status != null && status != ContentPostStatus.PUBLISHED) {
            throw new IllegalArgumentException("Only published content is available");
        }
        String locale = localeResolverService.resolveLocale(lang, acceptLanguage);
        return contentPostService.listPublished(contentTypeKey, query, activeOnly, locale);
    }

    @GetMapping("/{idOrSlug}")
    public ContentPostResponse get(@PathVariable String idOrSlug,
                                   @RequestParam(required = false, name = "lang") String lang,
                                   @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage) {
        String locale = localeResolverService.resolveLocale(lang, acceptLanguage);
        return contentPostService.getByIdOrSlug(idOrSlug, locale);
    }
}
