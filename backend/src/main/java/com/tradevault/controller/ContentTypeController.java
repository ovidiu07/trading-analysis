package com.tradevault.controller;

import com.tradevault.dto.content.ContentTypeResponse;
import com.tradevault.service.ContentTypeService;
import com.tradevault.service.LocaleResolverService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/content-types")
@RequiredArgsConstructor
public class ContentTypeController {
    private final ContentTypeService contentTypeService;
    private final LocaleResolverService localeResolverService;

    @GetMapping
    public List<ContentTypeResponse> list(@RequestParam(required = false, name = "lang") String lang,
                                          @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage) {
        String locale = localeResolverService.resolveLocale(lang, acceptLanguage);
        return contentTypeService.listActive(locale);
    }
}
