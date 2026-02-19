package com.tradevault.service.today;

import com.tradevault.analytics.TradeCoachService;
import com.tradevault.domain.entity.User;
import com.tradevault.dto.analytics.AdviceCard;
import com.tradevault.dto.analytics.AdviceConfidence;
import com.tradevault.dto.analytics.AdviceSeverity;
import com.tradevault.dto.analytics.CoachResponse;
import com.tradevault.dto.content.ContentPostResponse;
import com.tradevault.dto.today.CoachFocusResponse;
import com.tradevault.dto.today.FeaturedPlanResponse;
import com.tradevault.service.ContentPostService;
import com.tradevault.service.CurrentUserService;
import com.tradevault.service.TimezoneService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class TodayService {
    private static final String DAILY_PLAN_KEY = "DAILY_PLAN";
    private static final String WEEKLY_PLAN_KEY = "WEEKLY_PLAN";

    private final ContentPostService contentPostService;
    private final TradeCoachService tradeCoachService;
    private final CurrentUserService currentUserService;
    private final TimezoneService timezoneService;

    public FeaturedPlanResponse getFeaturedPlan(String requestedType, String locale, String timezone) {
        FeaturedPlanType planType = FeaturedPlanType.from(requestedType);
        User user = currentUserService.getCurrentUser();
        ZoneId zoneId = timezoneService.resolveZone(timezone, user);
        LocalDate today = LocalDate.now(zoneId);

        List<ContentPostResponse> candidates = contentPostService.listPublished(planType.contentTypeKey(), null, true, locale);
        ContentPostResponse selected = selectFeatured(candidates, planType, today, zoneId);
        if (selected == null) {
            return null;
        }

        return FeaturedPlanResponse.builder()
                .id(selected.getId())
                .slug(selected.getSlug())
                .title(selected.getTitle())
                .type(selected.getContentTypeKey())
                .biasSummary(resolveBiasSummary(selected))
                .primaryModel(resolvePrimaryModel(selected))
                .keyLevels(resolveKeyLevels(selected))
                .tags(selected.getTags() == null ? List.of() : selected.getTags())
                .symbols(selected.getSymbols() == null ? List.of() : selected.getSymbols())
                .weekStart(selected.getWeekStart())
                .weekEnd(selected.getWeekEnd())
                .publishedAt(selected.getPublishedAt())
                .updatedAt(selected.getUpdatedAt())
                .build();
    }

    public CoachFocusResponse getCoachFocus() {
        CoachResponse coach = tradeCoachService.coach(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                "CLOSE",
                false
        );

        AdviceCard focus = (coach.getAdvice() == null ? List.<AdviceCard>of() : coach.getAdvice()).stream()
                .filter(item -> item.getTitle() != null && !item.getTitle().isBlank())
                .min(Comparator
                        .comparingInt((AdviceCard item) -> severityRank(item.getSeverity()))
                        .thenComparingInt(item -> confidenceRank(item.getConfidence())))
                .orElse(null);

        if (focus == null) {
            return CoachFocusResponse.builder()
                    .available(false)
                    .severity("info")
                    .leakTitle("No clear leak detected yet")
                    .action("Keep logging high-quality trades this week")
                    .rationale("Add more closed trades for stronger coaching signals.")
                    .build();
        }

        String severity = focus.getSeverity() == null ? "info" : focus.getSeverity().getValue();

        return CoachFocusResponse.builder()
                .available(true)
                .severity(severity)
                .leakTitle(focus.getTitle())
                .action(firstNonBlank(focus.getRecommendedActions()))
                .rationale(firstNonBlank(focus.getMessage()))
                .build();
    }

    private ContentPostResponse selectFeatured(List<ContentPostResponse> candidates,
                                               FeaturedPlanType planType,
                                               LocalDate today,
                                               ZoneId zoneId) {
        if (candidates == null || candidates.isEmpty()) {
            return null;
        }

        if (planType == FeaturedPlanType.WEEKLY) {
            Optional<ContentPostResponse> matchingWeek = candidates.stream()
                    .filter(post -> post.getWeekStart() != null && post.getWeekEnd() != null)
                    .filter(post -> !today.isBefore(post.getWeekStart()) && !today.isAfter(post.getWeekEnd()))
                    .findFirst();
            if (matchingWeek.isPresent()) {
                return matchingWeek.get();
            }
        }

        if (planType == FeaturedPlanType.DAILY) {
            Optional<ContentPostResponse> exactDay = candidates.stream()
                    .filter(post -> isSameLocalDate(post.getVisibleFrom(), today, zoneId))
                    .findFirst();
            if (exactDay.isPresent()) {
                return exactDay.get();
            }
        }

        Optional<ContentPostResponse> currentlyActive = candidates.stream()
                .filter(post -> isActiveForDay(post, today, zoneId))
                .findFirst();

        return currentlyActive.orElse(candidates.get(0));
    }

    private boolean isActiveForDay(ContentPostResponse post, LocalDate today, ZoneId zoneId) {
        LocalDate from = toLocalDate(post.getVisibleFrom(), zoneId);
        LocalDate until = toLocalDate(post.getVisibleUntil(), zoneId);
        boolean startsBeforeToday = from == null || !today.isBefore(from);
        boolean endsAfterToday = until == null || !today.isAfter(until);
        return startsBeforeToday && endsAfterToday;
    }

    private boolean isSameLocalDate(OffsetDateTime dateTime, LocalDate day, ZoneId zoneId) {
        LocalDate localDate = toLocalDate(dateTime, zoneId);
        return localDate != null && localDate.equals(day);
    }

    private LocalDate toLocalDate(OffsetDateTime value, ZoneId zoneId) {
        if (value == null) {
            return null;
        }
        return value.atZoneSameInstant(zoneId).toLocalDate();
    }

    private String resolveBiasSummary(ContentPostResponse post) {
        String summary = normalize(post.getSummary());
        if (summary != null) {
            return summary;
        }

        String body = post.getBody();
        if (body == null || body.isBlank()) {
            return "";
        }

        return Stream.of(body.split("\\R"))
                .map(this::stripMarkdownPrefix)
                .map(this::normalize)
                .filter(item -> item != null)
                .findFirst()
                .orElse("");
    }

    private String resolvePrimaryModel(ContentPostResponse post) {
        List<String> tags = post.getTags() == null ? List.of() : post.getTags();
        return tags.stream()
                .map(this::normalize)
                .filter(item -> item != null)
                .filter(item -> !isLikelyKeyLevel(item))
                .findFirst()
                .orElse("");
    }

    private List<String> resolveKeyLevels(ContentPostResponse post) {
        List<String> tags = post.getTags() == null ? List.of() : post.getTags();
        List<String> symbols = post.getSymbols() == null ? List.of() : post.getSymbols();

        List<String> values = new ArrayList<>();
        Stream.concat(tags.stream(), symbols.stream())
                .map(this::normalize)
                .filter(item -> item != null)
                .filter(item -> isLikelyKeyLevel(item) || values.isEmpty())
                .forEach(values::add);

        if (values.isEmpty()) {
            values.addAll(symbols.stream().map(this::normalize).filter(item -> item != null).limit(4).toList());
        }

        return values.stream().distinct().limit(6).toList();
    }

    private boolean isLikelyKeyLevel(String value) {
        String normalized = value.toUpperCase(Locale.ROOT);
        return normalized.matches(".*\\d.*")
                || normalized.contains("PDH")
                || normalized.contains("PDL")
                || normalized.contains("EQH")
                || normalized.contains("EQL")
                || normalized.contains("ASIA")
                || normalized.contains("HIGH")
                || normalized.contains("LOW");
    }

    private String stripMarkdownPrefix(String value) {
        return value
                .replaceFirst("^#{1,6}\\s*", "")
                .replaceFirst("^[-*]\\s+", "")
                .trim();
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String firstNonBlank(List<String> values) {
        if (values == null || values.isEmpty()) {
            return "";
        }
        return values.stream()
                .map(this::normalize)
                .filter(item -> item != null)
                .findFirst()
                .orElse("");
    }

    private int severityRank(AdviceSeverity severity) {
        if (severity == AdviceSeverity.CRITICAL) return 0;
        if (severity == AdviceSeverity.WARN) return 1;
        return 2;
    }

    private int confidenceRank(AdviceConfidence confidence) {
        if (confidence == AdviceConfidence.HIGH) return 0;
        if (confidence == AdviceConfidence.MEDIUM) return 1;
        return 2;
    }

    private enum FeaturedPlanType {
        DAILY("daily", DAILY_PLAN_KEY),
        WEEKLY("weekly", WEEKLY_PLAN_KEY);

        private final String alias;
        private final String contentTypeKey;

        FeaturedPlanType(String alias, String contentTypeKey) {
            this.alias = alias;
            this.contentTypeKey = contentTypeKey;
        }

        public String contentTypeKey() {
            return contentTypeKey;
        }

        static FeaturedPlanType from(String rawType) {
            if (rawType == null || rawType.isBlank()) {
                throw new IllegalArgumentException("type is required and must be daily or weekly");
            }
            String normalized = rawType.trim().toLowerCase(Locale.ROOT);
            for (FeaturedPlanType type : values()) {
                if (type.alias.equals(normalized)) {
                    return type;
                }
            }
            throw new IllegalArgumentException("type must be daily or weekly");
        }
    }
}
