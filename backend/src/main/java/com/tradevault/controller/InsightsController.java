package com.tradevault.controller;

import com.tradevault.dto.today.FeaturedPlanResponse;
import com.tradevault.service.LocaleResolverService;
import com.tradevault.service.today.TodayService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/insights")
@RequiredArgsConstructor
public class InsightsController {
    private final TodayService todayService;
    private final LocaleResolverService localeResolverService;

    @GetMapping("/featured")
    public ResponseEntity<FeaturedPlanResponse> featured(@RequestParam(name = "type") String type,
                                                         @RequestParam(required = false, name = "tz") String timezone,
                                                         @RequestParam(required = false, name = "lang") String lang,
                                                         @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage) {
        String locale = localeResolverService.resolveLocale(lang, acceptLanguage);
        FeaturedPlanResponse response = todayService.getFeaturedPlan(type, locale, timezone);
        if (response == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(response);
    }
}
